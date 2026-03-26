# Jets-DAT

Jets-DAT is a football analytics project focused on two Jets use cases:

- 4th-down decision support
- interception/takeaway opportunity analysis

The live app is available at `https://jetsdata.vercel.app`.

## What This Is

This repository contains the code behind the live Jets-DAT site. Most visitors do not need to build anything locally to use the project. If you just want the experience, use the deployed app.

## What The App Does

- analyzes 4th-down decisions using historical NFL play-by-play data
- evaluates interception opportunity and takeaway trends
- presents the results in a lightweight web dashboard

## Repo Overview

- `src/`: core Python logic
- `scripts/`: artifact build scripts
- `artifacts/`: generated CSV outputs
- `frontend/`: dashboard app
- `docs/`: supporting notes and assumptions
- `tests/`: Python tests

## For Developers

Local setup is only needed if you want to inspect, modify, or rebuild the project.

### Python

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Build Artifacts

```bash
python3.11 scripts/build_fourth_down_model.py --train-start 2016 --train-end 2024 --eval-season 2025 --team NYJ
python3.11 scripts/build_interception_diagnostic.py --train-start 2016 --train-end 2024 --eval-season 2025 --team NYJ --add-drive-detail
python3.11 scripts/sync_frontend_data.py
```

### Tests

```bash
python3.11 -m unittest discover -s tests
cd frontend && npm run test
```

## Notes

- The current project is Jets-focused, not a general-purpose multi-team product.
- The 4th-down modeling assumptions are tracked in `docs/fourth_down_assumptions.md`.
- No environment variables are required for the default static frontend flow.
