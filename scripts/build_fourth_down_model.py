"""Build expected WP outputs for 4th-down decisions."""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from src.fourth_down import build_fourth_down_frame
from src.fourth_down_model import (
    apply_expected_wp,
    fit_break_even_table,
    fit_expected_wp_table,
    summarize_expected_wp,
)
from src.io import load_pbp


def build_games_index(df: pd.DataFrame, *, team: str, season: int) -> pd.DataFrame:
    season_df = df.loc[df["season"] == season].copy()
    cols_needed = {"game_id", "game_date", "home_team", "away_team"}
    missing = cols_needed - set(season_df.columns)
    if missing:
        raise KeyError(f"Missing required columns for games index: {sorted(missing)}")

    score_cols = []
    if "total_home_score" in season_df.columns and "total_away_score" in season_df.columns:
        score_cols = ["total_home_score", "total_away_score"]
    elif "home_score" in season_df.columns and "away_score" in season_df.columns:
        score_cols = ["home_score", "away_score"]

    agg = {
        "game_date": "max",
        "home_team": "max",
        "away_team": "max",
    }
    if "week" in season_df.columns:
        agg["week"] = "max"
    for col in score_cols:
        agg[col] = "max"

    games = season_df.groupby("game_id", as_index=False).agg(agg)

    is_home = games["home_team"] == team
    is_away = games["away_team"] == team
    games = games.loc[is_home | is_away].copy()

    is_home = games["home_team"] == team
    games["team"] = team
    games["home_away"] = is_home.map({True: "home", False: "away"})
    games["opponent"] = games["away_team"].where(is_home, games["home_team"])

    if score_cols:
        games = games.rename(
            columns={
                score_cols[0]: "home_score",
                score_cols[1]: "away_score",
            }
        )

    return games.sort_values(["game_date", "game_id"]).reset_index(drop=True)


def build_cards(df: pd.DataFrame, games: pd.DataFrame, *, team: str, season: int) -> pd.DataFrame:
    cards = df.loc[(df["season"] == season) & (df["posteam"] == team)].copy()
    cards = cards.merge(
        games[["game_id", "opponent", "home_away"]],
        on="game_id",
        how="left",
    )

    cols = [
        "game_id",
        "game_date",
        "opponent",
        "home_away",
        "posteam",
        "defteam",
        "clock_display",
        "score_display",
        "down_distance",
        "field_position_display",
        "decision",
        "best_decision",
        "decision_matches_best",
        "low_sample_flag",
        "bucket_total_plays",
        "bucket_min_plays",
        "exp_wp_go_display",
        "exp_wp_punt_display",
        "exp_wp_field_goal_display",
        "exp_wp_recommendation_edge",
        "field_goal_chance",
        "first_down_chance",
        "break_even_first_down_chance",
        "break_even_conflict_flag",
        "break_even_conflict_reason",
        "wp",
        "post_wp",
        "desc",
    ]
    keep = [col for col in cols if col in cards.columns]
    return cards.loc[:, keep].reset_index(drop=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build expected WP outputs.")
    parser.add_argument("--train-start", type=int, default=2016, help="Train start.")
    parser.add_argument("--train-end", type=int, default=2024, help="Train end.")
    parser.add_argument("--eval-season", type=int, default=2025, help="Eval season.")
    parser.add_argument("--team", type=str, default="NYJ", help="Team abbreviation.")
    parser.add_argument(
        "--out-dir",
        type=str,
        default=str(PROJECT_ROOT / "artifacts"),
        help="Output directory for CSVs.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.train_start > args.train_end:
        raise ValueError("--train-start must be less than or equal to --train-end")

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    train_seasons = list(range(args.train_start, args.train_end + 1))
    all_seasons = sorted(set(train_seasons + [args.eval_season]))

    logging.info("Loading seasons: %s", all_seasons)
    df = load_pbp(all_seasons)
    fourth_down = build_fourth_down_frame(df)

    train_df = fourth_down.loc[fourth_down["season"].isin(train_seasons)]
    eval_df = fourth_down.loc[fourth_down["season"] == args.eval_season]

    expected_table, global_means = fit_expected_wp_table(train_df)
    break_even_table, break_even_global = fit_break_even_table(train_df)
    eval_expected = apply_expected_wp(
        eval_df,
        expected_table,
        global_means,
        break_even_table=break_even_table,
        break_even_global=break_even_global,
    )

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    expected_table.to_csv(out_dir / "fourth_down_expected_wp_table.csv", index=False)
    eval_expected.to_csv(out_dir / "fourth_down_expected_wp_eval.csv", index=False)

    summary = summarize_expected_wp(
        eval_expected,
        team=args.team,
        team_seasons=[args.eval_season],
        league_seasons=train_seasons,
    )
    summary.to_csv(out_dir / "fourth_down_expected_wp_summary.csv", index=False)

    games = build_games_index(df, team=args.team, season=args.eval_season)
    games_path = out_dir / f"{args.team.lower()}_{args.eval_season}_games.csv"
    games.to_csv(games_path, index=False)

    cards = build_cards(eval_expected, games, team=args.team, season=args.eval_season)
    cards_path = out_dir / f"{args.team.lower()}_{args.eval_season}_fourth_down_cards.csv"
    cards.to_csv(cards_path, index=False)

    conflict_cols = [
        "game_id",
        "game_date",
        "posteam",
        "defteam",
        "clock_display",
        "score_display",
        "down_distance",
        "field_position_display",
        "decision",
        "best_decision",
        "first_down_chance",
        "break_even_first_down_chance",
        "field_goal_chance",
        "exp_wp_go_display",
        "exp_wp_punt_display",
        "exp_wp_field_goal_display",
        "break_even_conflict_reason",
        "desc",
    ]
    conflict_keep = [col for col in conflict_cols if col in eval_expected.columns]
    conflict_df = eval_expected.loc[
        eval_expected["break_even_conflict_flag"] == True, conflict_keep
    ].copy()
    conflict_path = out_dir / "fourth_down_break_even_conflicts.csv"
    conflict_df.to_csv(conflict_path, index=False)

    conflict_rate = (
        float(eval_expected["break_even_conflict_flag"].mean())
        if len(eval_expected)
        else 0.0
    )
    logging.info(
        "Break-even conflicts: %s/%s (%.1f%%)",
        f"{len(conflict_df):,}",
        f"{len(eval_expected):,}",
        conflict_rate * 100.0,
    )

    if {"shadow_best_decision", "shadow_changes_recommendation", "shadow_decision_matches_actual", "decision_matches_best", "shadow_break_even_available"} <= set(eval_expected.columns):
        shadow_change_rate = float(eval_expected["shadow_changes_recommendation"].mean())
        shadow_match_rate = float(eval_expected["shadow_decision_matches_actual"].mean())
        current_match_rate = float(eval_expected["decision_matches_best"].mean())
        shadow_available_rate = float(eval_expected["shadow_break_even_available"].mean())
        logging.info(
            "Shadow recommendation availability: %.1f%%",
            shadow_available_rate * 100.0,
        )
        logging.info(
            "Shadow recommendation changes: %s/%s (%.1f%%)",
            f"{int(eval_expected['shadow_changes_recommendation'].sum()):,}",
            f"{len(eval_expected):,}",
            shadow_change_rate * 100.0,
        )
        logging.info(
            "Match rate current vs shadow: %.1f%% vs %.1f%%",
            current_match_rate * 100.0,
            shadow_match_rate * 100.0,
        )

    logging.info("Wrote expected WP outputs to %s", out_dir)


if __name__ == "__main__":
    main()
