"""Interception drought diagnostic utilities."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterable

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class IntModelConfig:
    max_iter: int = 1000
    min_plays_for_model: int = 5000


def build_pass_defense_frame(
    df: pd.DataFrame,
    *,
    team: str,
    seasons: Iterable[int],
) -> pd.DataFrame:
    """Filter to pass attempts against a defense with derived flags."""
    required = {
        "season",
        "game_id",
        "game_date",
        "week",
        "posteam",
        "defteam",
        "pass_attempt",
        "interception",
        "play_type",
    }
    missing = required - set(df.columns)
    if missing:
        raise KeyError(f"Missing required columns: {sorted(missing)}")

    seasons = list(seasons)
    frame = df.loc[df["season"].isin(seasons)].copy()
    frame = frame.loc[frame["defteam"] == team]

    frame = frame.loc[frame["pass_attempt"] == 1]
    if "play_type" in frame.columns:
        frame = frame.loc[frame["play_type"] != "no_play"]

    frame["pass_defense"] = False
    for col in ("pass_defense_1_player_id", "pass_defense_2_player_id"):
        if col in frame.columns:
            frame["pass_defense"] = frame["pass_defense"] | frame[col].notna()

    for col in ("qb_hit", "sack"):
        if col in frame.columns:
            frame[col] = frame[col].astype("boolean").fillna(False).astype(int)
        else:
            frame[col] = 0

    frame["interception"] = frame["interception"].fillna(0).astype(int)

    return frame


def _prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    features = [
        "air_yards",
        "pass_length",
        "pass_location",
        "score_differential",
        "game_seconds_remaining",
        "qb_hit",
        "sack",
        "pass_defense",
    ]
    keep = [col for col in features if col in df.columns]
    X = df.loc[:, keep].copy()

    if "pass_defense" in X.columns:
        X["pass_defense"] = X["pass_defense"].astype(int)

    for col in ("air_yards", "score_differential", "game_seconds_remaining"):
        if col in X.columns:
            X[col] = X[col].fillna(X[col].median())

    cat_cols = [col for col in ("pass_length", "pass_location") if col in X.columns]
    if cat_cols:
        X = pd.get_dummies(X, columns=cat_cols, dummy_na=True)

    y = df["interception"].astype(int)
    return X, y


def fit_int_model(
    df: pd.DataFrame,
    *,
    config: IntModelConfig | None = None,
) -> LogisticRegression:
    """Fit a simple logistic model for INT probability."""
    config = config or IntModelConfig()
    if len(df) < config.min_plays_for_model:
        raise ValueError(
            f"Need at least {config.min_plays_for_model} plays to fit model"
        )

    X, y = _prepare_features(df)
    model = LogisticRegression(max_iter=config.max_iter, class_weight="balanced")
    model.fit(X, y)
    return model


def apply_int_model(
    model: LogisticRegression,
    df: pd.DataFrame,
) -> pd.DataFrame:
    """Attach expected INT probability and expected INTs."""
    X, _ = _prepare_features(df)
    probs = model.predict_proba(X)[:, 1]
    out = df.copy()
    out["expected_int_prob"] = probs
    out["expected_ints"] = probs
    out["int_feature_impact_note"] = (
        "Higher risk throws (air_yards/depth), disruption (qb_hit/sack), and "
        "pass defenses increase expected INT probability."
    )
    return out


def build_games_index(df: pd.DataFrame, *, team: str, season: int) -> pd.DataFrame:
    cols_needed = {"game_id", "game_date", "home_team", "away_team"}
    missing = cols_needed - set(df.columns)
    if missing:
        raise KeyError(f"Missing required columns for games index: {sorted(missing)}")

    season_df = df.loc[df["season"] == season].copy()
    agg = {
        "game_date": "max",
        "home_team": "max",
        "away_team": "max",
        "week": "max" if "week" in season_df.columns else "first",
    }
    games = season_df.groupby("game_id", as_index=False).agg(agg)

    is_home = games["home_team"] == team
    is_away = games["away_team"] == team
    games = games.loc[is_home | is_away].copy()

    games["team"] = team
    games["home_away"] = is_home.map({True: "home", False: "away"})
    games["opponent"] = games["away_team"].where(is_home, games["home_team"])

    return games.sort_values(["game_date", "game_id"]).reset_index(drop=True)


def summarize_per_game(df: pd.DataFrame, games: pd.DataFrame) -> pd.DataFrame:
    """Per-game INT opportunity and outcome summary."""
    grouped = (
        df.groupby("game_id")
        .agg(
            pass_attempts=("pass_attempt", "size"),
            interceptions=("interception", "sum"),
            pass_defenses=("pass_defense", "sum"),
            qb_hits=("qb_hit", "sum"),
            sacks=("sack", "sum"),
            expected_ints=("expected_ints", "sum"),
        )
        .reset_index()
    )
    grouped["int_rate"] = grouped["interceptions"] / grouped["pass_attempts"]
    grouped["expected_int_rate"] = grouped["expected_ints"] / grouped["pass_attempts"]
    grouped["luck_gap"] = grouped["interceptions"] - grouped["expected_ints"]

    return games.merge(grouped, on="game_id", how="left")


def summarize_season(
    df: pd.DataFrame,
    *,
    scope: str,
) -> pd.DataFrame:
    """Season-level summary for one scope."""
    summary = pd.DataFrame(
        {
            "scope": [scope],
            "pass_attempts": [df["pass_attempt"].shape[0]],
            "interceptions": [df["interception"].sum()],
            "pass_defenses": [df["pass_defense"].sum()],
            "qb_hits": [df["qb_hit"].sum()],
            "sacks": [df["sack"].sum()],
            "expected_ints": [df["expected_ints"].sum()],
        }
    )
    summary["int_rate"] = summary["interceptions"] / summary["pass_attempts"]
    summary["expected_int_rate"] = summary["expected_ints"] / summary["pass_attempts"]
    summary["luck_gap"] = summary["interceptions"] - summary["expected_ints"]
    return summary


def build_season_comparison(
    jets_df: pd.DataFrame,
    league_df: pd.DataFrame,
) -> pd.DataFrame:
    """Compare Jets season to league baseline."""
    jets = summarize_season(jets_df, scope="NYJ 2025")
    league = summarize_season(league_df, scope="League 2016-2024")
    return pd.concat([league, jets], ignore_index=True)
