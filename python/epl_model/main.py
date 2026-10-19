"""
main.py
-------
FastAPI REST API for the EPL Dixon-Coles prediction engine.

Startup sequence:
  1. Load historical match data (SQLite cache → download → mock fallback)
  2. Fit the time-decay Dixon-Coles model
  3. Serve predictions via HTTP

Usage:
  python main.py
  # or
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import logging
import sys
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from data_loader import load_match_data
from dixon_coles import DixonColesModel, fit_model
from signals import BacktestResult, PredictionResult, Signal, backtest, predict

# ─── Logging ──────────────────────────────────────────────────────────────────
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ─── Global Application State ────────────────────────────────────────────────
# Using module-level globals allows the lifespan context to populate them
# on startup and the endpoint handlers to read them at request time.

_model: Optional[DixonColesModel] = None
_match_df = None   # pd.DataFrame | None


def _get_model() -> DixonColesModel:
    """Retrieve the fitted model or raise 503 if not yet initialized."""
    if _model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not yet initialized. Please retry shortly.",
        )
    return _model


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load data and fit model on startup; log shutdown on exit."""
    global _model, _match_df
    logger.info("⚡ EPL engine starting — loading match data...")
    _match_df = load_match_data()
    logger.info("📊 Fitting Dixon-Coles model on %d matches...", len(_match_df))
    _model = fit_model(_match_df)
    logger.info(
        "✅ Model ready — %d teams | converged=%s | γ=%.4f | ρ=%.4f",
        len(_model.teams), _model.converged,
        _model.home_advantage, _model.rho,
    )
    yield
    logger.info("🛑 EPL engine shutting down.")


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="EPL Dixon-Coles Prediction Engine",
    description=(
        "Production-grade English Premier League match prediction API using a "
        "time-decay Dixon-Coles bivariate Poisson model with Quarter-Kelly staking."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Pydantic Schemas ─────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


class ModelInfoResponse(BaseModel):
    status:         str
    n_teams:        int
    n_matches:      int
    converged:      bool
    home_advantage: float = Field(..., description="Log-scale home advantage (gamma)")
    rho:            float = Field(..., description="Low-score correlation parameter")
    xi:             float = Field(..., description="Time-decay rate used for fitting")


class TeamRatingSchema(BaseModel):
    team:        str
    attack:      float = Field(..., description="Log-scale attack strength (alpha)")
    defense:     float = Field(..., description="Log-scale defense weakness (beta)")
    attack_exp:  float = Field(..., description="Exponentiated attack (relative scoring rate)")
    defense_exp: float = Field(..., description="Exponentiated defense (relative concede rate)")


class TeamListResponse(BaseModel):
    teams:              list[TeamRatingSchema]
    home_advantage:     float
    rho:                float
    n_matches_trained:  int
    converged:          bool


class BetSignalSchema(BaseModel):
    outcome:        str   = Field(..., description="'home' | 'draw' | 'away'")
    signal:         str   = Field(..., description="NO_BET | VALUE | STRONG_VALUE")
    label:          str
    p_model:        float = Field(..., description="Model probability for this outcome")
    implied_prob:   float = Field(..., description="Market implied probability (1/odds)")
    odds_bookmaker: float
    fair_odds:      float = Field(..., description="Fair value odds = 1/p_model")
    edge:           float = Field(..., description="Expected value: p_model * odds - 1")
    stake_pct:      float = Field(..., description="Quarter-Kelly fraction of bankroll")


class PredictionResponse(BaseModel):
    home_team:              str
    away_team:              str
    lambda_home:            float  = Field(..., description="Expected home goals (xG)")
    lambda_away:            float  = Field(..., description="Expected away goals (xG)")
    p_home:                 float
    p_draw:                 float
    p_away:                 float
    p_over25:               float  = Field(..., description="P(total goals > 2.5)")
    p_under25:              float  = Field(..., description="P(total goals < 2.5)")
    most_likely_score:      str    = Field(..., description="e.g. '1-1'")
    score_matrix:           list[list[float]] = Field(
        ...,
        description="6×6 probability matrix. mat[home_goals][away_goals]",
    )
    signals:                list[BetSignalSchema]


class BacktestRequest(BaseModel):
    xi:                 float = Field(0.0065, ge=0.001,  le=0.05,  description="Time-decay rate")
    min_train_matches:  int   = Field(200,    ge=50,     le=1000,  description="Minimum training set size")
    edge_threshold:     float = Field(0.04,   ge=0.01,   le=0.25,  description="Minimum edge to place simulated bet")
    window_weeks:       int   = Field(4,      ge=1,      le=16,    description="Rolling window size in weeks")


class BacktestMatchDetail(BaseModel):
    date:     str
    home:     str
    away:     str
    actual:   str
    true_out: str
    p_home:   float
    p_draw:   float
    p_away:   float
    bets:     list[dict]


class BacktestResponse(BaseModel):
    n_matches:    int
    # Calibration
    brier_home:   float
    brier_draw:   float
    brier_away:   float
    brier_avg:    float
    log_loss:     float
    # ROI
    roi_home:     float
    roi_draw:     float
    roi_away:     float
    roi_overall:  float
    # Betting summary
    total_bets:   int
    winning_bets: int
    win_rate:     float
    details:      list[dict]


class RefreshResponse(BaseModel):
    status:  str
    message: str


# ─── Signal Label Mapping ─────────────────────────────────────────────────────

_SIGNAL_LABELS: dict[Signal, str] = {
    Signal.NO_BET:       "⬜ No Bet",
    Signal.VALUE:        "🟡 Value",
    Signal.STRONG_VALUE: "🟢 Strong Value",
}


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/", response_model=HealthResponse, tags=["Health"])
def health_check():
    """Service liveness check."""
    return HealthResponse(
        status="ok",
        service="EPL Dixon-Coles Prediction Engine",
        version="1.0.0",
    )


@app.get("/api/v1/epl/info", response_model=ModelInfoResponse, tags=["Model"])
def model_info():
    """
    Return current model metadata: convergence status, home advantage,
    rho (low-score correlation), and number of matches trained on.
    """
    m = _get_model()
    return ModelInfoResponse(
        status="ready",
        n_teams=len(m.teams),
        n_matches=m.n_matches,
        converged=m.converged,
        home_advantage=round(m.home_advantage, 4),
        rho=round(m.rho, 4),
        xi=round(m.xi, 4),
    )


@app.get("/api/v1/epl/teams", response_model=TeamListResponse, tags=["Teams"])
def get_teams():
    """
    Return all active EPL teams sorted by attack rating (strongest first),
    along with global model parameters.
    """
    m = _get_model()
    ratings = m.team_ratings()
    teams = [
        TeamRatingSchema(
            team=row["team"],
            attack=row["attack"],
            defense=row["defense"],
            attack_exp=row["attack_exp"],
            defense_exp=row["defense_exp"],
        )
        for _, row in ratings.iterrows()
    ]
    return TeamListResponse(
        teams=teams,
        home_advantage=round(m.home_advantage, 4),
        rho=round(m.rho, 4),
        n_matches_trained=m.n_matches,
        converged=m.converged,
    )


@app.get("/api/v1/epl/predict", response_model=PredictionResponse, tags=["Prediction"])
def predict_match(
    home: str = Query(..., description="Home team name (e.g. 'Arsenal')"),
    away: str = Query(..., description="Away team name (e.g. 'Chelsea')"),
    odds_h: Optional[float] = Query(
        None, ge=1.01, le=100.0,
        description="Decimal home win odds (e.g. 2.10). Required for bet signals.",
    ),
    odds_d: Optional[float] = Query(
        None, ge=1.01, le=100.0,
        description="Decimal draw odds (e.g. 3.40).",
    ),
    odds_a: Optional[float] = Query(
        None, ge=1.01, le=100.0,
        description="Decimal away win odds (e.g. 3.60).",
    ),
):
    """
    Predict an EPL fixture.

    Returns:
    - Expected goals (xG) for home and away
    - 3-way match outcome probabilities (home / draw / away)
    - Over/Under 2.5 goals probabilities
    - Most probable exact scoreline
    - 6×6 score probability matrix
    - Bet signals with Quarter-Kelly stakes (if odds are provided)

    Team names are matched case-insensitively. Call `/api/v1/epl/teams`
    to see valid team names.
    """
    m = _get_model()

    # Case-insensitive team name resolution
    team_map = {t.lower(): t for t in m.teams}
    home_resolved = team_map.get(home.lower().strip())
    away_resolved = team_map.get(away.lower().strip())

    if not home_resolved:
        raise HTTPException(
            status_code=404,
            detail=f"Home team '{home}' not found. Valid teams: {sorted(m.teams)}",
        )
    if not away_resolved:
        raise HTTPException(
            status_code=404,
            detail=f"Away team '{away}' not found. Valid teams: {sorted(m.teams)}",
        )
    if home_resolved == away_resolved:
        raise HTTPException(
            status_code=400,
            detail="Home and away teams must be different.",
        )

    try:
        result: PredictionResult = predict(
            m, home_resolved, away_resolved, odds_h, odds_d, odds_a
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Prediction error for %s vs %s", home, away)
        raise HTTPException(status_code=500, detail=str(exc))

    signals_out = [
        BetSignalSchema(
            outcome=s.outcome,
            signal=s.signal.value,
            label=_SIGNAL_LABELS.get(s.signal, ""),
            p_model=s.p_model,
            implied_prob=s.implied_prob,
            odds_bookmaker=s.odds_bookmaker,
            fair_odds=s.fair_odds,
            edge=s.edge,
            stake_pct=s.stake_pct,
        )
        for s in result.signals
    ]

    return PredictionResponse(
        home_team=result.home_team,
        away_team=result.away_team,
        lambda_home=result.lambda_home,
        lambda_away=result.lambda_away,
        p_home=result.p_home,
        p_draw=result.p_draw,
        p_away=result.p_away,
        p_over25=result.p_over25,
        p_under25=result.p_under25,
        most_likely_score=(
            f"{result.most_likely_home_goals}-{result.most_likely_away_goals}"
        ),
        score_matrix=result.score_matrix,
        signals=signals_out,
    )


@app.post("/api/v1/epl/backtest", response_model=BacktestResponse, tags=["Backtest"])
def run_backtest(body: BacktestRequest):
    """
    Execute a walk-forward chronological backtest over the full historical dataset.

    **Algorithm:**
    Re-fits the model at each rolling window boundary using all prior data,
    then predicts every match in the next `window_weeks` window. Tracks
    calibration (Brier score, log loss) and simulated ROI via Quarter-Kelly staking.

    ⚠️ **This may take 30–90 seconds** depending on dataset size and window size.

    **Interpreting results:**
    - Brier score ≈ 0.20–0.23 is typical for a well-calibrated soccer model.
    - Log loss ≈ 0.95–1.05 is competitive.
    - ROI > 0 indicates positive expected value vs. closing market odds.
    """
    global _match_df
    if _match_df is None or len(_match_df) == 0:
        raise HTTPException(status_code=503, detail="Match data not available.")

    try:
        result: BacktestResult = backtest(
            _match_df,
            xi=body.xi,
            min_train_matches=body.min_train_matches,
            edge_threshold=body.edge_threshold,
            window_weeks=body.window_weeks,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Backtest failed")
        raise HTTPException(status_code=500, detail=str(exc))

    return BacktestResponse(
        n_matches=result.n_matches,
        brier_home=result.brier_home,
        brier_draw=result.brier_draw,
        brier_away=result.brier_away,
        brier_avg=result.brier_avg,
        log_loss=result.log_loss,
        roi_home=result.roi_home,
        roi_draw=result.roi_draw,
        roi_away=result.roi_away,
        roi_overall=result.roi_overall,
        total_bets=result.total_bets,
        winning_bets=result.winning_bets,
        win_rate=result.win_rate,
        details=result.details,
    )


@app.post("/api/v1/epl/refresh", response_model=RefreshResponse, tags=["Admin"])
async def refresh_model(background_tasks: BackgroundTasks):
    """
    Trigger a background re-download of match data and model re-fit.

    Returns immediately; the model continues serving the previous version
    until the background task completes.
    """
    def _do_refresh():
        global _model, _match_df
        logger.info("🔄 Refreshing match data and model...")
        try:
            _match_df = load_match_data(force_refresh=True)
            _model    = fit_model(_match_df)
            logger.info(
                "✅ Refresh complete — %d matches | converged=%s",
                len(_match_df), _model.converged,
            )
        except Exception as exc:
            logger.error("❌ Refresh failed: %s", exc)

    background_tasks.add_task(_do_refresh)
    return RefreshResponse(
        status="scheduled",
        message="Data refresh and model re-fit running in background.",
    )


# ─── Entrypoint ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
    )
