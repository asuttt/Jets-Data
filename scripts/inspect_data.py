"""Inspect play-by-play data across multiple seasons."""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from src.io import load_pbp


def summarize_wp_missing(df) -> None:
    """Print missing WP rate for 4th-down plays."""
    if "down" not in df.columns or "wp" not in df.columns:
        logging.warning("Cannot summarize WP missingness (missing 'down' or 'wp').")
        return

    fourth_down = df["down"] == 4
    fourth_down_count = int(fourth_down.sum())
    if fourth_down_count == 0:
        logging.info("No 4th-down plays found.")
        return

    wp_missing = df.loc[fourth_down, "wp"].isna()
    missing_count = int(wp_missing.sum())
    missing_rate = missing_count / fourth_down_count
    logging.info(
        "4th-down plays: %s | WP missing: %s (%.2f%%)",
        f"{fourth_down_count:,}",
        f"{missing_count:,}",
        missing_rate * 100,
    )


def main() -> None:
    """Load a season range and print summary."""
    parser = argparse.ArgumentParser(description="Inspect play-by-play data.")
    parser.add_argument(
        "--start",
        type=int,
        default=2016,
        help="First season to load (inclusive).",
    )
    parser.add_argument(
        "--end",
        type=int,
        default=2025,
        help="Last season to load (inclusive).",
    )
    args = parser.parse_args()

    if args.start > args.end:
        raise ValueError("--start must be less than or equal to --end")

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    seasons = list(range(args.start, args.end + 1))
    df = load_pbp(seasons)
    summarize_wp_missing(df)


if __name__ == "__main__":
    main()
