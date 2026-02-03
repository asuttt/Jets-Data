"""Tests for expected WP modeling."""
from __future__ import annotations

import unittest

import pandas as pd

from src.fourth_down_model import apply_expected_wp, fit_expected_wp_table, summarize_expected_wp


class TestFourthDownModel(unittest.TestCase):
    def test_fit_and_apply_expected_wp(self) -> None:
        df = pd.DataFrame(
            {
                "season": [2020, 2020, 2020, 2025],
                "posteam": ["NYJ", "BUF", "NYJ", "NYJ"],
                "down": [4, 4, 4, 4],
                "ydstogo": [2, 2, 4, 2],
                "yardline_100": [40, 40, 30, 40],
                "score_differential": [0, 3, -7, 0],
                "game_seconds_remaining": [1200, 1200, 600, 1200],
                "decision": ["go", "punt", "go", "go"],
                "wp": [0.5, 0.6, 0.4, 0.55],
                "wpa": [0.05, -0.02, 0.03, 0.01],
            }
        )

        train = df[df["season"] == 2020]
        table, global_means = fit_expected_wp_table(train)
        applied = apply_expected_wp(
            df[df["season"] == 2025],
            table,
            global_means,
            min_plays_per_decision=1,
            max_field_goal_distance=60,
        )

        self.assertIn("exp_wp_go", applied.columns)
        self.assertIn("exp_wp_best", applied.columns)
        self.assertIn("low_sample_flag", applied.columns)
        self.assertEqual(len(applied), 1)

    def test_summarize_expected_wp(self) -> None:
        df = pd.DataFrame(
            {
                "season": [2020, 2025],
                "posteam": ["BUF", "NYJ"],
                "decision": ["go", "punt"],
                "post_wp": [0.55, 0.45],
                "exp_wp_actual": [0.56, 0.44],
                "exp_wp_best": [0.57, 0.5],
                "exp_wp_best_minus_actual": [0.01, 0.06],
            }
        )

        summary = summarize_expected_wp(
            df, team="NYJ", team_seasons=[2025], league_seasons=[2020]
        )
        self.assertEqual(set(summary["scope"]), {"league", "NYJ"})


if __name__ == "__main__":
    unittest.main()
