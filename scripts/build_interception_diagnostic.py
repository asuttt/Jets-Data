"""Build interception drought diagnostic artifacts."""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from src.interceptions import (
    IntModelConfig,
    apply_int_model,
    build_games_index,
    build_pass_defense_frame,
    build_season_comparison,
    fit_int_model,
    summarize_per_game,
)
from src.io import load_pbp


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build INT drought diagnostics.")
    parser.add_argument("--train-start", type=int, default=2016, help="Train start.")
    parser.add_argument("--train-end", type=int, default=2024, help="Train end.")
    parser.add_argument("--eval-season", type=int, default=2025, help="Eval season.")
    parser.add_argument("--team", type=str, default="NYJ", help="Team abbreviation.")
    parser.add_argument(
        "--add-drive-detail",
        action="store_true",
        help="Write per-drive expected INT detail for the eval season.",
    )
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
    eval_seasons = [args.eval_season]
    all_seasons = sorted(set(train_seasons + eval_seasons))

    logging.info("Loading seasons: %s", all_seasons)
    df = load_pbp(all_seasons)

    train_df = build_pass_defense_frame(df, team=args.team, seasons=train_seasons)
    eval_df = build_pass_defense_frame(df, team=args.team, seasons=eval_seasons)

    model = fit_int_model(train_df, config=IntModelConfig())
    eval_scored = apply_int_model(model, eval_df)
    train_scored = apply_int_model(model, train_df)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    games = build_games_index(df, team=args.team, season=args.eval_season)
    per_game = summarize_per_game(eval_scored, games)

    per_game_path = out_dir / f"{args.team.lower()}_{args.eval_season}_int_per_game.csv"
    per_game.to_csv(per_game_path, index=False)

    detail_cols = [
        "season",
        "game_id",
        "game_date",
        "week",
        "posteam",
        "defteam",
        "qtr",
        "time",
        "score_differential",
        "air_yards",
        "pass_length",
        "pass_location",
        "qb_hit",
        "sack",
        "pass_defense",
        "interception",
        "expected_int_prob",
        "expected_ints",
        "desc",
    ]
    detail_cols = [col for col in detail_cols if col in eval_scored.columns]
    detail = eval_scored.loc[:, detail_cols].copy()
    detail_path = out_dir / f"{args.team.lower()}_{args.eval_season}_int_play_detail.csv"
    detail.to_csv(detail_path, index=False)

    if args.add_drive_detail:
        drive_cols = [
            "game_id",
            "drive",
            "qtr",
            "time",
            "pass_attempt",
            "interception",
            "pass_defense",
            "qb_hit",
            "sack",
        ]
        if "drive" in eval_scored.columns:
            drive = eval_scored.loc[:, [col for col in drive_cols if col in eval_scored.columns]].copy()
            drive["expected_ints"] = eval_scored["expected_ints"].values
            drive_summary = (
                drive.groupby(["game_id", "drive"], as_index=False)
                .agg(
                    qtr=("qtr", "min"),
                    time=("time", "min"),
                    pass_attempts=("pass_attempt", "size"),
                    pass_defenses=("pass_defense", "sum"),
                    qb_hits=("qb_hit", "sum"),
                    sacks=("sack", "sum"),
                    interceptions=("interception", "sum"),
                    expected_ints=("expected_ints", "sum"),
                )
            )
            drive_path = out_dir / f"{args.team.lower()}_{args.eval_season}_int_drive_detail.csv"
            drive_summary.to_csv(drive_path, index=False)
        else:
            logging.warning("Drive column not found; skipping drive detail output.")

    season_summary = build_season_comparison(eval_scored, train_scored)
    summary_path = out_dir / f"{args.team.lower()}_{args.eval_season}_int_summary.csv"
    season_summary.to_csv(summary_path, index=False)

    logging.info("Wrote INT diagnostic outputs to %s", out_dir)


if __name__ == "__main__":
    main()
