'use client';

import { useState } from 'react';
import { 
  BarChart, Users, CheckCircle, TrendingUp, AlertTriangle, ShieldCheck, 
  Download, ChevronRight, BrainCircuit, Activity 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { analyzeBettingPerformance } from '@/ai/flows/betting-coach';
import type { UserBet, CoachingAnalysis } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function CoachingPage() {
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<CoachingAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const { user } = useUser();
  const firestore = useFirestore();

  const betsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'bets'));
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

  const getSplitROI = (category: string, type: string) => {
    if (!analysis) return 0;
    const split = (analysis.splits as any)[category]?.find((s: any) => s.label.toLowerCase() === type.toLowerCase());
    return split ? split.roi : 0;
  };

  const getGradeColor = (grade: string) => {
    if (grade === 'A') return 'text-emerald-400';
    if (grade === 'B') return 'text-brand-400';
    if (grade === 'C') return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="pt-8 pb-12 px-4 md:px-8 max-w-7xl mx-auto font-sans animate-in fade-in duration-500">
      {/* Header Section */}
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-2 font-['Manrope'] flex items-center gap-3">
            <BrainCircuit className="h-10 w-10 text-emerald-400" />
            Coaching Dashboard
          </h1>
          <p className="text-slate-400 text-lg font-light max-w-2xl">Identify leaks, track discipline, and align with the Vantage Model.</p>
        </div>
        
        <Button
          onClick={handleAnalysis}
          disabled={loading || isLoadingBets}
          size="lg"
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-lg shadow-emerald-500/20 px-8 py-6 rounded-xl"
        >
          {loading ? 'Analyzing Data...' : 'Analyze My Performance'}
        </Button>
      </header>

      {loading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-900/80 p-6 rounded-xl border border-slate-800">
               <Skeleton className="h-6 w-32 bg-slate-800 mb-4" />
               <Skeleton className="h-12 w-24 bg-slate-800" />
            </div>
          ))}
        </div>
      )}

      {(!analysis && !loading) && (
        <div className="flex flex-col items-center justify-center py-32 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/20 shadow-inner">
          <div className="p-5 bg-slate-900 rounded-2xl mb-6 border border-slate-800 shadow-xl shadow-slate-950/50">
            <Activity className="h-12 w-12 text-slate-500" />
          </div>
          <h3 className="text-2xl font-black text-white mb-3 font-['Manrope'] tracking-tight">Ready for your Breakdown?</h3>
          <p className="text-slate-400 text-center max-w-md mb-8 leading-relaxed">
            Click the Analyze button above to let our AI models process your betting history and deliver actionable insights.
          </p>
        </div>
      )}

      {analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Left Column: Performance Insights */}
          <div className="lg:col-span-8 space-y-6">
            {/* Strengths & Weaknesses Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Bet Type Breakdown */}
              <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl p-6 border border-slate-800 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-white font-['Manrope'] text-lg">Bet Type Breakdown</h3>
                  <BarChart className="w-5 h-5 text-slate-400" />
                </div>
                
                <div className="space-y-5">
                  {['Spread', 'Moneyline', 'Total'].map((type) => {
                    const roi = getSplitROI('betType', type);
                    const isPositive = roi > 0;
                    const isNeutral = roi === 0;
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-slate-400 font-medium text-sm">{type}s</span>
                          <span className={cn("font-bold text-sm", isPositive ? "text-emerald-400" : isNeutral ? "text-white" : "text-rose-400")}>
                            {isNeutral ? 'Neutral' : `${roi > 0 ? '+' : ''}${roi.toFixed(1)}% ROI`}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full", isPositive ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : isNeutral ? "bg-slate-600" : "bg-rose-500")} 
                            style={{ width: `${Math.min(100, Math.max(10, Math.abs(roi) * 2 + 30))}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Team/Conference Bias */}
              <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl p-6 border border-slate-800 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-white font-['Manrope'] text-lg">Team Bias Alerts</h3>
                  <Users className="w-5 h-5 text-slate-400" />
                </div>

                <div className="space-y-4">
                  {analysis.biasAlerts.length > 0 ? analysis.biasAlerts.map((alert, idx) => (
                    <div key={idx} className={cn(
                      "flex items-center justify-between p-3 border rounded-lg",
                      alert.severity === 'high' ? "bg-rose-500/10 border-rose-500/20" : "bg-amber-500/10 border-amber-500/20"
                    )}>
                      <div className="flex items-center gap-3">
                        <AlertTriangle className={cn("w-5 h-5", alert.severity === 'high' ? "text-rose-500" : "text-amber-500")} />
                        <div>
                          <p className="font-bold text-white text-sm">{alert.teamName}</p>
                          <p className="text-xs text-slate-400 line-clamp-1">{alert.description}</p>
                        </div>
                      </div>
                      <span className={cn(
                        "text-xs px-2 py-1 rounded font-black shrink-0",
                        alert.severity === 'high' ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"
                      )}>{alert.winRate.toFixed(0)}% WR</span>
                    </div>
                  )) : (
                    <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                        <div>
                          <p className="font-bold text-white text-sm">No Major Leaks</p>
                          <p className="text-xs text-slate-400">Your portfolio is well-balanced.</p>
                        </div>
                      </div>
                      <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded font-black tracking-wider">CLEAN</span>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Model Alignment Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-slate-900/80 backdrop-blur-sm rounded-xl p-8 border border-slate-800 shadow-lg flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <TrendingUp className="w-48 h-48 text-slate-500" />
                </div>
                
                <div className="relative flex items-center justify-center">
                  <svg className="w-40 h-40 transform -rotate-90 drop-shadow-xl">
                    <circle className="text-slate-950" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeWidth="12"></circle>
                    <circle className={getGradeColor(analysis.modelAlignment.grade)} cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeDasharray="440" strokeDashoffset={440 - (440 * analysis.modelAlignment.alignmentPercentage) / 100} strokeWidth="12"></circle>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={cn("text-5xl font-black font-['Manrope'] tracking-tighter", getGradeColor(analysis.modelAlignment.grade))}>{analysis.modelAlignment.grade}</span>
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Grade</span>
                  </div>
                </div>

                <div className="flex-1 space-y-3 text-center md:text-left z-10">
                  <h2 className="text-2xl font-extrabold text-white font-['Manrope']">The Vantage Grade</h2>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Your pick selection shows {analysis.modelAlignment.alignmentPercentage.toFixed(0)}% correlation with the Vantage Power Model. {analysis.modelAlignment.alignmentPercentage > 70 ? "Following the model's 'Strong Buy' indicators strictly will maintain low drawdown volatility." : "Try cross-referencing your picks with the model to capture more value."}
                  </p>
                  <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-2">
                    <span className="text-[10px] bg-slate-950 px-2 py-1 rounded border border-slate-700 text-slate-400 font-bold uppercase tracking-wider">Model Sync: {analysis.modelAlignment.grade}</span>
                    <span className="text-[10px] bg-slate-950 px-2 py-1 rounded border border-slate-700 text-slate-400 font-bold uppercase tracking-wider">Actual PnL: {(analysis.modelAlignment.actualBankrollDelta > 0 ? '+' : '')}{analysis.modelAlignment.actualBankrollDelta.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              {/* Alternate Reality Widget */}
              <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl p-6 border border-slate-800 shadow-lg flex flex-col justify-between relative">
                <div>
                  <div className="flex items-center gap-2 mb-4 text-slate-400">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">Alternative Reality</span>
                  </div>
                  <p className="text-slate-400 text-sm italic leading-relaxed">
                    "If you had followed the model exactly, your bankroll would be <span className={analysis.modelAlignment.alternativeBankroll >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                      {(analysis.modelAlignment.alternativeBankroll > 0 ? '+' : '')}{analysis.modelAlignment.alternativeBankroll.toFixed(0)} units
                    </span> instead of <span className={analysis.modelAlignment.actualBankrollDelta >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                      {(analysis.modelAlignment.actualBankrollDelta > 0 ? '+' : '')}{analysis.modelAlignment.actualBankrollDelta.toFixed(0)} units
                    </span>."
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800">
                  <button className="w-full text-left text-xs font-bold text-emerald-400 flex items-center justify-between hover:translate-x-1 transition-transform group">
                    View Backtest Proof
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bankroll Discipline Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl p-6 border border-slate-800 shadow-lg flex items-start gap-5">
                <div className={cn(
                  "w-14 h-14 rounded-lg flex items-center justify-center shrink-0 border",
                  analysis.bankrollDiscipline.grade === 'A' || analysis.bankrollDiscipline.grade === 'B' 
                    ? "bg-emerald-500/10 border-emerald-500/20" 
                    : "bg-rose-500/10 border-rose-500/20"
                )}>
                  <span className={cn(
                    "text-3xl font-black font-['Manrope']",
                    getGradeColor(analysis.bankrollDiscipline.grade)
                  )}>{analysis.bankrollDiscipline.grade}</span>
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1 font-['Manrope'] text-lg">Unit Sizing Grade</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {analysis.bankrollDiscipline.grade === 'A' ? "Excellent flat betting consistency. No dangerous volume spikes detected." 
                    : "Inconsistent unit sizing detected. Stick to flat betting to protect your bankroll."}
                  </p>
                </div>
              </div>

              <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl p-6 border border-slate-800 shadow-lg flex items-start gap-5">
                <div className="w-14 h-14 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                  {analysis.bankrollDiscipline.isLossChasing ? (
                    <AlertTriangle className="w-7 h-7 text-rose-500" />
                  ) : (
                    <CheckCircle className="w-7 h-7 text-emerald-400" />
                  )}
                </div>
                <div className="w-full">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-white font-['Manrope'] text-lg">Loss Chasing Alerts</h3>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-black tracking-wider",
                      analysis.bankrollDiscipline.isLossChasing ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
                    )}>
                      {analysis.bankrollDiscipline.isLossChasing ? "DETECTED" : "CLEAN"}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {analysis.bankrollDiscipline.isLossChasing 
                      ? "Erratic jumps detected following losses. Avoid doubling down to recoup losses." 
                      : "No erratic jumps detected following losses. Discipline metrics remain within elite performance thresholds."}
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Edge & Signals */}
          <div className="lg:col-span-4 space-y-6">
            {/* Closing Line Value Widget */}
            <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-800 shadow-lg flex flex-col h-[400px]">
              <div className="p-6 flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white font-['Manrope'] text-lg">Closing Line Value</h3>
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex flex-col items-center py-2">
                  <div className="text-7xl font-black text-white tracking-tighter mb-1 font-['Manrope']">{analysis.clvTracking.beatTheLineRate.toFixed(0)}%</div>
                  <span className="text-xs font-bold text-slate-400 tracking-[0.2em] uppercase">Beat the Line %</span>
                </div>

                <div className="mt-6 p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-bold text-sm">
                        {analysis.clvTracking.beatTheLineRate > 50 ? "Good Edge" : "Needs Improvement"}
                      </p>
                      <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                        {analysis.clvTracking.beatTheLineRate > 50 
                          ? "You are consistently betting before the market corrects. This is a leading indicator of long-term profitability."
                          : "You are often betting into closing lines that have moved against you. Try to place bets earlier."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-6 border-t border-slate-800 mt-auto">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Market Capture Trend</h4>
                <div className="h-20 flex items-end gap-1">
                  {analysis.clvTracking.dailyTrend.map((trend, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "flex-1 transition-colors rounded-t-sm",
                        i === analysis.clvTracking.dailyTrend.length - 1 ? "bg-emerald-500" : "bg-slate-800 hover:bg-emerald-400"
                      )} 
                      style={{ height: `${trend.rate}%` }} 
                      title={trend.day}
                    ></div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Activity/Log */}
            <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl p-6 border border-slate-800 shadow-lg flex flex-col justify-between" style={{ minHeight: '300px' }}>
              <div>
                <h3 className="font-bold text-white mb-6 font-['Manrope'] text-lg">Coach Insights</h3>
                
                <div className="space-y-6">
                  {analysis.improvementTips.slice(0, 3).map((tip, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className={cn(
                        "w-1.5 h-auto rounded-full shrink-0",
                        idx === 0 ? "bg-emerald-500" : idx === 1 ? "bg-brand-400" : "bg-rose-500"
                      )}></div>
                      <div className="text-sm">
                        <p className="text-white font-bold">Insight #{idx + 1}</p>
                        <p className="text-slate-400 mt-1 leading-relaxed">{tip}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button className="w-full mt-8 py-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-white hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shrink-0">
                <Download className="w-4 h-4" />
                DOWNLOAD FULL REPORT
              </button>
            </div>

            {/* Promotional Image / Visualization */}
            <div className="rounded-xl overflow-hidden h-40 relative group cursor-pointer border border-slate-800 shadow-lg">
              <img 
                className="w-full h-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0 group-hover:scale-105 opacity-80" 
                alt="abstract financial data visualization" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuApcblhWvZi7PbFAmrGbKcUxskT9RJPOrJpcgu-cSg9T8DSRz8yHhQjtSXXn053bwtVKKAMUkJt5Ftoa0_laay9jYNunc9nJClD70SEm1MJctTRu-zYUSYDwmhcoiF_k9G-_aXjs6ZwAixO96YgrIj24tIKKYeRRlxkNbTBh7GEMOsH3wPbsBPr6_gZyEi6Hrc18SGwegLaXaNQML1kz4isBs6InUIKKujwrkvQfhTK5JfLrbmeyv--6jPPcEK7plt4jidMtFO08BA"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent p-6 flex flex-col justify-end">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em] mb-1">Advanced Tools</p>
                <h4 className="text-xl font-black text-white leading-none font-['Manrope']">Sharpen Your Edge</h4>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
