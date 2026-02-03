"""Tests for I/O utilities."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import pandas as pd

from src import io


class TestLoadPbp(unittest.TestCase):
    def test_load_pbp_reads_and_logs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            df_2018 = pd.DataFrame({"season": [2018, 2018], "play_id": [1, 2]})
            df_2019 = pd.DataFrame({"season": [2019], "play_id": [3]})
            df_2018.to_parquet(tmp_path / "play_by_play_2018.parquet")
            df_2019.to_parquet(tmp_path / "play_by_play_2019.parquet")

            original_data_dir = io.DATA_DIR
            io.DATA_DIR = tmp_path
            try:
                with self.assertLogs("src.io", level="INFO"):
                    df = io.load_pbp([2019, 2018, 2018])
            finally:
                io.DATA_DIR = original_data_dir

        self.assertEqual(len(df), 3)
        self.assertEqual(set(df["season"].tolist()), {2018, 2019})

    def test_load_pbp_missing_file_raises(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            df_2020 = pd.DataFrame({"season": [2020], "play_id": [1]})
            df_2020.to_parquet(tmp_path / "play_by_play_2020.parquet")

            original_data_dir = io.DATA_DIR
            io.DATA_DIR = tmp_path
            try:
                with self.assertRaises(FileNotFoundError):
                    io.load_pbp([2020, 2021])
            finally:
                io.DATA_DIR = original_data_dir


if __name__ == "__main__":
    unittest.main()
