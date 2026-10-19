# EPL Dixon-Coles Prediction Engine

Production-grade English Premier League match prediction API built with **FastAPI** and a **time-decay Dixon-Coles bivariate Poisson model**.

## Quick Start

```bash
cd python/epl_model
pip install -r requirements.txt
python main.py
# API now live at http://localhost:8000
# Swagger UI: http://localhost:8000/docs
```

On first start the engine will:
1. Attempt to download 6 seasons of EPL data from [football-data.co.uk](https://www.football-data.co.uk)
2. Cache results to `data/epl_matches.db` (SQLite)
3. Fit the Dixon-Coles model (~5–15 seconds)
4. Serve predictions

If the download fails the engine falls back to its built-in mock dataset so it's always runnable offline.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `GET` | `/api/v1/epl/info` | Model metadata & convergence |
| `GET` | `/api/v1/epl/teams` | All teams + attack/defense ratings |
| `GET` | `/api/v1/epl/predict` | Fixture prediction + bet signals |
| `POST` | `/api/v1/epl/backtest` | Walk-forward backtest |
| `POST` | `/api/v1/epl/refresh` | Background data refresh + re-fit |

### Example: Predict a Match

```
GET /api/v1/epl/predict?home=Arsenal&away=Chelsea&odds_h=2.10&odds_d=3.40&odds_a=3.60
```

```json
{
  "home_team": "Arsenal",
  "away_team": "Chelsea",
  "lambda_home": 1.8432,
  "lambda_away": 1.2871,
  "p_home": 0.487,
  "p_draw": 0.241,
  "p_away": 0.272,
  "p_over25": 0.563,
  "p_under25": 0.437,
  "most_likely_score": "1-1",
  "score_matrix": [...],
  "signals": [
    {
      "outcome": "home",
      "signal": "VALUE",
      "label": "🟡 Value",
      "edge": 0.0623,
      "stake_pct": 0.0124,
      ...
    }
  ]
}
```

---

## Model Details

### Dixon-Coles Bivariate Poisson

**Expected goals:**
```
λ_home = exp(α_home + β_away + γ)
λ_away = exp(α_away + β_home)
```

**Parameters:**
| Symbol | Description | Typical Range |
|---|---|---|
| `α_i` | Attack strength (log scale) | ±0.5 |
| `β_j` | Defense weakness (log scale) | ±0.4 |
| `γ` | Home advantage | 0.25–0.35 |
| `ρ` | Low-score correlation | −0.15 to 0 |
| `ξ` | Time-decay rate | 0.0065 |

**Low-score tau correction** (`ρ < 0` adjusts for soccer's observed score dependence):
- `(0,0)`: τ = 1 − λ·μ·ρ  → inflated
- `(1,0)`: τ = 1 + μ·ρ
- `(0,1)`: τ = 1 + λ·ρ
- `(1,1)`: τ = 1 − ρ

**Fitting:** L-BFGS-B via `scipy.optimize.minimize`. Post-fit identifiability enforced by shifting α so Σα = 0.

**Time decay:** `w_t = exp(−ξ · days_ago)`. With ξ = 0.0065, a match 3 months ago has weight ≈ 0.53.

### Bet Signal Tiers

| Signal | Edge | Kelly Stake |
|---|---|---|
| `NO_BET` | < 4% | 0% |
| `VALUE` | 4–8% | Quarter-Kelly |
| `STRONG_VALUE` | ≥ 8% | Quarter-Kelly |

**Quarter-Kelly formula:**
```
stake_pct = max(0, 0.25 × ((odds − 1) × p − (1 − p)) / (odds − 1))
```

---

## Running Tests

```bash
cd python/epl_model
pytest tests/ -v
```

All tests use the built-in mock dataset — no internet connection required.

---

## File Structure

```
python/epl_model/
├── data_loader.py   # Download, SQLite cache, standardization, mock fallback
├── dixon_coles.py   # Model definition, vectorized log-likelihood, fitting
├── signals.py       # Signal generation, Kelly staking, walk-forward backtest
├── main.py          # FastAPI app — all endpoints
├── tests/
│   ├── test_data_loader.py
│   ├── test_dixon_coles.py
│   ├── test_signals.py
│   └── test_api.py
├── data/            # SQLite DB (auto-created, .gitignore this)
└── requirements.txt
```
