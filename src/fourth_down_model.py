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
    bucketed["yardline_25_bin"] = pd.cut(
        bucketed["yardline_100"],
        bins=(0, 25, 50, 75, 100),
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
    if "season" in bucketed.columns:
        # Recency weighting by season bands.
        season_weights = pd.Series(0.8, index=bucketed.index)
        season_weights = season_weights.mask(bucketed["season"].isin([2018, 2019]), 0.85)
        season_weights = season_weights.mask(bucketed["season"].isin([2020, 2021]), 0.9)
        season_weights = season_weights.mask(bucketed["season"].isin([2022, 2023]), 0.95)
        season_weights = season_weights.mask(bucketed["season"] == 2024, 1.0)
    else:
        season_weights = pd.Series(1.0, index=bucketed.index)
    bucketed["sample_weight"] = season_weights
    bucketed["weighted_post_wp"] = bucketed["post_wp"] * bucketed["sample_weight"]

    group_cols = [
        "ydstogo_bin",
        "yardline_bin",
        "yardline_25_bin",
        "score_diff_bin",
        "time_bin",
        decision_col,
    ]
    table = (
        bucketed.groupby(group_cols, dropna=False)
        .agg(
            plays=("sample_weight", "sum"),
            weighted_post_wp=("weighted_post_wp", "sum"),
        )
        .reset_index()
    )
    table["exp_post_wp"] = table["weighted_post_wp"] / table["plays"]
    table = table.drop(columns=["weighted_post_wp"])

    global_means = (
        bucketed.groupby(decision_col)
        .agg(
            plays=("sample_weight", "sum"),
            weighted_post_wp=("weighted_post_wp", "sum"),
        )
        .reset_index()
    )
    global_means["exp_post_wp"] = global_means["weighted_post_wp"] / global_means["plays"]
    global_means = global_means.drop(columns=["weighted_post_wp"])

    LOGGER.info("Expected WP table rows: %s", f"{len(table):,}")
    return table, global_means


def apply_expected_wp(
    df: pd.DataFrame,
    expected_table: pd.DataFrame,
    global_means: pd.DataFrame | None = None,
    *,
    decision_col: str = "decision",
    wp_col: str = "wp",
    wpa_col: str = "wpa",
    min_plays_per_decision: int = 20,
    max_field_goal_distance: int = 60,
    go_policy_boost: float = 0.03,
    must_score_time_seconds: int = 480,
    must_score_deficit: int = 4,
    must_score_yardline: int = 3,
    must_score_ydstogo: int = 2,
    aggressive_late_time_seconds: int = 540,
    aggressive_late_deficit: int = 10,
    aggressive_late_max_ydstogo: int = 8,
    aggressive_late_go_territory: int = 60,
    td_needed_time_seconds: int = 360,
    td_needed_deficit: int = 4,
    td_needed_redzone: int = 10,
    td_needed_block_fg_deficit: int = 9,
    td_needed_go_boost: float = 0.07,
    ultra_long_ydstogo: int = 15,
    ultra_long_exception_time_seconds: int = 240,
    ultra_long_exception_deficit: int = 10,
    lead_conservative_go_penalty: float = 0.75,
    lead_conservative_yardline: int = 55,
    lead_conservative_ydstogo: int = 3,
    lead_late_time_seconds: int = 300,
    lead_late_max_margin: int = 8,
    lead_late_yardline: int = 65,
    lead_late_ydstogo: int = 4,
    desperation_time_seconds: int = 600,
    desperation_deficit: int = 17,
    desperation_redzone: int = 20,
    desperation_max_ydstogo: int = 7,
    early_redzone_deficit: int = 10,
    early_redzone_max_qtr: int = 3,
    early_redzone_max_yardline: int = 20,
    early_redzone_max_ydstogo: int = 3,
    early_redzone_go_boost: float = 0.10,
    early_redzone_fg_penalty: float = 0.75,
    config: BucketConfig | None = None,
) -> pd.DataFrame:
    """Attach expected post-play WP for each decision to a dataset."""
    bucketed = add_buckets(df, config=config)
    bucketed = bucketed.assign(post_wp=_post_wp(bucketed, wp_col=wp_col, wpa_col=wpa_col))
    merged = bucketed.copy()

    decisions = ("go", "punt", "field_goal")
    for decision in decisions:
        merged[f"exp_wp_{decision}"] = pd.NA
        merged[f"plays_{decision}"] = pd.NA
        merged[f"source_level_{decision}"] = pd.NA

    def _aggregate_level(keys: list[str]) -> pd.DataFrame:
        level = expected_table.loc[:, [*keys, decision_col, "plays", "exp_post_wp"]].copy()
        level["weighted_post_wp"] = level["plays"] * level["exp_post_wp"]
        grouped = (
            level.groupby([*keys, decision_col], dropna=False)
            .agg(
                plays=("plays", "sum"),
                weighted_post_wp=("weighted_post_wp", "sum"),
            )
            .reset_index()
        )
        grouped["exp_post_wp"] = grouped["weighted_post_wp"] / grouped["plays"]
        return grouped.drop(columns=["weighted_post_wp"])

    level_keys = [
        ["ydstogo_bin", "yardline_bin", "score_diff_bin", "time_bin"],  # most specific
        ["ydstogo_bin", "yardline_bin", "score_diff_bin"],  # drop time
        ["ydstogo_bin", "score_diff_bin"],  # keep score context before broad field fallback
        ["ydstogo_bin", "yardline_25_bin"],  # broaden field to 25-yard bands
        ["ydstogo_bin"],  # distance only
    ]

    for level_idx, keys in enumerate(level_keys):
        agg = _aggregate_level(keys)
        wp_pivot = agg.pivot_table(
            index=keys,
            columns=decision_col,
            values="exp_post_wp",
        ).rename(columns={
            "go": f"wp_go_l{level_idx}",
            "punt": f"wp_punt_l{level_idx}",
            "field_goal": f"wp_field_goal_l{level_idx}",
        })
        for decision in decisions:
            col = f"wp_{decision}_l{level_idx}"
            if col not in wp_pivot.columns:
                wp_pivot[col] = pd.NA
        plays_pivot = agg.pivot_table(
            index=keys,
            columns=decision_col,
            values="plays",
        ).rename(columns={
            "go": f"plays_go_l{level_idx}",
            "punt": f"plays_punt_l{level_idx}",
            "field_goal": f"plays_field_goal_l{level_idx}",
        })
        for decision in decisions:
            col = f"plays_{decision}_l{level_idx}"
            if col not in plays_pivot.columns:
                plays_pivot[col] = pd.NA
        merged = merged.merge(wp_pivot.reset_index(), on=keys, how="left")
        merged = merged.merge(plays_pivot.reset_index(), on=keys, how="left")

        for decision in decisions:
            exp_col = f"exp_wp_{decision}"
            plays_col = f"plays_{decision}"
            source_col = f"source_level_{decision}"
            level_wp_col = f"wp_{decision}_l{level_idx}"
            level_plays_col = f"plays_{decision}_l{level_idx}"
            fill_mask = (
                merged[exp_col].isna()
                & merged[level_wp_col].notna()
                & (merged[level_plays_col] >= min_plays_per_decision)
            )
            merged.loc[fill_mask, exp_col] = merged.loc[fill_mask, level_wp_col]
            merged.loc[fill_mask, plays_col] = merged.loc[fill_mask, level_plays_col]
            merged.loc[fill_mask, source_col] = level_idx

    merged["expected_kick_distance"] = merged["yardline_100"] + 17
    merged.loc[
        merged["expected_kick_distance"] > max_field_goal_distance, "exp_wp_field_goal"
    ] = pd.NA
    # Modern NFL guardrail: punts this deep in opponent territory are effectively off-table.
    merged.loc[merged["yardline_100"] <= 45, "exp_wp_punt"] = pd.NA

    # Policy overlay: in goal-to-go leverage spots, bias recommendation modestly toward GO.
    # Trigger if within opponent 5 and either trailing by 10+ or in 4th quarter.
    in_q4 = (
        merged["qtr"] == 4
        if "qtr" in merged.columns
        else merged["game_seconds_remaining"] <= 900
    )
    policy_mask = (
        (merged["yardline_100"] <= 5)
        & (
            (merged["score_differential"] <= -10)
            | in_q4
        )
    )
    merged["policy_boost_applied"] = policy_mask
    merged["exp_wp_go_policy"] = merged["exp_wp_go"]
    merged.loc[policy_mask & merged["exp_wp_go_policy"].notna(), "exp_wp_go_policy"] = (
        merged.loc[policy_mask & merged["exp_wp_go_policy"].notna(), "exp_wp_go_policy"]
        + go_policy_boost
    ).clip(upper=1.0)

    # Strategy-layer effective values: apply contextual option constraints without changing raw WP columns.
    merged["exp_wp_go_effective"] = merged["exp_wp_go_policy"]
    merged["exp_wp_punt_effective"] = merged["exp_wp_punt"]
    merged["exp_wp_field_goal_effective"] = merged["exp_wp_field_goal"]

    # If trailing big late in realistic go territory on makeable distance, remove punt from options.
    aggressive_late_mask = (
        in_q4
        & (merged["game_seconds_remaining"] <= aggressive_late_time_seconds)
        & (merged["score_differential"] <= -aggressive_late_deficit)
        & (merged["ydstogo"] <= aggressive_late_max_ydstogo)
        & (merged["yardline_100"] <= aggressive_late_go_territory)
    )
    merged["rule_blocked_punt_aggressive_late"] = aggressive_late_mask
    merged.loc[aggressive_late_mask, "exp_wp_punt_effective"] = pd.NA

    # In late red-zone TD-needed states, block FG when still down by 9+ and bias toward GO otherwise.
    td_needed_mask = (
        in_q4
        & (merged["game_seconds_remaining"] <= td_needed_time_seconds)
        & (merged["score_differential"] <= -td_needed_deficit)
        & (merged["yardline_100"] <= td_needed_redzone)
    )
    block_fg_mask = td_needed_mask & (merged["score_differential"] <= -td_needed_block_fg_deficit)
    merged["rule_blocked_field_goal_td_needed"] = block_fg_mask
    merged.loc[block_fg_mask, "exp_wp_field_goal_effective"] = pd.NA

    go_boost_mask = td_needed_mask & merged["exp_wp_go_effective"].notna()
    merged["rule_go_boost_td_needed"] = go_boost_mask
    merged.loc[go_boost_mask, "exp_wp_go_effective"] = (
        merged.loc[go_boost_mask, "exp_wp_go_effective"] + td_needed_go_boost
    ).clip(upper=1.0)

    # Avoid unrealistic GO recommendations on ultra-long distance except clear late desperation.
    ultra_long_block_mask = (
        (merged["ydstogo"] >= ultra_long_ydstogo)
        & ~(
            in_q4
            & (merged["game_seconds_remaining"] <= ultra_long_exception_time_seconds)
            & (merged["score_differential"] <= -ultra_long_exception_deficit)
        )
    )
    merged["rule_blocked_go_ultra_long"] = ultra_long_block_mask
    merged.loc[ultra_long_block_mask, "exp_wp_go_effective"] = pd.NA

    # Hybrid lead-game management: discourage GO (soft penalty) in conservative punt spots.
    lead_non_desperation_mask = (
        (merged["score_differential"] >= 1)
        & (merged["yardline_100"] >= lead_conservative_yardline)
        & (merged["ydstogo"] >= lead_conservative_ydstogo)
        & ((~in_q4) | (in_q4 & (merged["game_seconds_remaining"] > lead_late_time_seconds)))
    )
    lead_late_deep_mask = (
        in_q4
        & (merged["game_seconds_remaining"] <= lead_late_time_seconds)
        & (merged["score_differential"] >= 1)
        & (merged["score_differential"] <= lead_late_max_margin)
        & (merged["yardline_100"] >= lead_late_yardline)
        & (merged["ydstogo"] >= lead_late_ydstogo)
    )
    lead_go_penalty_mask = (lead_non_desperation_mask | lead_late_deep_mask) & merged[
        "exp_wp_go_effective"
    ].notna()
    merged["rule_go_penalty_with_lead"] = lead_go_penalty_mask
    merged.loc[lead_go_penalty_mask, "exp_wp_go_effective"] = (
        merged.loc[lead_go_penalty_mask, "exp_wp_go_effective"] * lead_conservative_go_penalty
    )

    # Desperation red-zone: field goal usually does not recover win path; remove FG option.
    desperation_redzone_mask = (
        in_q4
        & (merged["game_seconds_remaining"] <= desperation_time_seconds)
        & (merged["score_differential"] <= -desperation_deficit)
        & (merged["yardline_100"] <= desperation_redzone)
        & (merged["ydstogo"] <= desperation_max_ydstogo)
    )
    merged["rule_blocked_field_goal_desperation"] = desperation_redzone_mask
    merged.loc[desperation_redzone_mask, "exp_wp_field_goal_effective"] = pd.NA

    # Mild aggression nudge (non-late game): trailing by 10+ in the red zone on short-to-go.
    # This is intentionally soft to avoid overcorrecting broad early-game situations.
    early_redzone_q_mask = merged["qtr"] <= early_redzone_max_qtr if "qtr" in merged.columns else ~in_q4
    early_redzone_mask = (
        early_redzone_q_mask
        & (merged["score_differential"] <= -early_redzone_deficit)
        & (merged["yardline_100"] <= early_redzone_max_yardline)
        & (merged["ydstogo"] <= early_redzone_max_ydstogo)
    )
    merged["rule_go_boost_early_redzone"] = early_redzone_mask & merged["exp_wp_go_effective"].notna()
    merged.loc[merged["rule_go_boost_early_redzone"], "exp_wp_go_effective"] = (
        merged.loc[merged["rule_go_boost_early_redzone"], "exp_wp_go_effective"] + early_redzone_go_boost
    ).clip(upper=1.0)
    merged["rule_fg_penalty_early_redzone"] = early_redzone_mask & merged[
        "exp_wp_field_goal_effective"
    ].notna()
    merged.loc[merged["rule_fg_penalty_early_redzone"], "exp_wp_field_goal_effective"] = (
        merged.loc[merged["rule_fg_penalty_early_redzone"], "exp_wp_field_goal_effective"]
        * early_redzone_fg_penalty
    )

    # Must-score override: force GO recommendation in late 4Q, down 4+, ultra-short near goal line.
    # This is recommendation-only; raw expected WP columns remain unchanged for transparency.
    must_score_mask = (
        in_q4
        & (merged["game_seconds_remaining"] <= must_score_time_seconds)
        & (merged["score_differential"] <= -must_score_deficit)
        & (merged["yardline_100"] <= must_score_yardline)
        & (merged["ydstogo"] <= must_score_ydstogo)
    )
    merged["must_score_override_applied"] = must_score_mask
    merged.loc[must_score_mask & merged["exp_wp_go_effective"].notna(), "exp_wp_go_effective"] = 1.0
    merged["rule_any_applied"] = (
        merged["rule_blocked_punt_aggressive_late"]
        | merged["rule_blocked_field_goal_td_needed"]
        | merged["rule_go_boost_td_needed"]
        | merged["rule_blocked_go_ultra_long"]
        | merged["rule_go_penalty_with_lead"]
        | merged["rule_blocked_field_goal_desperation"]
        | merged["rule_go_boost_early_redzone"]
        | merged["rule_fg_penalty_early_redzone"]
        | merged["must_score_override_applied"]
    )

    exp_cols_effective = [
        "exp_wp_go_effective",
        "exp_wp_punt_effective",
        "exp_wp_field_goal_effective",
    ]
    exp_cols_reliability = ["exp_wp_go_policy", "exp_wp_punt", "exp_wp_field_goal"]
    plays_cols = ["plays_go", "plays_punt", "plays_field_goal"]
    merged["bucket_total_plays"] = merged[plays_cols].sum(axis=1, skipna=True)
    merged["bucket_min_plays"] = merged[plays_cols].min(axis=1, skipna=True)
    # Reliability should reflect data coverage, not strategy-layer option blocking.
    merged["valid_decision_count"] = merged[exp_cols_reliability].notna().sum(axis=1)
    merged["low_sample_flag"] = merged["valid_decision_count"] < 2
    merged["exp_wp_best"] = merged[exp_cols_effective].max(axis=1, skipna=True)
    all_na = merged[exp_cols_effective].isna().all(axis=1)
    best_idx = merged[exp_cols_effective].fillna(-1e9).idxmax(axis=1)
    best_idx = best_idx.mask(all_na, pd.NA)
    merged["best_decision"] = best_idx.str.replace("exp_wp_", "")
    merged["best_decision"] = merged["best_decision"].str.replace("_policy", "")
    merged["best_decision"] = merged["best_decision"].str.replace("_effective", "")
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
