"""Tests for 4th-down utilities."""
from __future__ import annotations

import unittest

import pandas as pd

from src.fourth_down import build_fourth_down_frame, compare_team_to_league


class TestFourthDownFrame(unittest.TestCase):
    def test_build_fourth_down_frame_filters_and_labels(self) -> None:
        df = pd.DataFrame(
            {
                "season": [2024, 2024, 2024, 2024],
                "posteam": ["NYJ", "NYJ", "BUF", "BUF"],
                "down": [4, 4, 4, 3],
                "ydstogo": [2, 7, 1, 10],
                "yardline_100": [40, 30, 25, 50],
                "score_differential": [0, -3, 7, 0],
                "qtr": [2, 4, 1, 3],
                "time": ["12:34", "05:01", "10:00", "02:30"],
                "play_type": ["punt", "field_goal", "run", "run"],
                "punt_attempt": [1, 0, 0, 0],
                "field_goal_attempt": [0, 1, 0, 0],
                "qb_kneel": [False, False, False, False],
                "qb_spike": [False, False, False, False],
                "wp": [0.4, 0.5, 0.6, 0.7],
                "wpa": [0.01, -0.02, 0.03, 0.0],
            }
        )

        curated = build_fourth_down_frame(df)
        self.assertEqual(len(curated), 3)
        self.assertEqual(curated["decision"].tolist(), ["punt", "field_goal", "go"])

    def test_compare_team_to_league(self) -> None:
        df = pd.DataFrame(
            {
                "season": [2020, 2020, 2025, 2025],
                "posteam": ["NYJ", "BUF", "NYJ", "NYJ"],
                "decision": ["go", "punt", "go", "punt"],
                "wp": [0.4, 0.6, 0.5, 0.55],
                "wpa": [0.01, -0.02, 0.02, -0.01],
            }
        )

        summary = compare_team_to_league(
            df,
            team="NYJ",
            team_seasons=[2025],
            league_seasons=[2020],
        )

        self.assertEqual(set(summary["scope"]), {"league", "NYJ"})
        self.assertEqual(summary["plays"].sum(), 4)


if __name__ == "__main__":
    unittest.main()
