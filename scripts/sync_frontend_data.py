"""Sync artifact CSVs into the frontend public data folder."""
from __future__ import annotations

from pathlib import Path
import shutil


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
FRONTEND_DATA = ROOT / "Frontend" / "public" / "data"

FILES = [
    "nyj_2025_games.csv",
    "nyj_2025_fourth_down_cards.csv",
    "nyj_2025_int_per_game.csv",
    "nyj_2025_int_summary.csv",
    "nyj_2025_int_play_detail.csv",
    "nyj_2025_int_drive_detail.csv",
    "nyj_2025_fourth_down_cards_2016_2024.csv",
    "nyj_2025_fourth_down_cards_2018_2024.csv",
    "nyj_2025_fourth_down_cards_2020_2024.csv",
]


def main() -> None:
    FRONTEND_DATA.mkdir(parents=True, exist_ok=True)

    copied = 0
    missing: list[str] = []
    for name in FILES:
        src = ARTIFACTS / name
        dest = FRONTEND_DATA / name
        if src.exists():
            shutil.copy2(src, dest)
            copied += 1
        else:
            missing.append(name)

    print(f"Synced {copied} files to {FRONTEND_DATA}")
    if missing:
        print("Missing files (not copied):")
        for name in missing:
            print(f"  - {name}")


if __name__ == "__main__":
    main()
