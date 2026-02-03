"""Tests for interception diagnostic utilities."""
from __future__ import annotations

import unittest

import pandas as pd

from src.interceptions import (
    apply_int_model,
    build_pass_defense_frame,
    build_season_comparison,
    fit_int_model,
    summarize_per_game,
)


class TestInterceptions(unittest.TestCase):
    def test_build_pass_defense_frame(self) -> None:
        df = pd.DataFrame(
            {
                "season": [2024, 2024, 2024],
                "game_id": ["1", "1", "1"],
                "game_date": ["2024-09-01"] * 3,
                "week": [1, 1, 1],
                "posteam": ["BUF", "BUF", "BUF"],
                "defteam": ["NYJ", "NYJ", "NYJ"],
                "pass_attempt": [1, 1, 0],
                "interception": [0, 1, 0],
                "play_type": ["pass", "pass", "run"],
                "pass_defense_1_player_id": ["x", None, None],
                "qb_hit": [1, 0, 0],
                "sack": [0, 1, 0],
            }
        )

        out = build_pass_defense_frame(df, team="NYJ", seasons=[2024])
        self.assertEqual(len(out), 2)
        self.assertIn("pass_defense", out.columns)

    def test_model_flow(self) -> None:
        df = pd.DataFrame(
            {
                "season": [2020] * 6000,
                "game_id": ["1"] * 6000,
                "game_date": ["2020-09-01"] * 6000,
                "week": [1] * 6000,
                "posteam": ["BUF"] * 6000,
                "defteam": ["NYJ"] * 6000,
                "pass_attempt": [1] * 6000,
                "interception": [0] * 5990 + [1] * 10,
                "play_type": ["pass"] * 6000,
                "air_yards": [10] * 6000,
                "pass_length": ["short"] * 6000,
                "pass_location": ["middle"] * 6000,
                "score_differential": [0] * 6000,
                "game_seconds_remaining": [1200] * 6000,
                "qb_hit": [0] * 6000,
                "sack": [0] * 6000,
            }
        )

        train = build_pass_defense_frame(df, team="NYJ", seasons=[2020])
        model = fit_int_model(train)
        scored = apply_int_model(model, train)
        self.assertIn("expected_int_prob", scored.columns)
        self.assertIn("int_feature_impact_note", scored.columns)

        summary = build_season_comparison(scored, scored)
        self.assertEqual(set(summary["scope"]), {"League 2016-2024", "NYJ 2025"})

    def test_summarize_per_game(self) -> None:
        df = pd.DataFrame(
            {
                "game_id": ["1", "1", "2"],
                "game_date": ["2025-09-01", "2025-09-01", "2025-09-08"],
                "week": [1, 1, 2],
                "home_team": ["NYJ", "NYJ", "NYJ"],
                "away_team": ["BUF", "BUF", "BUF"],
                "pass_attempt": [1, 1, 1],
                "interception": [0, 1, 0],
                "pass_defense": [1, 0, 1],
                "qb_hit": [0, 1, 0],
                "sack": [0, 0, 0],
                "expected_ints": [0.01, 0.02, 0.01],
            }
        )
        games = df[["game_id", "game_date", "week", "home_team", "away_team"]].drop_duplicates()
        summary = summarize_per_game(df, games)
        self.assertEqual(len(summary), 2)


if __name__ == "__main__":
    unittest.main()
