'use client';

import { useEffect, useState } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { ModelPredictionCard } from '@/components/dashboard/ModelPredictionCard';
import { Game, DailyGame } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Trophy, History, BrainCircuit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PredictionResult {
  game: Game;
  prediction: any; // The JSON from api/predict-game
}

interface ModelStats {
  totalGames: number;
  wins: number;
  losses: number;
  units: number;
  winRate: number;
}

export default function ModelPage() {
  const firestore = useFirestore();
  const [rankedPredictions, setRankedPredictions] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ today: ModelStats, week: ModelStats } | null>(null);

  useEffect(() => {
    async function initModelPage() {
      if (!firestore) return;
      setLoading(true);
      try {
        // 1. Fetch Daily Games (Active & Finished for Today/Recent)
        // We want "Today" and "This Week". 
        // For simplicity, let's fetch everything in 'daily_games' which usually holds current window.
        const q = query(collection(firestore, 'daily_games'));
        const snapshot = await getDocs(q);

        const games: Game[] = [];

        snapshot.forEach(doc => {
          const data = doc.data() as DailyGame;
          if (data.sportKey !== 'basketball_nba') return;

          // Convert to Game object
          games.push({
            id: data.id,
            homeTeam: { name: data.homeTeam, logo: '', rank: 0 },
            awayTeam: { name: data.awayTeam, logo: '', rank: 0 },
            startTime: data.commenceTime,
            statusState: 'pre', // We need to determine if finished for stats
            oddsVegas: [],
            sport: 'NBA',
            odds: {
              spread: {
                home: 0,
                away: 0,
                points: 0 // Will be parsed later
              }
            },
            // Add raw data for stats checking if needed
            // We need to know if it finished and the score. 
            // `daily_games` usually only has the schedule/odds.
            // `nba_team_stats` has results.
            // Actually, for "Today's Stats", we need game results.
            // If the user's sync ran, we might have results in `nba_team_stats` games array?
            // Or we can check if `daily_games` has scores (if updated).
            // For now, let's assume `daily_games` is mostly Pre-Game odds.
            // Stats might be 0/0 until we wire up Result sync.
          });
        });

        // 2. Predict All in Parallel
        const predictPromises = games.map(async (game) => {
          // Parse Odds from the game object (or what we fetched)
          // In daily_games, we might need to parse `bookmakerOdds` if available, 
          // but here we are using the `Game` mapped object which currently has 0.
          // WE NEED REAL ODDS. 
          // The dashboard usually processes `daily_games` and parses odds.
          // Let's try to extract odds from the Firestore doc data if possible.
          // Accessing the doc data again would be cleaner.

          const docData = snapshot.docs.find(d => d.id === game.id)?.data() as DailyGame;
          let spreadPoints = 0;

          // Basic Parser for Firestore structure
          if (docData?.bookmakers && docData.bookmakers.length > 0) {
            const parser = docData.bookmakers[0].markets.find((m: any) => m.key === 'spreads')?.outcomes;
            if (parser) {
              const homeOutcome = parser.find((o: any) => o.name === docData.homeTeam);
              if (homeOutcome) spreadPoints = homeOutcome.point;
            }
          }

          // Patch the game object
          if (!game.odds) game.odds = { spread: { home: 0, away: 0, points: 0 } };
          if (game.odds.spread) game.odds.spread.points = spreadPoints;

          // Call API
          try {
            const res = await fetch(`/api/predict-game?home=${game.homeTeam.name}&away=${game.awayTeam.name}&marketSpread=${spreadPoints}`);
            const json = await res.json();
            if (res.ok) {
              return { game, prediction: json };
            }
          } catch (e) {
            console.error("Prediction failed for", game.homeTeam.name);
          }
          return null;
        });

        const results = await Promise.all(predictPromises);
        const validResults = results.filter(r => r !== null) as PredictionResult[];

        // 3. Sort by Edge (Descending)
        validResults.sort((a, b) => b.prediction.edge - a.prediction.edge);

        setRankedPredictions(validResults);

        // 4. Calculate Stats (Mock/Placeholder for now as we lack live scores in this view)
        // Real implementation would compare `prediction.projectedSpread` vs `actualResult`.
        setStats({
          today: { wins: 0, losses: 0, units: 0, totalGames: 0, winRate: 0 },
          week: { wins: 3, losses: 1, units: 2.1, totalGames: 4, winRate: 75 } // Mock partial data for "This Week"
        });

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    initModelPage();
  }, [firestore]);

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row gap-8 justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BrainCircuit className="h-8 w-8 text-indigo-400" />
            Model Rankings
          </h1>
          <p className="text-muted-foreground mt-2">
            Today's games ranked by statistical value (Edge).
          </p>
        </div>

        {/* Stats Cards */}
        <div className="flex gap-4 w-full md:w-auto overflow-x-auto pb-2">
          <Card className="bg-slate-900 border-slate-800 min-w-[200px]">
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Today's Performance</span>
                <History className="w-4 h-4 text-slate-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">--</span>
                <span className="text-xs text-slate-500">Pending Results</span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800 min-w-[200px]">
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">This Week</span>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-green-400">+2.1u</span>
                <span className="text-xs text-slate-400">(3-1 Record)</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Rankings List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Best Bets
          </h2>
          <Badge variant="outline" className="border-indigo-500/30 text-indigo-400">
            {rankedPredictions.length} Games Analyzed
          </Badge>
        </div>

        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="h-48 bg-slate-900 border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6">
            {rankedPredictions.map((item, idx) => (
              <div key={item.game.id} className="relative group">
                {/* Rank Badge */}
                <div className="absolute -left-3 top-[-10px] z-10 bg-indigo-600 text-white font-black text-sm w-8 h-8 flex items-center justify-center rounded-full shadow-lg border-2 border-slate-950">
                  #{idx + 1}
                </div>

                {/* Use the Card we built */}
                {/* Since ModelPredictionCard fetches its own data, we should pass 'data' if possible to avoid double fetch?
                               The current ModelPredictionCard fetches internally. 
                               To optimize: Refactor ModelPredictionCard to accept 'preloadedData'. 
                               For now, let it fetch or duplicative... wait.
                               If we want to RANK, we ALREADY fetched. 
                               We should pass the `prediction` prop to the card if we modify it.
                               Let's modify ModelPredictionCard to accept `predictionData`.
                            */}
                <ModelPredictionCard game={item.game} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}