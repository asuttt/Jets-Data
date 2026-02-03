"""I/O utilities for Jets-DAT."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Iterable

import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
LOGGER = logging.getLogger(__name__)


def _coerce_seasons(seasons: Iterable[int]) -> list[int]:
    """Return a sorted list of unique seasons as ints."""
    return sorted({int(season) for season in seasons})


def load_pbp(seasons: list[int]) -> pd.DataFrame:
    """Load play-by-play parquet files for the requested seasons.

    Args:
        seasons: List of seasons (years) to load.

    Returns:
        Concatenated DataFrame containing all requested seasons.
    """
    seasons_list = _coerce_seasons(seasons)
    if not seasons_list:
        raise ValueError("seasons must contain at least one year")

    frames: list[pd.DataFrame] = []
    for season in seasons_list:
        path = DATA_DIR / f"play_by_play_{season}.parquet"
        if not path.exists():
            raise FileNotFoundError(f"Missing parquet file: {path}")
        frames.append(pd.read_parquet(path))

    df = pd.concat(frames, ignore_index=True)

    min_season = min(seasons_list)
    max_season = max(seasons_list)
    LOGGER.info("Rows: %s", f"{len(df):,}")
    LOGGER.info("Columns (%s): %s", len(df.columns), list(df.columns))
    LOGGER.info("Season range: %s–%s", min_season, max_season)

    return df
