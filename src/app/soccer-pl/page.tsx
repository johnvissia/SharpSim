'use client';

import { useEffect, useState } from 'react';
import { Game } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, BrainCircuit, Lock, Crown, Shield, TrendingUp, Flame } from 'lucide-react';
import { fetchEspnSchedule } from '@/lib/espn';
import { useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { ProUpgradeModal } from '@/components/dashboard/ProUpgradeModal';

interface SoccerPrediction {
  homeTeam: string;
  awayTeam: string;
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  predictedMargin: number;
  modelPick: string | null;
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
}

const signalColors: Record<string, string> = {
  'ELITE VALUE': 'text-green-400 bg-green-950/40 border-green-500/50',
  'STRONG VALUE': 'text-brand-400 bg-brand-950/40 border-brand-500/50',
  'PLAYABLE': 'text-yellow-400 bg-yellow-950/40 border-yellow-500/50',
  'No Play': 'text-slate-400 bg-slate-900 border-slate-700',
};

// EPL team primary colors for subtle accent (expandable)
const EPL_ACCENT = 'from-purple-700 to-purple-900'; // Generic EPL purple accent

function SoccerPredictionCard({ game, prediction, isLoading, error }: PredictionResult) {
  if (isLoading) {
    return (
      <Card className="bg-slate-900 border-slate-800 h-72 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </Card>
    );
  }

  if (error || !prediction) {
    return (
      <Card className="bg-red-950/20 border-red-900/50 p-4 flex items-center justify-center h-32">
        <span className="text-red-400 text-sm">Unavailable: {error ?? 'No prediction data'}</span>
      </Card>
    );
  }

  const activeColor = signalColors[prediction.betSignal] ?? signalColors['No Play'];
  const isHomePick = prediction.modelPick === game.homeTeam.name;
  const pickLogo = isHomePick ? game.homeTeam.logo : game.awayTeam.logo;
  const startTime = new Date(game.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-900">
      {/* Header */}
      <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
        <div className="flex flex-col gap-0.5">
          <div className="text-xs font-bold uppercase tracking-wider text-white">
            {game.awayTeam.name} @ {game.homeTeam.name}
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-purple-400" />
            Premier League
            <span className="text-slate-700">•</span>
            {game.statusState === 'in'
              ? <span className="text-red-400 font-bold animate-pulse">{game.statusDetail}</span>
              : game.statusState === 'post'
              ? <span className="text-slate-500">{game.statusDetail}</span>
              : startTime}
          </div>
        </div>
        {prediction.betSignal !== 'No Play' && (
          <Badge variant="outline" className={`${prediction.betSignal.includes('ELITE') ? 'bg-green-600/20 text-green-400 border-green-500/30' : 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30'} text-[10px] font-bold uppercase py-0 px-2`}>
            {prediction.betSignal}
          </Badge>
        )}
      </div>

      <CardContent className="p-5 flex flex-col gap-5">
        {/* Model Pick Box */}
        <div className={`p-4 rounded-xl border ${activeColor} relative overflow-hidden`}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-[10px] uppercase opacity-80 font-bold mb-1">Model Pick</div>
              <div className="flex items-center gap-3">
                {pickLogo && prediction.modelPick && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pickLogo} alt={prediction.modelPick} className="w-10 h-10 object-contain drop-shadow-lg" />
                )}
                <div className="text-2xl font-black text-white">
                  {prediction.modelPick ?? 'No Play'}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase opacity-80 font-bold mb-1">Z-Score</div>
              <div className="text-3xl font-black text-white">
                {prediction.zScore.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Projected Scoreline */}
        <div className="bg-slate-950/50 rounded-xl border border-slate-800 p-4">
          <div className="text-[10px] text-slate-500 uppercase font-black mb-3 tracking-wider">Projected Scoreline</div>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={game.awayTeam.logo} alt={game.awayTeam.name} className="w-8 h-8 object-contain mx-auto mb-1" />
              <div className="text-xs text-slate-400 truncate">{game.awayTeam.name}</div>
              <div className="text-3xl font-black text-white mt-1">{prediction.predictedAwayGoals.toFixed(1)}</div>
            </div>
            <div className="px-4 text-slate-600 font-black text-sm">–</div>
            <div className="text-center flex-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={game.homeTeam.logo} alt={game.homeTeam.name} className="w-8 h-8 object-contain mx-auto mb-1" />
              <div className="text-xs text-slate-400 truncate">{game.homeTeam.name}</div>
              <div className="text-3xl font-black text-white mt-1">{prediction.predictedHomeGoals.toFixed(1)}</div>
            </div>
          </div>
        </div>

        {/* Win Probability Bar */}
        <div>
          <div className="text-[10px] text-slate-500 uppercase font-black mb-2 tracking-wider">Outcome Probability</div>
          <div className="flex h-6 rounded-lg overflow-hidden text-[10px] font-black bg-slate-950 border border-slate-800">
            <div
              className="bg-purple-700 flex items-center justify-center text-white transition-all cursor-default"
              style={{ width: `${Math.max(prediction.winProbAway, 2)}%` }}
              title={`${game.awayTeam.name}: ${prediction.winProbAway}%`}
            >
              {prediction.winProbAway >= 10 ? `${prediction.winProbAway.toFixed(0)}%` : ''}
            </div>
            <div
              className="bg-slate-700 flex items-center justify-center text-slate-200 transition-all cursor-default"
              style={{ width: `${Math.max(prediction.drawProb, 2)}%` }}
              title={`Draw: ${prediction.drawProb}%`}
            >
              {prediction.drawProb >= 8 ? `${prediction.drawProb.toFixed(0)}%` : ''}
            </div>
            <div
              className="bg-emerald-600 flex items-center justify-center text-white transition-all cursor-default"
              style={{ width: `${Math.max(prediction.winProbHome, 2)}%` }}
              title={`${game.homeTeam.name}: ${prediction.winProbHome}%`}
            >
              {prediction.winProbHome >= 8 ? `${prediction.winProbHome.toFixed(0)}%` : ''}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2 pt-1 text-[11px] font-bold">
            <div className="flex items-center gap-1.5 min-w-0" title={game.awayTeam.name}>
              <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
              <span className="text-slate-300 truncate">{game.awayTeam.name}</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 min-w-0" title="Draw">
              <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
              <span className="text-slate-400">Draw</span>
            </div>
            <div className="flex items-center justify-end gap-1.5 min-w-0" title={game.homeTeam.name}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-slate-300 truncate text-right">{game.homeTeam.name}</span>
            </div>
          </div>
        </div>

        {/* Live Score overlay */}
        {game.statusState === 'in' && game.liveScore && (
          <div className="flex items-center justify-center gap-4 bg-red-950/20 border border-red-500/20 rounded-lg p-3">
            <Flame className="w-4 h-4 text-red-400 animate-pulse" />
            <span className="text-white font-black text-xl">
              {game.liveScore.away} – {game.liveScore.home}
            </span>
            <span className="text-red-400 text-xs font-bold">{game.statusDetail}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PremierLeaguePage() {
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const { user } = useUser();
  const firestore = useFirestore();
  const userProfileRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: userProfile } = useDoc<any>(userProfileRef);
  const isPro = userProfile?.isPro || userProfile?.membershipTier === 'Sharp Elite';

  useEffect(() => {
    async function loadGames() {
      setLoading(true);
      setPredictions([]);

      if (!isPro) {
        setLoading(false);
        return;
      }

      try {
        const allGames = await fetchEspnSchedule();
        const todayStr = new Date().toLocaleDateString('en-CA');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toLocaleDateString('en-CA');

        const eplGames = allGames.filter(g => {
          if (g.sport !== 'EPL') return false;
          const gameDate = new Date(g.startTime).toLocaleDateString('en-CA');
          const staleCutoff = Date.now() - 4 * 60 * 60 * 1000;
          if (g.statusState === 'post' && new Date(g.startTime).getTime() < staleCutoff) return false;
          return gameDate === todayStr || gameDate === tomorrowStr || g.statusState === 'in';
        });

        const initial: PredictionResult[] = eplGames.map(game => ({
          game,
          prediction: null,
          isLoading: true,
          error: null,
        }));
        setPredictions(initial);

        const results = await Promise.all(
          eplGames.map(async (game): Promise<PredictionResult> => {
            try {
              const res = await fetch(
                `/api/predict-soccer?home=${encodeURIComponent(game.homeTeam.name)}&away=${encodeURIComponent(game.awayTeam.name)}&league=EPL`
              );
              const json = await res.json();
              if (!res.ok) throw new Error(json.error || 'Prediction failed');
              return { game, prediction: json as SoccerPrediction, isLoading: false, error: null };
            } catch (e: any) {
              return { game, prediction: null, isLoading: false, error: e.message };
            }
          })
        );

        results.sort((a, b) => Math.abs(b.prediction?.zScore ?? 0) - Math.abs(a.prediction?.zScore ?? 0));
        setPredictions(results);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    loadGames();
  }, [isPro]);

  return (
    <div className="container mx-auto p-4 md:p-8 relative">
      {/* Paywall Overlay */}
      {!isPro && !loading && (
        <div className="absolute top-32 left-0 right-0 z-50 flex flex-col items-center justify-start mx-4">
          <div className="bg-[#1a1c23] border border-purple-500/50 p-8 rounded-2xl max-w-md text-center shadow-2xl shadow-purple-900/20">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-purple-900/40 rounded-xl flex items-center justify-center mx-auto mb-6 border border-purple-500/30">
              <Crown className="w-8 h-8 text-purple-400" />
            </div>
            <h2 className="text-2xl font-black text-white mb-3">Unlock the Premier League Model</h2>
            <p className="text-slate-400 mb-8 leading-relaxed">
              Access our EPL predictive model — Poisson-based goal projections, 3-way win probabilities, and edge calculations for every fixture.
            </p>
            <button
              onClick={() => setIsUpgradeModalOpen(true)}
              className="w-full bg-purple-500 hover:bg-purple-400 text-white font-black py-4 px-4 rounded-xl transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)]"
            >
              Upgrade to Pro for $17.99
            </button>
            <div className="flex items-center justify-center gap-2 mt-4 text-slate-500">
              <Lock className="w-3 h-3" />
              <p className="text-[10px] uppercase tracking-widest font-bold">One-time payment</p>
            </div>
          </div>
        </div>
      )}

      <div className={`space-y-8 ${!isPro && !loading ? 'pointer-events-none select-none opacity-40 blur-[3px]' : ''}`}>
        {/* Page Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center shadow-lg shadow-purple-900/40">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <BrainCircuit className="h-7 w-7 text-purple-400" />
                Premier League Model
              </h1>
              <p className="text-muted-foreground mt-0.5">
                Today's EPL fixtures ranked by statistical edge and goal projection.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <Badge variant="outline" className="border-purple-500/40 text-purple-400 bg-purple-950/30 text-[10px] font-bold uppercase tracking-wider">
              English Premier League
            </Badge>
            <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              <TrendingUp className="w-3 h-3 mr-1" />
              Poisson Goal Model
            </Badge>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="h-72 bg-slate-900 border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : !isPro ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="h-72 bg-slate-900 border-slate-800" />
            ))}
          </div>
        ) : predictions.length === 0 ? (
          <div className="text-center py-24 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
            <Shield className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No Premier League fixtures found for today.</p>
            <p className="text-slate-600 text-sm mt-1">EPL matches typically kick off on weekends and midweeks.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {predictions.map((item, idx) => (
              <div key={item.game.id} className="relative group">
                {!item.isLoading && item.prediction && (
                  <div className="absolute -left-3 top-[-10px] z-10 bg-purple-600 text-white font-black text-sm w-8 h-8 flex items-center justify-center rounded-full shadow-lg border-2 border-slate-950">
                    #{idx + 1}
                  </div>
                )}
                <SoccerPredictionCard {...item} />
              </div>
            ))}
          </div>
        )}
      </div>

      <ProUpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </div>
  );
}
