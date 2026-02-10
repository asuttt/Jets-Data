"""Utilities for 4th-down decision analysis."""
from __future__ import annotations

import logging
from typing import Iterable

import pandas as pd

LOGGER = logging.getLogger(__name__)

DEFAULT_COLUMNS: tuple[str, ...] = (
    "game_date",
    "home_team",
    "away_team",
    "season",
    "game_id",
    "play_id",
    "posteam",
    "defteam",
    "qtr",
    "time",
    "game_seconds_remaining",
    "half_seconds_remaining",
    "quarter_seconds_remaining",
    "down",
    "ydstogo",
    "yardline_100",
    "score_differential",
    "posteam_score",
    "defteam_score",
    "play_type",
    "desc",
    "punt_attempt",
    "field_goal_attempt",
    "field_goal_result",
    "qb_kneel",
    "qb_spike",
    "penalty",
    "fourth_down_converted",
    "wp",
    "wpa",
)


def _columns_present(df: pd.DataFrame, columns: Iterable[str]) -> list[str]:
    return [col for col in columns if col in df.columns]


def _label_decision(df: pd.DataFrame) -> pd.Series:
    if "play_type" not in df.columns:
        raise KeyError("Missing required column: play_type")

    if "punt_attempt" in df.columns:
        punt_attempt = df["punt_attempt"].astype("boolean").fillna(False)
    else:
        punt_attempt = False

    if "field_goal_attempt" in df.columns:
        field_goal_attempt = df["field_goal_attempt"].astype("boolean").fillna(False)
    else:
        field_goal_attempt = False

    play_type = df["play_type"].fillna("")
    decision = pd.Series("go", index=df.index)

    decision = decision.mask(punt_attempt | (play_type == "punt"), "punt")
    decision = decision.mask(field_goal_attempt | (play_type == "field_goal"), "field_goal")

    return decision


def _format_clock(row: pd.Series) -> str:
    if "time" in row and pd.notna(row["time"]):
        return f"Q{int(row['qtr'])} - {row['time']}"

    qtr = int(row["qtr"]) if pd.notna(row.get("qtr")) else None
    secs = row.get("quarter_seconds_remaining")
    if qtr is None or pd.isna(secs):
        return ""

    minutes = int(secs) // 60
    seconds = int(secs) % 60
    return f"Q{qtr} - {minutes}:{seconds:02d}"


def _format_score(score_diff: float | int | None) -> str:
    if score_diff is None or pd.isna(score_diff):
        return ""
    diff = int(score_diff)
    if diff > 0:
        return f"Up {diff}"
    if diff < 0:
        return f"Down {abs(diff)}"
    return "Tied"


def _format_field_position(row: pd.Series) -> str:
    yardline_100 = row.get("yardline_100")
    if yardline_100 is None or pd.isna(yardline_100):
        return ""

    yardline_100 = int(yardline_100)
    posteam = row.get("posteam", "")
    defteam = row.get("defteam", "")

    if yardline_100 <= 50:
        team = defteam if defteam else "OPP"
        yardline = yardline_100
    else:
        team = posteam if posteam else "OWN"
        yardline = 100 - yardline_100

    return f"{team} {yardline}"


def _add_display_fields(df: pd.DataFrame) -> pd.DataFrame:
    display = df.copy()
    display["clock_display"] = display.apply(_format_clock, axis=1)
    display["score_display"] = display["score_differential"].apply(_format_score)
    display["field_position_display"] = display.apply(_format_field_position, axis=1)
    def _format_down_distance(value) -> str:
        if pd.isna(value):
            return "4th"
        return f"4th & {int(value)}"

    display["down_distance"] = display["ydstogo"].apply(_format_down_distance)
    return display


def build_fourth_down_frame(
    df: pd.DataFrame,
    *,
    require_wp: bool = True,
    drop_no_play: bool = True,
    drop_kneel_spike: bool = True,
    add_display_fields: bool = True,
    columns: Iterable[str] = DEFAULT_COLUMNS,
) -> pd.DataFrame:
    """Return a curated 4th-down dataset for decision analysis.

    Args:
        df: Raw play-by-play DataFrame.
        require_wp: Drop rows with missing WP if True.
        drop_no_play: Drop rows with play_type == "no_play" if True.
        drop_kneel_spike: Drop qb kneels/spikes if True.
        columns: Columns to keep (filtered to those present).

    Returns:
        Filtered DataFrame with a `decision` column.
    """
    if "down" not in df.columns:
        raise KeyError("Missing required column: down")

    fourth_down = df["down"] == 4
    filtered = df.loc[fourth_down].copy()

    if drop_no_play and "play_type" in filtered.columns:
        filtered = filtered.loc[filtered["play_type"] != "no_play"]

    if drop_kneel_spike:
        if "qb_kneel" in filtered.columns:
            qb_kneel = filtered["qb_kneel"].astype("boolean").fillna(False)
            filtered = filtered.loc[~qb_kneel]
        if "qb_spike" in filtered.columns:
            qb_spike = filtered["qb_spike"].astype("boolean").fillna(False)
            filtered = filtered.loc[~qb_spike]

    if require_wp and "wp" in filtered.columns:
        filtered = filtered.loc[filtered["wp"].notna()]

    filtered = filtered.assign(decision=_label_decision(filtered))
    if add_display_fields:
        filtered = _add_display_fields(filtered)

    keep_cols = _columns_present(filtered, columns)
    if add_display_fields:
        keep_cols.extend(
            col
            for col in (
                "clock_display",
                "score_display",
                "field_position_display",
                "down_distance",
            )
            if col in filtered.columns
        )
    keep_cols = list(dict.fromkeys(keep_cols + ["decision"]))

    missing_cols = [col for col in columns if col not in keep_cols]
    if missing_cols:
        LOGGER.info("Missing columns (not included): %s", missing_cols)

    curated = filtered.loc[:, keep_cols].copy()

    decision_counts = curated["decision"].value_counts().to_dict()
    LOGGER.info("4th-down plays retained: %s", f"{len(curated):,}")
    LOGGER.info("Decision counts: %s", decision_counts)

    return curated


def compare_team_to_league(
    df: pd.DataFrame,
    *,
    team: str,
    team_seasons: Iterable[int],
    league_seasons: Iterable[int],
    decision_col: str = "decision",
    wp_col: str = "wp",
    wpa_col: str = "wpa",
) -> pd.DataFrame:
    """Aggregate decision outcomes for league vs team comparison."""
    required = {"season", "posteam", decision_col, wp_col, wpa_col}
    missing = required - set(df.columns)
    if missing:
        raise KeyError(f"Missing required columns: {sorted(missing)}")

    league_mask = df["season"].isin(list(league_seasons))
    team_mask = df["season"].isin(list(team_seasons)) & (df["posteam"] == team)

    def _aggregate(scope: str, frame: pd.DataFrame) -> pd.DataFrame:
        grouped = (
            frame.groupby(decision_col)
            .agg(
                plays=("season", "size"),
                wp_mean=(wp_col, "mean"),
                wpa_mean=(wpa_col, "mean"),
            )
            .reset_index()
        )
        grouped.insert(0, "scope", scope)
        return grouped

    league = _aggregate("league", df.loc[league_mask])
    team_df = _aggregate(team, df.loc[team_mask])
    return pd.concat([league, team_df], ignore_index=True)
