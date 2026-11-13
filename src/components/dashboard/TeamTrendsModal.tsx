'use client';

import React, { useState, useEffect } from 'react';
import type { Team, SportName } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, BarChart3, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { sportIconMap } from '@/lib/team-logos';

interface TeamTrendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: Team | null;
  sport: SportName;
}

interface TeamGameTrend {
  id: string;
  date: string;
  opponent: string;
  opponentFullName: string;
  opponentLogo?: string;
  isHome: boolean;
  teamScore: number;
  oppScore: number;
  scoreString: string;
  result: 'W' | 'L';
  actualMargin: number;
  hasSpread: boolean;
  spread: number;
  spreadDetails: string;
  coverMargin: number;
  atsResult: 'COVER' | 'NO COVER' | 'PUSH' | 'N/A';
  isCovered: boolean;
  isPush: boolean;
}

export function TeamTrendsModal({ isOpen, onClose, team, sport }: TeamTrendsModalProps) {
  const [games, setGames] = useState<TeamGameTrend[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameCount, setGameCount] = useState<5 | 10>(10);

  useEffect(() => {
    if (!isOpen || !team) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      teamId: team.id || '',
      teamName: team.name || '',
      sport: sport || 'NBA'
    });

    fetch(`/api/team-trends?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted) {
          if (data.success && Array.isArray(data.games)) {
            setGames(data.games);
          } else {
            setError(data.message || 'No past game spread data available');
          }
          setIsLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [isOpen, team, sport]);

  if (!team) return null;

  // Selected game slice (last 5 or last 10 games)
  const displayedGames = games.slice(-gameCount);
  const validAtsGames = displayedGames.filter(g => g.hasSpread);
  const coveredCount = validAtsGames.filter(g => g.isCovered).length;
  const pushCount = validAtsGames.filter(g => g.isPush).length;
  const lostAtsCount = validAtsGames.length - coveredCount - pushCount;
  const suWins = displayedGames.filter(g => g.result === 'W').length;
  const suLosses = displayedGames.length - suWins;

  const atsRate = validAtsGames.length > 0 ? Math.round((coveredCount / validAtsGames.length) * 100) : 0;

  // Calculate bar heights based on max cover margin
  const maxAbsMargin = Math.max(...displayedGames.map(g => Math.abs(g.coverMargin)), 10, 1) * 1.25;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl max-h-[90vh] flex flex-col p-0 bg-slate-950 border-slate-800 text-slate-100">
        <DialogHeader className="p-5 pb-3 border-b border-slate-800/80">
          <DialogTitle className="sr-only">
            {team.name} Spread & ATS Trends
          </DialogTitle>
          <DialogDescription className="sr-only">
            View against the spread (ATS) performance and cover margins for the last {gameCount} games.
          </DialogDescription>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {team.logo ? (
                <div className="w-12 h-12 relative shrink-0">
                  <Image
                    src={team.logo}
                    alt={team.name}
                    width={48}
                    height={48}
                    className="object-contain w-12 h-12"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center font-bold text-sm text-slate-300 shrink-0">
                  {team.name.slice(0, 3).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight leading-snug">{team.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-400 font-mono">
                    {suWins}-{suLosses} SU
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className={cn(
                    "text-xs font-semibold px-2 py-0.2 rounded font-mono",
                    atsRate >= 50 ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                  )}>
                    {coveredCount}-{lostAtsCount}{pushCount > 0 ? `-${pushCount}` : ''} ATS ({atsRate}%)
                  </span>
                </div>
              </div>
            </div>

            {/* 5 Games vs 10 Games Selector */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setGameCount(5)}
                className={cn(
                  "text-xs font-bold px-3 py-1 rounded transition-colors",
                  gameCount === 5 ? "bg-brand-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                )}
              >
                Last 5
              </button>
              <button
                type="button"
                onClick={() => setGameCount(10)}
                className={cn(
                  "text-xs font-bold px-3 py-1 rounded transition-colors",
                  gameCount === 10 ? "bg-brand-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                )}
              >
                Last 10
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-5 overflow-y-auto">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
              <p className="text-sm font-medium">Fetching closing lines & ATS records...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <p className="text-sm text-rose-400">{error}</p>
            </div>
          ) : displayedGames.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-sm">No recent game logs found for {team.name}.</p>
            </div>
          ) : (
            <>
              {/* ATS Bar Chart (Green = Covered, Red = Failed, Amber line = Spread 0) */}
              <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-brand-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Against The Spread (ATS) Margin • Last {displayedGames.length} Games
                    </span>
                  </div>

                  <div className={cn(
                    "text-xs font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5",
                    atsRate >= 50
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                  )}>
                    {atsRate >= 50 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    <span>Covered {coveredCount} of {validAtsGames.length} ({atsRate}%)</span>
                  </div>
                </div>

                {/* Bars Container */}
                <div className="relative h-36 pt-6 pb-6 px-2 bg-slate-950/80 rounded-lg border border-slate-800/80 flex items-center justify-around gap-1 sm:gap-2">
                  {/* Zero / Spread Cover Baseline */}
                  <div className="absolute left-2 right-2 top-1/2 border-t-2 border-dashed border-amber-400/80 z-10 pointer-events-none flex items-center justify-end">
                    <span className="text-[9px] font-mono font-bold text-amber-300 bg-slate-950 px-1 py-0.2 rounded -translate-y-1/2 border border-amber-400/40">
                      Spread
                    </span>
                  </div>

                  {/* Individual Game Bars */}
                  {displayedGames.map((g, idx) => {
                    const isCover = g.isCovered;
                    const isPush = g.isPush;
                    const heightPct = Math.min(Math.max((Math.abs(g.coverMargin) / maxAbsMargin) * 50, 6), 46);

                    return (
                      <div key={g.id || idx} className="flex-1 flex flex-col items-center h-full relative z-20 group">
                        {/* Upper Half: For positive cover margin */}
                        <div className="flex-1 w-full flex flex-col items-center justify-end">
                          {isCover && (
                            <>
                              <span className="text-[10px] font-mono font-bold text-emerald-400 mb-0.5 group-hover:scale-110 transition-transform">
                                +{g.coverMargin}
                              </span>
                              <div
                                style={{ height: `${heightPct * 2}%` }}
                                className="w-full max-w-[24px] bg-emerald-500 rounded-t-md shadow-[0_0_10px_rgba(16,185,129,0.35)]"
                              />
                            </>
                          )}
                          {isPush && (
                            <div className="w-full max-w-[24px] h-2 bg-slate-500 rounded-t-sm" />
                          )}
                        </div>

                        {/* Lower Half: For negative cover margin */}
                        <div className="flex-1 w-full flex flex-col items-center justify-start">
                          {!isCover && !isPush && (
                            <>
                              <div
                                style={{ height: `${heightPct * 2}%` }}
                                className="w-full max-w-[24px] bg-rose-500 rounded-b-md shadow-[0_0_10px_rgba(244,63,94,0.35)]"
                              />
                              <span className="text-[10px] font-mono font-bold text-rose-400 mt-0.5 group-hover:scale-110 transition-transform">
                                {g.coverMargin}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Opponent & Spread Footer */}
                        <div className="absolute -bottom-5 flex flex-col items-center pointer-events-none">
                          <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap">
                            {g.opponent}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Covered ({coveredCount})
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Failed ({lostAtsCount})
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 border-t-2 border-dashed border-amber-400 inline-block" /> Spread Line
                    </span>
                  </div>
                  <span className="text-slate-500 text-[10px] italic">Closing DraftKings Lines</span>
                </div>
              </div>

              {/* Game Log Breakdown List */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Game-by-Game ATS History
                </span>
                <div className="divide-y divide-slate-800/80 rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden text-xs">
                  {displayedGames.slice().reverse().map(g => (
                    <div key={g.id} className="p-2.5 flex items-center justify-between hover:bg-slate-800/40 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[11px] text-slate-400 w-12 font-mono shrink-0">{g.date}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                            <span>{g.opponent}</span>
                            <span className={cn(
                              "text-[10px] px-1 rounded font-bold font-mono",
                              g.result === 'W' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                            )}>
                              {g.result} {g.scoreString}
                            </span>
                          </div>
                          {g.hasSpread ? (
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              Closing Spread: <span className="text-slate-300 font-bold">{g.spread > 0 ? `+${g.spread}` : g.spread}</span> ({g.spreadDetails})
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 italic">Spread line not listed</div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {g.hasSpread ? (
                          <>
                            <span className={cn(
                              "font-mono font-bold text-xs",
                              g.coverMargin > 0 ? "text-emerald-400" : g.coverMargin === 0 ? "text-slate-400" : "text-rose-400"
                            )}>
                              {g.coverMargin > 0 ? `+${g.coverMargin}` : g.coverMargin}
                            </span>
                            <Badge className={cn(
                              "text-[10px] font-bold uppercase px-2 py-0.5",
                              g.atsResult === 'COVER'
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : g.atsResult === 'PUSH'
                                  ? "bg-slate-700 text-slate-300"
                                  : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                            )}>
                              {g.atsResult}
                            </Badge>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">N/A</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
