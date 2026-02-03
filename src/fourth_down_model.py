"""Expected WP modeling for 4th-down decisions."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterable

import pandas as pd

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class BucketConfig:
    ydstogo_bins: tuple[int, ...] = (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 50, 100)
    yardline_bins: tuple[int, ...] = (0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100)
    score_bins: tuple[int, ...] = (-28, -21, -14, -7, 0, 7, 14, 21, 28)
    time_bins: tuple[int, ...] = (0, 900, 1800, 2700, 3600)


def add_buckets(df: pd.DataFrame, *, config: BucketConfig | None = None) -> pd.DataFrame:
    """Add bucketed columns for situation grouping."""
    config = config or BucketConfig()
    needed = {"ydstogo", "yardline_100", "score_differential", "game_seconds_remaining"}
    missing = needed - set(df.columns)
    if missing:
        raise KeyError(f"Missing required columns: {sorted(missing)}")

    bucketed = df.copy()
    bucketed["ydstogo_bin"] = pd.cut(
        bucketed["ydstogo"],
        bins=[0, *config.ydstogo_bins],
        include_lowest=True,
        right=True,
    )
    bucketed["yardline_bin"] = pd.cut(
        bucketed["yardline_100"],
        bins=config.yardline_bins,
        include_lowest=True,
        right=True,
    )
    bucketed["score_diff_bin"] = pd.cut(
        bucketed["score_differential"],
        bins=[-99, *config.score_bins, 99],
        include_lowest=True,
        right=True,
    )
    bucketed["time_bin"] = pd.cut(
        bucketed["game_seconds_remaining"],
        bins=config.time_bins,
        include_lowest=True,
        right=True,
    )
    return bucketed


def _post_wp(df: pd.DataFrame, *, wp_col: str, wpa_col: str) -> pd.Series:
    if wp_col not in df.columns or wpa_col not in df.columns:
        raise KeyError(f"Missing required columns: {wp_col}, {wpa_col}")
    return df[wp_col] + df[wpa_col]


def fit_expected_wp_table(
    df: pd.DataFrame,
    *,
    decision_col: str = "decision",
    wp_col: str = "wp",
    wpa_col: str = "wpa",
    config: BucketConfig | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Fit expected post-play WP by situation bucket and decision."""
    required = {"ydstogo", "yardline_100", "score_differential", "game_seconds_remaining"}
    missing = required - set(df.columns)
    if missing:
        raise KeyError(f"Missing required columns: {sorted(missing)}")

    bucketed = add_buckets(df, config=config)
    bucketed = bucketed.assign(post_wp=_post_wp(bucketed, wp_col=wp_col, wpa_col=wpa_col))

    group_cols = ["ydstogo_bin", "yardline_bin", "score_diff_bin", "time_bin", decision_col]
    table = (
        bucketed.groupby(group_cols, dropna=False)
        .agg(plays=("post_wp", "size"), exp_post_wp=("post_wp", "mean"))
        .reset_index()
    )

    global_means = (
        bucketed.groupby(decision_col)
        .agg(plays=("post_wp", "size"), exp_post_wp=("post_wp", "mean"))
        .reset_index()
    )

    LOGGER.info("Expected WP table rows: %s", f"{len(table):,}")
    return table, global_means


def apply_expected_wp(
    df: pd.DataFrame,
    expected_table: pd.DataFrame,
    global_means: pd.DataFrame,
    *,
    decision_col: str = "decision",
    wp_col: str = "wp",
    wpa_col: str = "wpa",
    min_plays_per_decision: int = 20,
    max_field_goal_distance: int = 60,
    config: BucketConfig | None = None,
) -> pd.DataFrame:
    """Attach expected post-play WP for each decision to a dataset."""
    bucketed = add_buckets(df, config=config)
    bucketed = bucketed.assign(post_wp=_post_wp(bucketed, wp_col=wp_col, wpa_col=wpa_col))

    pivot = expected_table.pivot_table(
        index=["ydstogo_bin", "yardline_bin", "score_diff_bin", "time_bin"],
        columns=decision_col,
        values="exp_post_wp",
    )

    pivot = pivot.rename(columns={
        "go": "exp_wp_go",
        "punt": "exp_wp_punt",
        "field_goal": "exp_wp_field_goal",
    })

    for col in ("exp_wp_go", "exp_wp_punt", "exp_wp_field_goal"):
        if col not in pivot.columns:
            pivot[col] = pd.NA

    pivot_plays = expected_table.pivot_table(
        index=["ydstogo_bin", "yardline_bin", "score_diff_bin", "time_bin"],
        columns=decision_col,
        values="plays",
    )
    pivot_plays = pivot_plays.rename(columns={
        "go": "plays_go",
        "punt": "plays_punt",
        "field_goal": "plays_field_goal",
    })
    for col in ("plays_go", "plays_punt", "plays_field_goal"):
        if col not in pivot_plays.columns:
            pivot_plays[col] = 0

    merged = bucketed.merge(
        pivot.reset_index(),
        on=["ydstogo_bin", "yardline_bin", "score_diff_bin", "time_bin"],
        how="left",
    )
    merged = merged.merge(
        pivot_plays.reset_index(),
        on=["ydstogo_bin", "yardline_bin", "score_diff_bin", "time_bin"],
        how="left",
    )

    global_map = global_means.set_index(decision_col)["exp_post_wp"].to_dict()
    merged["exp_wp_go"] = merged["exp_wp_go"].fillna(global_map.get("go"))
    merged["exp_wp_punt"] = merged["exp_wp_punt"].fillna(global_map.get("punt"))
    merged["exp_wp_field_goal"] = merged["exp_wp_field_goal"].fillna(
        global_map.get("field_goal")
    )

    for decision, plays_col in (
        ("go", "plays_go"),
        ("punt", "plays_punt"),
        ("field_goal", "plays_field_goal"),
    ):
        exp_col = f"exp_wp_{decision}"
        merged.loc[merged[plays_col] < min_plays_per_decision, exp_col] = pd.NA

    plays_cols = ["plays_go", "plays_punt", "plays_field_goal"]
    merged["bucket_total_plays"] = merged[plays_cols].sum(axis=1, skipna=True)
    merged["bucket_min_plays"] = merged[plays_cols].min(axis=1, skipna=True)
    merged["low_sample_flag"] = (
        merged["bucket_total_plays"] < min_plays_per_decision
    ) | (merged[plays_cols] < min_plays_per_decision).any(axis=1)

    merged["expected_kick_distance"] = merged["yardline_100"] + 17
    merged.loc[
        merged["expected_kick_distance"] > max_field_goal_distance, "exp_wp_field_goal"
    ] = pd.NA

    exp_cols = ["exp_wp_go", "exp_wp_punt", "exp_wp_field_goal"]
    merged["exp_wp_best"] = merged[exp_cols].max(axis=1, skipna=True)
    all_na = merged[exp_cols].isna().all(axis=1)
    best_idx = merged[exp_cols].fillna(-1e9).idxmax(axis=1)
    best_idx = best_idx.mask(all_na, pd.NA)
    merged["best_decision"] = best_idx.str.replace("exp_wp_", "")
    merged.loc[merged["best_decision"].isna(), "best_decision"] = merged[decision_col]

    merged["exp_wp_actual"] = merged["exp_wp_go"]
    merged.loc[merged[decision_col] == "punt", "exp_wp_actual"] = merged["exp_wp_punt"]
    merged.loc[merged[decision_col] == "field_goal", "exp_wp_actual"] = merged[
        "exp_wp_field_goal"
    ]
    merged["exp_wp_best_minus_actual"] = merged["exp_wp_best"] - merged["exp_wp_actual"]
    merged["decision_matches_best"] = merged[decision_col] == merged["best_decision"]

    return merged


def summarize_expected_wp(
    df: pd.DataFrame,
    *,
    team: str,
    team_seasons: Iterable[int],
    league_seasons: Iterable[int],
) -> pd.DataFrame:
    """Summarize expected vs actual by decision for league vs team."""
    required = {"season", "posteam", "decision", "post_wp", "exp_wp_actual", "exp_wp_best"}
    missing = required - set(df.columns)
    if missing:
        raise KeyError(f"Missing required columns: {sorted(missing)}")

    def _agg(scope: str, frame: pd.DataFrame) -> pd.DataFrame:
        grouped = (
            frame.groupby("decision")
            .agg(
                plays=("decision", "size"),
                post_wp_mean=("post_wp", "mean"),
                exp_wp_actual_mean=("exp_wp_actual", "mean"),
                exp_wp_best_mean=("exp_wp_best", "mean"),
                exp_wp_gap_mean=("exp_wp_best_minus_actual", "mean"),
            )
            .reset_index()
        )
        grouped.insert(0, "scope", scope)
        return grouped

    league = df.loc[df["season"].isin(list(league_seasons))]
    team_df = df.loc[df["season"].isin(list(team_seasons)) & (df["posteam"] == team)]
    return pd.concat([_agg("league", league), _agg(team, team_df)], ignore_index=True)
