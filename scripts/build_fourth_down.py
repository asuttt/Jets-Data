"""Build a curated 4th-down dataset and summary for UI consumption."""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from src.fourth_down import build_fourth_down_frame, compare_team_to_league
from src.io import load_pbp


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build 4th-down datasets.")
    parser.add_argument("--start", type=int, default=2016, help="First season (inclusive).")
    parser.add_argument("--end", type=int, default=2024, help="Last season (inclusive).")
    parser.add_argument(
        "--team",
        type=str,
        default="NYJ",
        help="Team abbreviation for comparison (e.g., NYJ).",
    )
    parser.add_argument(
        "--team-season",
        type=int,
        default=2025,
        help="Team hold-out season (e.g., 2025).",
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
    if args.start > args.end:
        raise ValueError("--start must be less than or equal to --end")

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    seasons = list(range(args.start, args.end + 1))
    logging.info("Loading seasons: %s", seasons)
    df = load_pbp(seasons)

    fourth_down = build_fourth_down_frame(df)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    curated_path = out_dir / "fourth_down_curated.csv"
    fourth_down.to_csv(curated_path, index=False)
    logging.info("Wrote curated 4th-down data: %s", curated_path)

    summary = compare_team_to_league(
        fourth_down,
        team=args.team,
        team_seasons=[args.team_season],
        league_seasons=seasons,
    )
    summary_path = out_dir / "fourth_down_league_vs_team.csv"
    summary.to_csv(summary_path, index=False)
    logging.info("Wrote league vs team summary: %s", summary_path)


if __name__ == "__main__":
    main()
