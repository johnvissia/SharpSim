'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { computeSoccerMatchInsights } from '@/lib/soccer-insights';

export interface SoccerInsightsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string;
  awayLogo?: string;
  leagueName?: string;
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  winProbHome: number;
  winProbAway: number;
  drawProb: number;
  modelPick?: string | null;
  coverProb?: number;
  marketSpread?: number | null;
}

export function SoccerInsightsModal({
  open,
  onOpenChange,
  homeTeam,
  awayTeam,
  homeLogo,
  awayLogo,
  leagueName = 'Soccer',
  predictedHomeGoals,
  predictedAwayGoals,
  winProbHome,
  winProbAway,
  drawProb,
  modelPick,
  coverProb,
  marketSpread,
}: SoccerInsightsModalProps) {
  const insights = computeSoccerMatchInsights(
    homeTeam || 'Home',
    awayTeam || 'Away',
    predictedHomeGoals ?? 1.2,
    predictedAwayGoals ?? 1.0,
    winProbHome ?? 0,
    winProbAway ?? 0,
    drawProb ?? 0
  );

  const bttsBadgeClass = insights.btts.recommendation.includes('YES')
    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border border-slate-800 text-white max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto p-6 sm:p-7 rounded-2xl">
        {/* Heading */}
        <DialogHeader className="pb-4 border-b border-slate-800/80 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            {awayLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={awayLogo} alt={awayTeam} className="w-5 h-5 object-contain shrink-0 drop-shadow" />
            )}
            <DialogTitle className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>{awayTeam}</span>
              <span className="text-slate-500 font-normal">@</span>
              {homeLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={homeLogo} alt={homeTeam} className="w-5 h-5 object-contain shrink-0 drop-shadow" />
              )}
              <span>{homeTeam}</span>
            </DialogTitle>
          </div>
          <p className="text-xs text-slate-400 font-medium mt-1">
            {leagueName} · Match Insights & Market Breakdown
          </p>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Model Spread Pick Banner (if available) */}
          {modelPick && (
            <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between text-xs">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Model Spread Pick (-110 Benchmark)
                </div>
                <div className="text-sm font-extrabold text-white mt-0.5">
                  {modelPick}
                </div>
              </div>
              {coverProb !== undefined && (
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Cover Prob
                  </div>
                  <div className="text-sm font-extrabold text-emerald-400 font-mono mt-0.5">
                    {coverProb}%
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 1. Both Teams to Score Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Both Teams To Score
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${bttsBadgeClass}`}>
                {insights.btts.recommendation}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              {insights.btts.reasoning}
            </p>
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-emerald-400">YES {insights.btts.probYes}%</span>
                <span className="text-slate-400">NO {insights.btts.probNo}%</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{ width: `${insights.btts.probYes}%` }}
                />
                <div
                  className="bg-slate-700 h-full transition-all"
                  style={{ width: `${insights.btts.probNo}%` }}
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-800/60" />

          {/* 2. Totals Market Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Totals Market
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                {insights.totals.recommendation}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              {insights.totals.reasoning}
            </p>
            <div className="grid grid-cols-3 gap-4 pt-1">
              <div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {insights.totals.totalExpectedGoals}
                </div>
                <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Expected Goals
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {insights.totals.over25Prob}%
                </div>
                <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Over 2.5
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-sky-400 font-mono">
                  {insights.totals.under25Prob}%
                </div>
                <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Under 2.5
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-800/60" />

          {/* 3. Top Projected Exact Scorelines Section */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Top Projected Exact Scorelines
            </span>
            <div className="grid grid-cols-3 gap-4 pt-1">
              {insights.topScores.map((score, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    #{i + 1}
                  </div>
                  <div className="text-2xl font-black text-white font-mono">
                    {score.awayScore}–{score.homeScore}
                  </div>
                  <div className="text-xs font-semibold text-slate-400">
                    {score.prob}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-800/60" />

          {/* 4. Value Angles Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-0.5">
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Secondary Angle
              </div>
              <div className="text-sm font-bold text-white">
                {insights.marketAngle.pick}
              </div>
              <p className="text-xs text-slate-400 leading-normal font-medium">
                {insights.marketAngle.reasoning}
              </p>
            </div>
            <div className="space-y-1 sm:text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Clean Sheet %
              </div>
              <div className="text-sm font-bold text-white">
                {insights.profile.homeCleanSheetProb}% (Home) / {insights.profile.awayCleanSheetProb}% (Away)
              </div>
              <p className="text-xs text-slate-400 leading-normal font-medium">
                Defense shutout probability
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
