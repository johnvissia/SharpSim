'use client';

import { useEffect, useState } from 'react';
import { Game } from '@/lib/types';
import { Loader2, BrainCircuit, Trophy, TrendingUp } from 'lucide-react';
import { fetchEspnSchedule } from '@/lib/espn';
import { SoccerInsightsModal } from '@/components/dashboard/SoccerInsightsModal';

interface SoccerPrediction {
  homeTeam: string;
  awayTeam: string;
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  predictedMargin: number;
  projectedSpread: number;
  marketSpread: number | null;
  recommendedSide: string | null;
  modelPick: string | null;
  coverProb: number;
  winProbHome: number;
  winProbAway: number;
  drawProb: number;
  betSignal: 'ELITE VALUE' | 'STRONG VALUE' | 'PLAYABLE' | 'No Play';
  confidence: string;
  zScore: number;
  marketLine: number | null;
}

interface PredictionResult {
  game: Game;
  prediction: SoccerPrediction | null;
  isLoading: boolean;
  error: string | null;
  rank?: number;
}

function SoccerPredictionCard({ game, prediction, isLoading, error, rank = 1 }: PredictionResult) {
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 h-64 flex items-center justify-center animate-pulse">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (error || !prediction) {
    return (
      <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-5 flex items-center justify-center h-32">
        <span className="text-red-400 text-sm font-medium">Unavailable: {error ?? 'No prediction data'}</span>
      </div>
    );
  }

  let startTime = '';
  try {
    startTime = new Date(game.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    startTime = game.startTime;
  }

  const timeDisplay = game.statusState === 'in'
    ? (game.statusDetail || 'LIVE')
    : game.statusState === 'post'
    ? (game.statusDetail || 'FT')
    : startTime;

  const awayGoalsDisplay = (prediction.predictedAwayGoals !== undefined && !isNaN(prediction.predictedAwayGoals))
    ? prediction.predictedAwayGoals.toFixed(1)
    : '0.0';
  const homeGoalsDisplay = (prediction.predictedHomeGoals !== undefined && !isNaN(prediction.predictedHomeGoals))
    ? prediction.predictedHomeGoals.toFixed(1)
    : '0.0';

  const winAway = Number(prediction.winProbAway ?? 0);
  const drawProb = Number(prediction.drawProb ?? 0);
  const winHome = Number(prediction.winProbHome ?? 0);

  const homeGoals = Number(prediction.predictedHomeGoals ?? 1.2);
  const awayGoals = Number(prediction.predictedAwayGoals ?? 1.0);

  const spreadEdge = Math.abs((prediction.marketSpread ?? 0) - (prediction.projectedSpread ?? 0));
  let confidenceLabel = 'No Play';
  let stars = 0;
  if (prediction.betSignal === 'ELITE VALUE' || (spreadEdge >= 1.05 && (prediction.coverProb ?? 0) >= 58)) {
    confidenceLabel = 'High Edge';
    stars = 3;
  } else if (prediction.betSignal === 'STRONG VALUE' || (spreadEdge >= 0.70 && (prediction.coverProb ?? 0) >= 55)) {
    confidenceLabel = 'Solid Edge';
    stars = 2;
  } else if (prediction.betSignal === 'PLAYABLE' || (spreadEdge >= 0.35 && (prediction.coverProb ?? 0) >= 52.5)) {
    confidenceLabel = 'Lean';
    stars = 1;
  } else {
    confidenceLabel = 'No Play';
    stars = 0;
  }

  const coverProb = prediction.coverProb ?? Math.max(winHome, winAway);
  const probText = `${coverProb}% Cover Prob`;
  const starDisplay = stars > 0 ? ('★'.repeat(stars) + '☆'.repeat(3 - stars)) : '';

  return (
    <>
      <div
        onClick={() => setIsInsightsOpen(true)}
        className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-700 hover:shadow-xl hover:shadow-indigo-950/20 cursor-pointer select-none transition-all group"
      >
        {/* Top Row: Meta */}
        <div className="flex items-center justify-between text-xs">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-200 font-bold text-[11px]">
            <span>#{rank} · UEFA Champions League</span>
          </div>
          <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            {game.statusState === 'in' ? (
              <span className="text-red-400 font-bold animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                {timeDisplay}
              </span>
            ) : (
              <span>{timeDisplay}</span>
            )}
          </div>
        </div>

        {/* Middle Section: Matchup & Expected Goals */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1">
          {/* Away Team */}
          <div className="flex items-center gap-3 min-w-0">
            {game.awayTeam?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={game.awayTeam.logo}
                alt={game.awayTeam.name || 'Away'}
                className="w-9 h-9 object-contain shrink-0 drop-shadow"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold shrink-0">
                {game.awayTeam?.name?.slice(0, 2) || 'A'}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate" title={game.awayTeam?.name}>
                {game.awayTeam?.name || 'Away'}
              </div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">
                <span className="text-slate-200 font-bold font-mono">{awayGoalsDisplay}</span> xG
              </div>
            </div>
          </div>

          {/* Center VS */}
          <div className="flex flex-col items-center justify-center px-2">
            <span className="text-[11px] font-black tracking-wider text-slate-500 uppercase">
              VS
            </span>
          </div>

          {/* Home Team */}
          <div className="flex items-center justify-end gap-3 min-w-0 text-right">
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate" title={game.homeTeam?.name}>
                {game.homeTeam?.name || 'Home'}
              </div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">
                <span className="text-slate-200 font-bold font-mono">{homeGoalsDisplay}</span> xG
              </div>
            </div>
            {game.homeTeam?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={game.homeTeam.logo}
                alt={game.homeTeam.name || 'Home'}
                className="w-9 h-9 object-contain shrink-0 drop-shadow"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold shrink-0">
                {game.homeTeam?.name?.slice(0, 2) || 'H'}
              </div>
            )}
          </div>
        </div>

        {/* Model Callout Banner - Explicit Spread Pick against Market */}
        <div className={`text-xs font-medium py-2 px-3 rounded-xl flex items-center justify-center text-center border ${
          stars > 0 
            ? 'bg-emerald-950/30 border-emerald-500/20 text-emerald-300' 
            : 'bg-slate-900/80 border-slate-800 text-slate-300'
        }`}>
          <span>
            {stars > 0 ? (
              <>
                <span className="font-semibold text-emerald-200">Model Pick:</span> {prediction.modelPick || 'No Play'}
                {' · '}{probText} ({confidenceLabel} <span className="text-amber-400 font-mono tracking-tight">{starDisplay}</span>)
              </>
            ) : (
              <>
                <span className="font-semibold text-slate-400">Model Lean:</span> {prediction.modelPick || 'Pass'}
                {' · '}{probText} (<span className="text-slate-400 font-semibold">Pass · Low Edge</span>)
              </>
            )}
          </span>
        </div>

        {/* Bottom Section: Outcome Probability Bar */}
        <div className="space-y-1.5 pt-1">
          {/* Percentage Labels directly above segments */}
          <div className="flex justify-between items-center text-[11px] font-bold font-mono px-0.5">
            <span className="text-indigo-400">{winAway.toFixed(0)}%</span>
            <span className="text-slate-400">{drawProb.toFixed(0)}%</span>
            <span className="text-emerald-400">{winHome.toFixed(0)}%</span>
          </div>

          {/* Tri-color Probability Bar */}
          <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-950 border border-slate-800">
            <div
              className="bg-indigo-500 transition-all"
              style={{ width: `${Math.max(winAway, 2)}%` }}
            />
            <div
              className="bg-slate-600 transition-all"
              style={{ width: `${Math.max(drawProb, 2)}%` }}
            />
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${Math.max(winHome, 2)}%` }}
            />
          </div>

          {/* Labels Below */}
          <div className="grid grid-cols-3 gap-2 pt-0.5 text-[10px] font-semibold text-slate-400">
            <div className="truncate">{game.awayTeam?.name || 'Away'}</div>
            <div className="text-center text-slate-500">Draw</div>
            <div className="text-right truncate">{game.homeTeam?.name || 'Home'}</div>
          </div>
        </div>
      </div>

      <SoccerInsightsModal
        open={isInsightsOpen}
        onOpenChange={setIsInsightsOpen}
        homeTeam={game.homeTeam?.name || 'Home'}
        awayTeam={game.awayTeam?.name || 'Away'}
        homeLogo={game.homeTeam?.logo}
        awayLogo={game.awayTeam?.logo}
        leagueName="UEFA Champions League"
        predictedHomeGoals={homeGoals}
        predictedAwayGoals={awayGoals}
        winProbHome={winHome}
        winProbAway={winAway}
        drawProb={drawProb}
        modelPick={prediction.modelPick}
        coverProb={prediction.coverProb}
        marketSpread={prediction.marketSpread}
      />
    </>
  );
}

export default function ChampionsLeaguePage() {
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGames() {
      setLoading(true);
      setPredictions([]);

      try {
        const [allGames, modelData] = await Promise.all([
          fetchEspnSchedule(),
          fetch('/api/model-data').then(r => r.json()).catch(() => ({ dailyGames: [] }))
        ]);

        const dailyGames = modelData?.dailyGames || [];
        const now = Date.now();

        const uclGames = allGames.filter(g => {
          if (g.sport !== 'UCL') return false;
          const gTime = new Date(g.startTime).getTime();
          const hoursAway = (gTime - now) / (3600 * 1000);
          if (g.statusState === 'in') return true;
          if (g.statusState === 'post') return hoursAway > -4;
          return hoursAway >= -4 && hoursAway <= 72;
        });

        if (uclGames.length === 0) {
          setPredictions([]);
          setLoading(false);
          return;
        }

        // Initialise with loading state
        const initial: PredictionResult[] = uclGames.map(game => ({
          game,
          prediction: null,
          isLoading: true,
          error: null,
        }));
        setPredictions(initial);

        // Fetch predictions in parallel
        const results = await Promise.all(
          uclGames.map(async (game): Promise<PredictionResult> => {
            try {
              const hNorm = game.homeTeam.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              const aNorm = game.awayTeam.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              const dg = (dailyGames as any[]).find((d: any) => {
                const dh = (d.homeTeam || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const da = (d.awayTeam || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                return (dh.includes(hNorm) || hNorm.includes(dh)) && (da.includes(aNorm) || aNorm.includes(da));
              });

              let spreadParam = '';
              if (dg?.bookmakerOdds?.[0]) {
                try {
                  const bookmaker = JSON.parse(dg.bookmakerOdds[0]);
                  const sm = bookmaker.markets?.find((m: any) => m.key === 'spreads');
                  const pt = sm?.outcomes?.find((o: any) => {
                    const on = (o.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    return on.includes(hNorm) || hNorm.includes(on);
                  })?.point;
                  if (typeof pt === 'number') spreadParam = `&marketSpread=${pt}`;
                } catch { }
              }

              const res = await fetch(
                `/api/predict-soccer?home=${encodeURIComponent(game.homeTeam.name)}&away=${encodeURIComponent(game.awayTeam.name)}&league=UCL${spreadParam}`
              );
              const json = await res.json();
              if (!res.ok) throw new Error(json.error || 'Prediction failed');
              return { game, prediction: json as SoccerPrediction, isLoading: false, error: null };
            } catch (e: any) {
              return { game, prediction: null, isLoading: false, error: e.message };
            }
          })
        );

        // Sort by |zScore| descending
        results.sort((a, b) => Math.abs(b.prediction?.zScore ?? 0) - Math.abs(a.prediction?.zScore ?? 0));
        setPredictions(results);
      } catch (e) {
        console.error('[soccer-cl] Load error:', e);
      } finally {
        setLoading(false);
      }
    }

    loadGames();
  }, []);

  return (
    <div className="container mx-auto p-4 md:p-8 relative">
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-900 flex items-center justify-center shadow-lg shadow-indigo-900/40">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <BrainCircuit className="h-7 w-7 text-indigo-400" />
                Champions League Model
              </h1>
              <p className="text-muted-foreground mt-0.5">
                Upcoming UCL fixtures ranked by statistical spread edge and goal projection.
              </p>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-3 mt-2">
            <div className="inline-flex items-center px-2.5 py-1 rounded-md border border-indigo-500/40 text-indigo-400 bg-indigo-950/30 text-[10px] font-bold uppercase tracking-wider">
              UEFA Champions League
            </div>
            <div className="inline-flex items-center px-2.5 py-1 rounded-md border border-slate-700 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              <TrendingUp className="w-3 h-3 mr-1" />
              Cross-League Poisson Model
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-64 bg-slate-900/60 border border-slate-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : predictions.length === 0 ? (
          <div className="text-center py-24 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
            <Trophy className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-300 font-bold text-base">No UCL fixtures found for today or tomorrow.</p>
            <p className="text-slate-500 text-xs mt-1.5 max-w-sm mx-auto">Check back on matchdays (Tuesdays and Wednesdays).</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {predictions.map((item, idx) => (
              <SoccerPredictionCard key={item.game.id} {...item} rank={idx + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
