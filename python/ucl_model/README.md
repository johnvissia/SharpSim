# UEFA Champions League (UCL) Prediction Engine

Standalone production REST API and Cross-League Bivariate Poisson prediction engine for the **UEFA Champions League**.

## Features

- **Cross-League Quality Coefficients**: Adjusts for domestic league difficulty (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie, Liga Portugal, etc.).
- **Neutral Venue Modeling**: Supports zero-home-advantage mode for neutral venue fixtures (e.g., Champions League Final).
- **Both Teams to Score (BTTS)**: Full probability breakdown for BTTS Yes / No alongside Over/Under 2.5 goals.
- **Quarter-Kelly Staking**: Staking sizing calculation based on true model edge vs bookmaker lines.
- **Walk-Forward Chronological Backtesting**: Measures Brier Score, Multiclass Log Loss, and simulated ROI.

## Quick Start

```bash
cd python/ucl_model
pip install -r requirements.txt
python main.py
# API live on port 8001: http://localhost:8001
# Interactive docs: http://localhost:8001/docs
```

## Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `GET` | `/api/v1/ucl/info` | Model metadata & parameters |
| `GET` | `/api/v1/ucl/teams` | Active UCL clubs + attack/defense ratings |
| `GET` | `/api/v1/ucl/predict` | Fixture prediction, xG, probabilities, signals |
| `POST` | `/api/v1/ucl/backtest` | Walk-forward chronological backtest |
| `POST` | `/api/v1/ucl/refresh` | Background data reload and refit |
