'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { analyzeBettingPerformance } from '@/ai/flows/betting-coach';
import type { UserBet, CoachingAnalysis } from '@/lib/types';
import {
  BrainCircuit,
  Trophy,
  Target,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Scale,
  LineChart,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import { Bar, BarChart as RechartsBarChart, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { cn } from '@/lib/utils';

const chartConfig = {
  roi: {
    label: 'ROI %',
    color: 'hsl(var(--primary))',
  },
  winRate: {
    label: 'Win Rate %',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;

export default function CoachingPage() {
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<CoachingAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const { user } = useUser();
  const firestore = useFirestore();

  const betsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'bets'),
      orderBy('placedAt', 'desc')
    );
  }, [user, firestore]);

  const { data: userBets, isLoading: isLoadingBets } = useCollection<UserBet>(betsQuery);

  const handleAnalysis = async () => {
    if (!userBets || userBets.length === 0) {
      toast({
        title: 'No Betting History',
        description: 'Place some bets to unlock your personalized coaching analysis.',
        variant: 'default',
      });
      return;
    }

    setLoading(true);
    try {
      const historyString = JSON.stringify(userBets);
      const result = await analyzeBettingPerformance({
        bettingHistory: historyString,
      });
      setAnalysis(result);
    } catch (error: any) {
      console.error('Failed to get analysis:', error);
      toast({
        title: 'Analysis Failed',
        description: error.message || 'Could not retrieve your performance data.',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  const GradeBadge = ({ grade }: { grade: string }) => (
    <div className={cn(
      "flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold border-2",
      grade === 'A' ? "border-emerald-500 text-emerald-500 bg-emerald-500/10" :
      grade === 'B' ? "border-blue-500 text-blue-500 bg-blue-500/10" :
      grade === 'C' ? "border-amber-500 text-amber-500 bg-amber-500/10" :
      "border-rose-500 text-rose-500 bg-rose-500/10"
    )}>
      {grade}
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto">
      {/* ── Header ── */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white flex items-center gap-3">
            <BrainCircuit className="h-10 w-10 text-brand-400" />
            Performance Ledger
          </h1>
          <p className="text-slate-400 mt-2 max-w-2xl">
            Personalized betting analytics and AI coaching. Identify leaks in your strategy and grade your performance against sharp market models.
          </p>
        </div>
        <Button
          onClick={handleAnalysis}
          disabled={loading || isLoadingBets}
          size="lg"
          className="bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/20"
        >
          {loading ? 'Crunching Data...' : 'Analyze My Performance'}
        </Button>
      </header>

      {loading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24 bg-slate-800" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 bg-slate-800" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {analysis && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* ── KPI Grid ── */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-slate-900 border-slate-800 overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Target className="h-16 w-16" />
              </div>
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-400 uppercase text-[10px] font-bold tracking-widest">Vantage Grade</CardDescription>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-3xl font-bold text-white">Sharpness</span>
                  <GradeBadge grade={analysis.modelAlignment.grade} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-400">
                  <span className="text-brand-400 font-semibold">{analysis.modelAlignment.alignmentPercentage.toFixed(1)}%</span> alignment with model
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800 overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Scale className="h-16 w-16" />
              </div>
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-400 uppercase text-[10px] font-bold tracking-widest">Bankroll Grade</CardDescription>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-3xl font-bold text-white">Discipline</span>
                  <GradeBadge grade={analysis.bankrollDiscipline.grade} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm">
                  {analysis.bankrollDiscipline.isLossChasing ? (
                    <span className="text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Loss Chasing Detected
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Consistent Sizing
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-400 uppercase text-[10px] font-bold tracking-widest">ROI (Total)</CardDescription>
                <CardTitle className={cn(
                  "text-3xl font-bold",
                  analysis.modelAlignment.actualBankrollDelta >= 0 ? "text-emerald-400" : "text-rose-400"
                )}>
                  {analysis.modelAlignment.actualBankrollDelta >= 0 ? '+' : ''}
                  {analysis.modelAlignment.actualBankrollDelta.toFixed(0)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 italic">Across {analysis.splits.sport.reduce((a, b) => a + b.totalBets, 0)} settled bets</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-400 uppercase text-[10px] font-bold tracking-widest">BEAT THE LINE</CardDescription>
                <CardTitle className="text-3xl font-bold text-white">
                  {analysis.clvTracking.beatTheLineRate.toFixed(1)}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-400">
                  Avg Edge: <span className="text-brand-400">{(analysis.clvTracking.averageEdge > 0 ? '+' : '')}{analysis.clvTracking.averageEdge.toFixed(2)} pts</span>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Detailed Analytics ── */}
          <div className="grid gap-6 lg:grid-cols-2">
            
            {/* ROI by Sport */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-brand-400" />
                  Performance Splits (by Sport)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={analysis.splits.sport}>
                      <XAxis dataKey="label" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
                        {analysis.splits.sport.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.roi >= 0 ? '#10b981' : '#f43f5e'} />
                        ))}
                      </Bar>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Improvement Tips & Alerts */}
            <div className="space-y-6">
               {/* Bias Alerts */}
               <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-rose-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-rose-400">
                    <AlertTriangle className="h-5 w-5" />
                    Bias Alerts & Blind Spots
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analysis.biasAlerts.length > 0 ? analysis.biasAlerts.map((alert, i) => (
                    <div key={i} className="p-3 bg-rose-500/5 rounded-lg border border-rose-500/10">
                      <p className="text-sm text-slate-300 font-medium">{alert.teamName} Blind Spot</p>
                      <p className="text-xs text-slate-400 mt-1">{alert.description}</p>
                    </div>
                  )) : (
                    <p className="text-sm text-slate-400 italic">No significant team-specific bias detected. Your picks are well-distributed.</p>
                  )}
                </CardContent>
              </Card>

              {/* Tips */}
              <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-brand-400">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-brand-400">
                    <Trophy className="h-5 w-5" />
                    Coach's Improvement Tips
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {analysis.improvementTips.map((tip, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-300">
                        <span className="text-brand-400 font-bold shrink-0">{i + 1}.</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── Summary ── */}
          <Card className="bg-slate-800/40 border-slate-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="h-5 w-5 text-indigo-400" />
                The Vantage Perspective
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-8 md:grid-cols-3">
                <div className="md:col-span-2">
                  <p className="text-lg text-slate-200 leading-relaxed italic">
                    "{analysis.summary}"
                  </p>
                </div>
                <div className="bg-slate-900/80 rounded-xl p-6 border border-slate-700/50 flex flex-col justify-center">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-tighter mb-1">Alternative Reality</p>
                  <p className="text-sm text-slate-500 leading-snug mb-4">What your bankroll would be if you followed the model precisely on these {analysis.splits.sport.reduce((a, b) => a + b.totalBets, 0)} bets:</p>
                  <div className={cn(
                    "text-4xl font-black tabular-nums",
                    analysis.modelAlignment.alternativeBankroll >= 0 ? "text-brand-400" : "text-rose-400"
                  )}>
                    {analysis.modelAlignment.alternativeBankroll >= 0 ? '+' : ''}
                    {analysis.modelAlignment.alternativeBankroll.toFixed(0)}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 italic">*Simulated based on model outcomes & your unit sizes.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {(!analysis && !loading) && (
        <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-950/20">
          <div className="p-4 bg-slate-900 rounded-2xl mb-4 border border-slate-800">
            <BarChart3 className="h-10 w-10 text-slate-700" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Performance Ledger Data</h3>
          <p className="text-slate-400 text-center max-w-sm mb-6">
            Unlock professional-grade analytics by running an analysis on your recent betting history.
          </p>
          <Button 
            onClick={handleAnalysis}
            disabled={isLoadingBets}
            className="bg-brand-500 hover:bg-brand-400 text-white"
          >
            Run Initial Analysis
          </Button>
        </div>
      )}
    </div>
  );
}

