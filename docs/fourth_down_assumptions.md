# Fourth-Down Model Assumptions

Last updated: 2026-02-09
Current decision match rate (NYJ 2025): 75.0%
Current low-sample flag rate (NYJ 2025): 0.0%

## Purpose
Track all non-obvious modeling choices for the fourth-down recommendation system so assumptions are explicit, reviewable, and auditable over time.

## Scope
- Data source: NFL play-by-play (`nflfastR`-style parquet exports in `data/`)
- Current recommendation target: NYJ 2025 fourth-down situations
- Training window currently used in build script: 2016-2024

## Data And Labels
- Use only fourth-down plays after preprocessing in `src/fourth_down.py`.
- Decision label space is restricted to:
  - `go`
  - `punt`
  - `field_goal`
- Recommendation is selected from expected post-play WP estimates by decision.

## Core WP Construction
- Post-play WP proxy is computed as:
  - `post_wp = wp + wpa`
- Expected WP by decision is estimated from historical bucket averages.
- Bucketing dimensions:
  - `ydstogo_bin`
  - `yardline_bin`
  - `yardline_25_bin` (fallback use)
  - `score_diff_bin`
  - `time_bin`

## Recency Weighting (Training)
Applied in `fit_expected_wp_table`:
- 2016-2017: `0.80`
- 2018-2019: `0.85`
- 2020-2021: `0.90`
- 2022-2023: `0.95`
- 2024: `1.00`

## Fallback Hierarchy (No Global Fill)
Expected WP fallback order (from most to least specific):
1. `ydstogo_bin + yardline_bin + score_diff_bin + time_bin`
2. `ydstogo_bin + yardline_bin + score_diff_bin`
3. `ydstogo_bin + score_diff_bin`
4. `ydstogo_bin + yardline_25_bin`
5. `ydstogo_bin`

Notes:
- `global_means` are fitted but not used for recommendation fill in the current path.
- Minimum weighted plays per decision bucket defaults to `20`.

## Hard Feasibility Guardrails
- Field goal option disabled when expected kick distance exceeds max (`yardline_100 + 17 > 60`).
- Punt option disabled inside opponent territory threshold (`yardline_100 <= 45`).

## Strategy Layer (Recommendation-Time Only)
These adjust *effective* recommendation values without mutating raw modeled WP columns.

### Existing Policy Boost
- Goal-line leverage boost to GO (`go_policy_boost = 0.03`) when:
  - within opponent 5, and
  - either trailing by 10+ or in Q4.

### Must-Score Override
- Force GO effective value to `1.0` when all are true:
  - Q4
  - `game_seconds_remaining <= 480`
  - trailing by 4+
  - `yardline_100 <= 3`
  - `ydstogo <= 2`

### Lead Management Hybrid Rule
- Penalize GO effective value by factor `0.75` in conservative lead states, including:
  - leading by 1+
  - deep in own side (`yardline_100` thresholds in code)
  - distance-to-go thresholds in code
  - quarter/time gates in code

### Desperation Red-Zone Rule
- In late Q4, large deficit, red-zone, and manageable distance:
  - block FG effective option

### Early Red-Zone Mild Aggression Nudge
- In Q1-Q3, trailing by 10+, red-zone, short-to-go:
  - GO effective `+0.10`
  - FG effective `* 0.75`

### Two-Minute Trailing Aggression Rule
- In Q4 with 2:00 or less, while trailing, and with manageable field/distance:
  - GO effective `+0.18`
- Trigger scope in code:
  - `game_seconds_remaining <= 120`
  - `score_differential < 0`
  - `yardline_100 <= 60`
  - `ydstogo <= 10`
  - audit flag: `rule_go_boost_two_minute_trailing`

### Ultra-Long Distance Brake
- Block GO effective option on very long distance unless explicit late-desperation exception applies.

## Break-Even (UI)
Current state:
- The card-back `Break-even` value is currently a display placeholder mapped to `exp_wp_punt`.
- It is **not** a true conversion break-even threshold in the current pipeline.

## Recommendation Display Consistency
- Front-card Win% values are rendered from strategy-adjusted effective columns:
  - `exp_wp_go_display`
  - `exp_wp_punt_display`
  - `exp_wp_field_goal_display`
- Recommendation is selected from the same effective values (`best_decision`), so displayed odds and recommendation are numerically aligned.
- Recommendation edge shown in UI is:
  - `exp_wp_recommendation_edge = best_effective_wp - second_best_effective_wp`

What true break-even would mean:
- Break-even conversion probability for `GO` is the minimum success rate where `GO` and baseline option are equal in expected WP.
- If baseline is `Punt`, then:
  - `p_break_even = (WP_punt - WP_go_fail) / (WP_go_success - WP_go_fail)`
- Definitions:
  - `WP_punt`: expected post-play WP if punting
  - `WP_go_success`: expected post-play WP if conversion succeeds
  - `WP_go_fail`: expected post-play WP if conversion fails

Why it is not implemented yet:
- Current model stores outcome-level expected post-play WP by decision (`go/punt/field_goal`) but does not split `GO` into success/failure states.
- Without separate `WP_go_success` and `WP_go_fail`, true break-even cannot be computed directly.

If implemented later:
- Add success/failure-conditioned GO estimates from historical data.
- Compute and export `go_break_even_conversion_prob` as a dedicated artifact column.
- Update card label from placeholder to true break-even.

## Low-Sample Flag
- `low_sample_flag` is based on raw data coverage count, not strategy-blocked effective options.
- Current criterion:
  - `valid_decision_count < 2`

## Current Known Limitations
- Estimates are observational (historical outcomes), not full counterfactual simulation.
- Strategy layer is heuristic and intentionally opinionated; it can improve practical recommendations while reducing pure model transparency.
- Range selector UI currently may be cosmetic unless range-specific card CSVs are generated and synced.

## Suggested Change Log Practice
For each tweak, append:
- date
- file(s) changed
- assumption changed
- reason
- observed impact (match rate, low-sample %, notable scenario changes)

## Change Log
- 2026-02-09: Created this assumptions tracker.
- 2026-02-09: Added break-even explainer and clarified current UI placeholder behavior.
- 2026-02-09: Added two-minute trailing GO boost rule and refreshed top-line NYJ 2025 metrics.
