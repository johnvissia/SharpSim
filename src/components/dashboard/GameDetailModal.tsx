'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { Game, UserProfile, PlayerProp, Team } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, Loader2, User, ChevronDown, WandSparkles, Search, BarChart3, TrendingUp, TrendingDown, Flame, Activity, Sparkles, Shield, Layers, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { sportIconMap } from '@/lib/team-logos';
import { Badge } from '@/components/ui/badge';
import { Button } from '../ui/button';
import { Input } from '@/components/ui/input';
import { MainLinesView } from './MainLinesView';
import { GameLeadersView } from './GameLeadersView';
import { ModelCalculationView } from './ModelCalculationView';
import { MLBLiveGameTracker } from './MLBLiveGameTracker';
import { LiveGameHub } from './LiveGameHub';
import { TeamTrendsModal } from './TeamTrendsModal';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBetSlip } from '@/context/BetSlipContext';
import { useToast } from '@/hooks/use-toast';

interface GameDetailModalProps {
    game: Game | null;
    isOpen: boolean;
    onClose: () => void;
}

function getEspnSportPath(sport: string): string {
    const s = (sport || '').toUpperCase().trim();
    switch (s) {
        case 'NBA': return 'basketball/nba';
        case 'NCAAM': return 'basketball/mens-college-basketball';
        case 'MLB': return 'baseball/mlb';
        case 'NFL': return 'football/nfl';
        case 'NHL': return 'hockey/nhl';
        case 'EPL': return 'soccer/eng.1';
        case 'MLS': return 'soccer/usa.1';
        case 'UCL': return 'soccer/uefa.champions';
        default: return 'basketball/nba';
    }
}

const TeamHeader = ({ team, sport, isFavorite, onToggleFavorite, isUpdating, onOpenTrends }: {
    team: Game['homeTeam'],
    sport: Game['sport'],
    isFavorite: boolean,
    onToggleFavorite: () => void,
    isUpdating: boolean,
    onOpenTrends?: () => void,
}) => {
    const FallbackIcon = sportIconMap[sport] || sportIconMap.Default;
    return (
        <div className="flex flex-col items-center text-center gap-2 w-48">
            <Button variant="ghost" size="icon" onClick={onToggleFavorite} disabled={isUpdating} className="h-8 w-8 mb-2">
                <Heart className={cn(
                    "h-7 w-7 transition-all",
                    isFavorite ? 'text-red-500 fill-red-500' : 'text-muted-foreground hover:text-red-400'
                )} />
            </Button>
            <div className="flex flex-col items-center text-center gap-2 p-2 rounded-lg">
                <Link href={`/stats/${sport}/${team.name}?teamId=${team.id}`} className="flex flex-col items-center text-center gap-2 hover:opacity-90 transition-opacity">
                    {team.logo ? (
                        <Image
                            src={team.logo}
                            alt={`${team.name} logo`}
                            width={80}
                            height={80}
                            className="object-contain h-20 w-20"
                        />
                    ) : (
                        <div className="w-20 h-20 flex items-center justify-center bg-muted rounded-full">
                            <FallbackIcon className="w-10 h-10 text-muted-foreground" />
                        </div>
                    )}
                    <h2 className="text-2xl font-bold h-16 flex items-center justify-center">
                        {team.name}
                    </h2>
                </Link>
                {onOpenTrends && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onOpenTrends();
                        }}
                        className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1 transition-colors hover:underline cursor-pointer bg-slate-900/80 px-2.5 py-1 rounded-full border border-slate-800"
                    >
                        <BarChart3 className="w-3 h-3 text-brand-400" />
                        <span>View Team Trends &rarr;</span>
                    </button>
                )}
            </div>
        </div>
    )
};

// Module-level caches to eliminate lag, prevent re-fetches, and deliver 0ms instant UI responses
const GAMELOG_CACHE = new Map<string, RecentGameStat[]>();
const ROSTER_CACHE = new Map<string, Record<string, PhotoInfo>>();

interface PhotoInfo {
    headshot?: string;
    jersey?: string;
    position?: string;
    athleteId?: string;
}

interface RecentGameStat {
    date: string;
    opponent: string;
    result?: string;
    score?: string;
    points: number;
    rebounds: number;
    assists: number;
    threes: number;
    steals: number;
    blocks: number;
    turnovers: number;
    points_rebounds_assists: number;
    points_rebounds: number;
    points_assists: number;
    rebounds_assists: number;
    steals_blocks: number;
    [key: string]: any;
}

const MARKET_CONFIG: Record<string, { label: string; short: string; icon: any }> = {
    points: { label: 'Points', short: 'PTS', icon: Flame },
    assists: { label: 'Assists', short: 'AST', icon: TrendingUp },
    rebounds: { label: 'Rebounds', short: 'REB', icon: Activity },
    threes: { label: '3-Pointers', short: '3PT', icon: BarChart3 },
    points_rebounds_assists: { label: 'Pts+Reb+Ast', short: 'PRA', icon: Sparkles },
    points_rebounds: { label: 'Pts+Reb', short: 'P+R', icon: Sparkles },
    points_assists: { label: 'Pts+Ast', short: 'P+A', icon: Sparkles },
    rebounds_assists: { label: 'Reb+Ast', short: 'R+A', icon: Sparkles },
    steals: { label: 'Steals', short: 'STL', icon: Shield },
    blocks: { label: 'Blocks', short: 'BLK', icon: Shield },
    turnovers: { label: 'Turnovers', short: 'TO', icon: Activity },
    steals_blocks: { label: 'Stl+Blk', short: 'S+B', icon: Shield },
};

const MARKET_ORDER = [
    'points',
    'assists',
    'rebounds',
    'threes',
    'points_rebounds_assists',
    'points_rebounds',
    'points_assists',
    'rebounds_assists',
    'steals',
    'blocks',
    'turnovers',
    'steals_blocks'
];

function getStatValue(game: RecentGameStat, market: string): number {
    const m = (market || '').toLowerCase().replace(/[^a-z_]/g, '');
    if (m in game && typeof game[m] === 'number') {
        return game[m];
    }
    if (m.includes('point') && m.includes('rebound') && m.includes('assist')) return game.points_rebounds_assists ?? 0;
    if (m.includes('point') && m.includes('rebound')) return game.points_rebounds ?? 0;
    if (m.includes('point') && m.includes('assist')) return game.points_assists ?? 0;
    if (m.includes('rebound') && m.includes('assist')) return game.rebounds_assists ?? 0;
    if (m.includes('steal') && m.includes('block')) return game.steals_blocks ?? 0;
    if (m.includes('point')) return game.points ?? 0;
    if (m.includes('rebound')) return game.rebounds ?? 0;
    if (m.includes('assist')) return game.assists ?? 0;
    if (m.includes('three')) return game.threes ?? 0;
    if (m.includes('steal')) return game.steals ?? 0;
    if (m.includes('block')) return game.blocks ?? 0;
    if (m.includes('turnover')) return game.turnovers ?? 0;
    return game.points ?? 0;
}

const PlayerRecentTrendChart = ({ athleteId, sport, market, line }: {
    athleteId?: string;
    sport?: string;
    market: string;
    line: number;
}) => {
    const [games, setGames] = useState<RecentGameStat[]>(() => {
        return (athleteId && GAMELOG_CACHE.get(athleteId)) || [];
    });
    const [isLoading, setIsLoading] = useState(() => {
        return !!(athleteId && !GAMELOG_CACHE.has(athleteId));
    });

    useEffect(() => {
        if (!athleteId) return;

        // Instant cache hit: 0ms latency, zero lag
        if (GAMELOG_CACHE.has(athleteId)) {
            setGames(GAMELOG_CACHE.get(athleteId)!);
            setIsLoading(false);
            return;
        }

        let isMounted = true;
        setIsLoading(true);

        fetch(`/api/player-gamelog?athleteId=${athleteId}&sport=${sport || 'NBA'}`)
            .then(res => res.json())
            .then(data => {
                if (isMounted) {
                    if (data.success && Array.isArray(data.games)) {
                        GAMELOG_CACHE.set(athleteId, data.games);
                        setGames(data.games);
                    }
                    setIsLoading(false);
                }
            })
            .catch(() => {
                if (isMounted) setIsLoading(false);
            });

        return () => { isMounted = false; };
    }, [athleteId, sport]);

    if (!athleteId) {
        return (
            <div className="py-2 px-3 bg-slate-900/60 rounded border border-slate-800 text-[11px] text-muted-foreground text-center">
                Last 5 games log linked once player is active.
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="py-5 flex items-center justify-center gap-2 text-xs text-muted-foreground bg-slate-900/40 rounded border border-slate-800">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />
                <span>Loading recent game trends...</span>
            </div>
        );
    }

    if (games.length === 0) {
        return (
            <div className="py-2.5 px-3 bg-slate-900/40 rounded border border-slate-800 text-[11px] text-muted-foreground text-center">
                No recent game logs found for this season.
            </div>
        );
    }

    const [gameCount, setGameCount] = useState<5 | 10>(5);

    const displayedGames = games.slice(-gameCount);
    const values = displayedGames.map(g => getStatValue(g, market));
    const maxVal = Math.max(...values, line, 1) * 1.3;
    const lineBottomPct = Math.min(Math.max((line / maxVal) * 100, 10), 88);
    const overCount = values.filter(v => v > line).length;
    const hitPct = displayedGames.length > 0 ? Math.round((overCount / displayedGames.length) * 100) : 0;

    return (
        <div className="p-3 bg-slate-950/90 rounded-lg border border-slate-800/90 space-y-2.5 mt-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-brand-400" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                        Last {displayedGames.length} Games • Prop Line: {line}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {/* 5 Games vs 10 Games Toggle */}
                    <div className="flex items-center gap-0.5 bg-slate-900 p-0.5 rounded border border-slate-800">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setGameCount(5);
                            }}
                            className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded transition-colors",
                                gameCount === 5 ? "bg-brand-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                            )}
                        >
                            5G
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setGameCount(10);
                            }}
                            className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded transition-colors",
                                gameCount === 10 ? "bg-brand-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                            )}
                        >
                            10G
                        </button>
                    </div>

                    <div className={cn(
                        "text-[11px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1",
                        hitPct >= 50
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                    )}>
                        {hitPct >= 50 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span>{overCount} of {displayedGames.length} Over ({hitPct}%)</span>
                    </div>
                </div>
            </div>

            {/* Bar Chart Container */}
            <div className="relative h-28 pt-4 pb-6 px-2 bg-slate-900/80 rounded border border-slate-800/80 flex items-end justify-around gap-1 sm:gap-2">
                {/* Horizontal Dashed Prediction Benchmark Line */}
                <div
                    className="absolute left-2 right-2 border-t-2 border-dashed border-amber-400/90 z-10 pointer-events-none flex items-center justify-end"
                    style={{ bottom: `${lineBottomPct}%` }}
                >
                    <span className="text-[9px] font-mono font-bold text-amber-300 bg-slate-950 px-1 py-0.2 rounded -translate-y-1/2 border border-amber-400/50 shadow-sm">
                        Line: {line}
                    </span>
                </div>

                {/* Bars */}
                {displayedGames.map((g, idx) => {
                    const val = values[idx];
                    const isOver = val > line;
                    const isPush = val === line;
                    const heightPct = Math.max((val / maxVal) * 100, 8);

                    return (
                        <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative z-20">
                            {/* Stat Value Label on top of bar */}
                            <span className={cn(
                                "text-[10px] sm:text-[11px] font-bold mb-1 font-mono transition-transform group-hover:scale-110",
                                isOver ? "text-emerald-400" : isPush ? "text-slate-400" : "text-rose-400"
                            )}>
                                {val}
                            </span>

                            {/* Bar with Green/Red conditional styling */}
                            <div
                                style={{ height: `${heightPct}%` }}
                                className={cn(
                                    "w-full rounded-t-md transition-all duration-300 group-hover:opacity-90",
                                    gameCount === 10 ? "max-w-[20px]" : "max-w-[28px]",
                                    isOver
                                        ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.35)]"
                                        : isPush
                                            ? "bg-slate-500"
                                            : "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.35)]"
                                )}
                            />

                            {/* Opponent footer */}
                            <div className="absolute -bottom-5 flex flex-col items-center pointer-events-none">
                                <span className="text-[8px] sm:text-[9px] text-slate-400 font-medium whitespace-nowrap">
                                    {g.opponent}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-emerald-500" /> Over ({overCount})
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-rose-500" /> Under ({games.length - overCount})
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-3 border-t-2 border-dashed border-amber-400 inline-block" /> Line: {line}
                    </span>
                </div>
                <span className="text-slate-500 italic">ESPN Game Log</span>
            </div>
        </div>
    );
};

interface PlayerCardProps {
    playerName: string;
    teamName?: string;
    photoInfo?: PhotoInfo;
    propsByMarket: Record<string, PlayerProp[]>;
    game: Game;
    isExpanded: boolean;
    onToggle: () => void;
}

const PlayerCard = ({
    playerName,
    teamName,
    photoInfo,
    propsByMarket,
    game,
    isExpanded,
    onToggle,
}: PlayerCardProps) => {
    const { addPick, picks } = useBetSlip();

    // Sorted markets for this player based on natural preference (Points -> Assists -> Rebounds -> Threes -> ...)
    const availableMarkets = useMemo(() => {
        const keys = Object.keys(propsByMarket);
        return keys.sort((a, b) => {
            const idxA = MARKET_ORDER.indexOf(a);
            const idxB = MARKET_ORDER.indexOf(b);
            const orderA = idxA === -1 ? 99 : idxA;
            const orderB = idxB === -1 ? 99 : idxB;
            return orderA - orderB;
        });
    }, [propsByMarket]);

    const [selectedMarket, setSelectedMarket] = useState<string>(() => availableMarkets[0] || 'points');

    // Ensure selectedMarket exists for this player if props update
    useEffect(() => {
        if (!propsByMarket[selectedMarket] && availableMarkets.length > 0) {
            setSelectedMarket(availableMarkets[0]);
        }
    }, [propsByMarket, selectedMarket, availableMarkets]);

    const currentProps = propsByMarket[selectedMarket] || [];
    const sortedProps = useMemo(() => [...currentProps].sort((a, b) => a.line - b.line), [currentProps]);
    const mainProp = sortedProps[Math.floor(sortedProps.length / 2)] || sortedProps[0];
    const alternateProps = sortedProps.filter(p => p.id !== mainProp?.id);

    const handlePick = (prop: PlayerProp, side: 'over' | 'under') => {
        const pickString = `${side.charAt(0).toUpperCase() + side.slice(1)} ${prop.line}`;
        const pickOdds = side === 'over' ? prop.overOdds : prop.underOdds;

        addPick({
            game,
            pick: `${prop.playerName} ${prop.market.toUpperCase()} - ${pickString}`,
            odds: pickOdds,
            betType: 'player_prop',
            marketId: `${game.id}_${prop.playerId}_${prop.market}_${prop.line}`,
            playerId: prop.playerId,
            market: prop.market,
            line: prop.line,
        });
    };

    const isInSlip = (prop: PlayerProp, side: 'over' | 'under') => {
        if (!prop) return false;
        const marketId = `${game.id}_${prop.playerId}_${prop.market}_${prop.line}`;
        const pickInSlip = picks.find(p => p.marketId === marketId);
        if (!pickInSlip) return false;
        return pickInSlip.pick.toLowerCase().includes(side);
    };

    // Quick summary pills for the collapsed header (e.g. PTS 19.5, REB 4.5, AST 5.5)
    const summaryChips = useMemo(() => {
        return availableMarkets.slice(0, 4).map(m => {
            const list = propsByMarket[m] || [];
            const sorted = [...list].sort((a, b) => a.line - b.line);
            const mid = sorted[Math.floor(sorted.length / 2)];
            const meta = MARKET_CONFIG[m] || { short: m.toUpperCase() };
            return {
                market: m,
                short: meta.short,
                line: mid?.line
            };
        }).filter(c => c.line !== undefined);
    }, [availableMarkets, propsByMarket]);

    return (
        <div className={cn(
            "rounded-xl overflow-hidden transition-all duration-200 border bg-slate-900/90",
            isExpanded ? "border-brand-500/60 shadow-lg shadow-brand-500/5 ring-1 ring-brand-500/20" : "border-slate-800 hover:border-slate-700/80"
        )}>
            {/* Header: Clickable to expand/collapse */}
            <div
                onClick={onToggle}
                className="p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-800/40 transition-colors"
            >
                <div className="flex items-center gap-3 min-w-0">
                    {/* Headshot */}
                    {photoInfo?.headshot ? (
                        <div className="w-11 h-11 rounded-full bg-slate-800 overflow-hidden shrink-0 border border-slate-700/90 shadow-sm">
                            <img
                                src={photoInfo.headshot}
                                alt={playerName}
                                className="w-full h-full object-cover object-top"
                                onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                }}
                            />
                        </div>
                    ) : (
                        <div className="w-11 h-11 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-slate-300 font-bold text-xs border border-slate-700">
                            {photoInfo?.jersey ? `#${photoInfo.jersey}` : <User className="w-5 h-5 text-slate-400" />}
                        </div>
                    )}

                    {/* Name & Chips */}
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm sm:text-base text-slate-100 truncate">{playerName}</h4>
                            {photoInfo?.position && (
                                <span className="text-[10px] text-slate-400 bg-slate-800/90 px-1.5 py-0.5 rounded border border-slate-700/60 shrink-0 font-medium">
                                    {photoInfo.position} {photoInfo.jersey ? `• #${photoInfo.jersey}` : ''}
                                </span>
                            )}
                        </div>

                        {/* Top stat chips preview */}
                        <div className="flex items-center gap-1.5 mt-1 overflow-x-auto scrollbar-none">
                            {summaryChips.map(c => (
                                <span
                                    key={c.market}
                                    className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-slate-300 shrink-0"
                                >
                                    <span className="text-slate-400 font-normal mr-1">{c.short}</span>
                                    <span className="text-brand-400 font-bold">{c.line}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Arrow / Toggle */}
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                        {availableMarkets.length} {availableMarkets.length === 1 ? 'market' : 'markets'}
                    </span>
                    <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center bg-slate-800 border border-slate-700 text-slate-300 transition-transform duration-200",
                        isExpanded ? "rotate-180 bg-brand-500 text-white border-brand-400" : ""
                    )}>
                        <ChevronDown className="w-4 h-4" />
                    </div>
                </div>
            </div>

            {/* Expanded Body: Stat Tabs + Betting Line + Chart */}
            {isExpanded && (
                <div className="px-3.5 pb-4 pt-1 space-y-3.5 border-t border-slate-800/80 bg-slate-950/50">
                    {/* Stat Selector Pills for this specific player */}
                    {availableMarkets.length > 1 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-1 scrollbar-none">
                            {availableMarkets.map(m => {
                                const meta = MARKET_CONFIG[m] || { label: m.replace(/_/g, ' '), short: m.toUpperCase(), icon: BarChart3 };
                                const Icon = meta.icon;
                                const isActive = selectedMarket === m;
                                const list = propsByMarket[m] || [];
                                const sorted = [...list].sort((a, b) => a.line - b.line);
                                const mid = sorted[Math.floor(sorted.length / 2)];

                                return (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedMarket(m);
                                        }}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border shrink-0",
                                            isActive
                                                ? "bg-brand-500 text-white border-brand-400 shadow-sm"
                                                : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white"
                                        )}
                                    >
                                        <Icon className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-brand-400")} />
                                        <span>{meta.label}</span>
                                        {mid?.line !== undefined && (
                                            <span className={cn(
                                                "font-bold font-mono text-[11px] px-1.5 py-0.2 rounded",
                                                isActive ? "bg-white/20 text-white" : "bg-slate-800 text-brand-400"
                                            )}>
                                                {mid.line}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Active Market Betting Card */}
                    {mainProp ? (
                        <div className="space-y-3 pt-1">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800">
                                <div>
                                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                                        {(MARKET_CONFIG[selectedMarket]?.label || selectedMarket).toUpperCase()}
                                    </span>
                                    <div className="flex items-baseline gap-2 mt-0.5">
                                        <span className="text-2xl font-black text-brand-400 font-mono">{mainProp.line}</span>
                                        <span className="text-xs text-slate-400">Total {MARKET_CONFIG[selectedMarket]?.short || ''}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 sm:w-[220px]">
                                    <Button
                                        size="sm"
                                        variant={isInSlip(mainProp, 'over') ? 'secondary' : 'outline'}
                                        onClick={(e) => { e.stopPropagation(); handlePick(mainProp, 'over'); }}
                                        className="flex flex-col items-center justify-center p-2 h-auto gap-0.5 bg-slate-950 border-slate-800 hover:border-brand-500"
                                    >
                                        <span className="font-medium text-[10px] text-slate-400">Over</span>
                                        <span className="font-bold text-sm text-white">
                                            {mainProp.overOdds > 0 ? `+${mainProp.overOdds}` : mainProp.overOdds}
                                        </span>
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={isInSlip(mainProp, 'under') ? 'secondary' : 'outline'}
                                        onClick={(e) => { e.stopPropagation(); handlePick(mainProp, 'under'); }}
                                        className="flex flex-col items-center justify-center p-2 h-auto gap-0.5 bg-slate-950 border-slate-800 hover:border-brand-500"
                                    >
                                        <span className="font-medium text-[10px] text-slate-400">Under</span>
                                        <span className="font-bold text-sm text-white">
                                            {mainProp.underOdds > 0 ? `+${mainProp.underOdds}` : mainProp.underOdds}
                                        </span>
                                    </Button>
                                </div>
                            </div>

                            {/* Last 5 Games Bar Chart (Green/Red with Line) */}
                            <PlayerRecentTrendChart
                                athleteId={photoInfo?.athleteId}
                                sport={game.sport}
                                market={selectedMarket}
                                line={mainProp.line}
                            />

                            {/* Alternate Lines if available */}
                            {alternateProps.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Alternate Lines</span>
                                    <div className="space-y-1">
                                        {alternateProps.map(prop => (
                                            <div key={`${prop.playerId}-${prop.line}`} className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800">
                                                <span className="text-brand-400 font-bold text-sm pl-2">{prop.line}</span>
                                                <div className="flex items-center gap-2">
                                                    <Button size="sm" variant={isInSlip(prop, 'over') ? 'secondary' : 'outline'} onClick={() => handlePick(prop, 'over')} className="text-xs h-7 px-3">
                                                        Over {prop.overOdds > 0 ? `+${prop.overOdds}` : prop.overOdds}
                                                    </Button>
                                                    <Button size="sm" variant={isInSlip(prop, 'under') ? 'secondary' : 'outline'} onClick={() => handlePick(prop, 'under')} className="text-xs h-7 px-3">
                                                        Under {prop.underOdds > 0 ? `+${prop.underOdds}` : prop.underOdds}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="py-4 text-center text-xs text-muted-foreground">
                            No active lines for this stat.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const PlayerPropsView = ({ game }: { game: Game }) => {
    const [playerProps, setPlayerProps] = useState<PlayerProp[] | null>(null);
    const [playerPhotos, setPlayerPhotos] = useState<Record<string, PhotoInfo>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('All');
    const [expandedPlayerName, setExpandedPlayerName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    // Prevent redundant network fetches across modal re-renders
    const lastFetchedGameIdRef = useRef<string | null>(null);

    // Fetch team rosters from ESPN with in-memory caching to eliminate lag
    useEffect(() => {
        let isMounted = true;
        const fetchRosters = async () => {
            const sportPath = getEspnSportPath(game.sport);
            const teamIds = [game.homeTeam?.id, game.awayTeam?.id].filter(Boolean);
            if (teamIds.length === 0) return;

            const photoMap: Record<string, PhotoInfo> = {};

            await Promise.allSettled(
                teamIds.map(async (id) => {
                    const cacheKey = `${sportPath}_${id}`;
                    if (ROSTER_CACHE.has(cacheKey)) {
                        Object.assign(photoMap, ROSTER_CACHE.get(cacheKey));
                        return;
                    }

                    try {
                        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sportPath}/teams/${id}/roster`);
                        if (!res.ok) return;
                        const data = await res.json();
                        const athletes = data.athletes || [];
                        const teamRosterMap: Record<string, PhotoInfo> = {};

                        athletes.forEach((athlete: any) => {
                            if (athlete.displayName) {
                                const key = athlete.displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
                                teamRosterMap[key] = {
                                    headshot: athlete.headshot?.href,
                                    jersey: athlete.jersey,
                                    position: athlete.position?.abbreviation,
                                    athleteId: athlete.id ? String(athlete.id) : undefined,
                                };
                            }
                        });

                        ROSTER_CACHE.set(cacheKey, teamRosterMap);
                        Object.assign(photoMap, teamRosterMap);
                    } catch (e) {
                        // silently continue
                    }
                })
            );

            if (isMounted && Object.keys(photoMap).length > 0) {
                setPlayerPhotos(photoMap);
            }
        };

        fetchRosters();
        return () => { isMounted = false; };
    }, [game.homeTeam?.id, game.awayTeam?.id, game.sport]);

    const handleFetchProps = useCallback(async (isManualRefresh = false) => {
        const idToUse = game.oddsApiId || game.id || '';
        if (!isManualRefresh && lastFetchedGameIdRef.current === idToUse && playerProps) {
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                eventId: idToUse,
                sport: game.sport || 'NBA',
                homeTeam: game.homeTeam?.name || '',
                awayTeam: game.awayTeam?.name || '',
                force: isManualRefresh ? 'true' : 'false'
            });
            const response = await fetch(`/api/fetch-game-props?${params.toString()}`);
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || data.error || "Failed to fetch props from the API.");
            }

            lastFetchedGameIdRef.current = idToUse;
            const propsList = data.props || [];
            setPlayerProps(propsList);

            if (isManualRefresh) {
                if (propsList.length === 0) {
                    toast({ title: "No Props Available", description: "Props for this game may not have been released yet." });
                } else {
                    toast({ title: "Success", description: `Loaded ${data.count} player props.` });
                }
            }

        } catch (e: any) {
            setError(e.message);
            if (isManualRefresh) {
                toast({ title: "Fetch Failed", description: e.message, variant: "destructive" });
            }
        } finally {
            setIsLoading(false);
        }
    }, [game, playerProps, toast]);

    useEffect(() => {
        handleFetchProps(false);
    }, [handleFetchProps]);

    // Group player props by Player Name: instant memoized calculation
    const groupedPlayers = useMemo(() => {
        if (!playerProps || playerProps.length === 0) return [];

        const map = new Map<string, {
            playerName: string;
            playerId: string;
            teamName?: string;
            propsByMarket: Record<string, PlayerProp[]>;
        }>();

        playerProps.forEach(prop => {
            const name = prop.playerName;
            if (!name) return;

            if (!map.has(name)) {
                map.set(name, {
                    playerName: name,
                    playerId: prop.playerId,
                    teamName: prop.teamName,
                    propsByMarket: {},
                });
            }

            const entry = map.get(name)!;
            if (!entry.propsByMarket[prop.market]) {
                entry.propsByMarket[prop.market] = [];
            }
            entry.propsByMarket[prop.market].push(prop);
        });

        return Array.from(map.values()).sort((a, b) => a.playerName.localeCompare(b.playerName));
    }, [playerProps]);

    // Filter players by Search query and Team
    const filteredPlayers = useMemo(() => {
        return groupedPlayers.filter(p => {
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchesName = p.playerName.toLowerCase().includes(q);
                if (!matchesName) return false;
            }
            return true;
        });
    }, [groupedPlayers, searchQuery]);

    // Auto-expand first player only once on initial mount, allowing user to collapse freely
    const hasAutoExpandedRef = useRef(false);
    useEffect(() => {
        if (!hasAutoExpandedRef.current && filteredPlayers.length > 0) {
            setExpandedPlayerName(filteredPlayers[0].playerName);
            hasAutoExpandedRef.current = true;
        }
    }, [filteredPlayers]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 text-center h-64">
                <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
                <h2 className="text-lg font-semibold text-foreground">Loading Player Props...</h2>
                <p className="text-xs text-muted-foreground">Connecting live lines & recent game logs</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12 text-destructive flex flex-col items-center gap-3">
                <p className="font-semibold text-sm">Error loading props</p>
                <p className="text-xs text-muted-foreground max-w-md">{error}</p>
                <Button size="sm" onClick={() => handleFetchProps(true)} className="mt-2">Try Again</Button>
            </div>
        );
    }

    if (!playerProps || playerProps.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-4">
                <p className="text-sm">Player props are not currently available for this matchup.</p>
                <Button onClick={() => handleFetchProps(true)} size="sm" variant="outline">
                    <WandSparkles className="mr-2 h-4 w-4" />
                    Check for Updated Props
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Search Bar + Sync Button */}
            <div className="flex items-center justify-between gap-2 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search player name (e.g. Coby White, Cunningham)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-8 h-9 bg-slate-950 border-slate-800 text-sm"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-white"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <Button variant="outline" size="sm" onClick={() => handleFetchProps(true)} className="text-xs h-9 shrink-0">
                    <WandSparkles className="mr-1.5 h-3.5 w-3.5" />
                    Sync
                </Button>
            </div>

            {/* Sub-header: Count and Quick info */}
            <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-slate-400">
                    {filteredPlayers.length} {filteredPlayers.length === 1 ? 'Player' : 'Players'} with Active Props
                </span>
                <span className="text-[11px] text-slate-500">
                    Click any player to view stats & last 5 games
                </span>
            </div>

            {/* List of Players */}
            {filteredPlayers.length > 0 ? (
                <div className="space-y-2.5">
                    {filteredPlayers.map(player => {
                        const cleanName = player.playerName.toLowerCase().replace(/[^a-z0-9]/g, '');
                        const photo = playerPhotos[cleanName] || Object.entries(playerPhotos).find(([k]) => {
                            const lastName = player.playerName.split(' ').pop()?.toLowerCase();
                            return lastName && lastName.length > 2 && k.includes(lastName);
                        })?.[1];

                        const isExpanded = expandedPlayerName === player.playerName;

                        return (
                            <PlayerCard
                                key={player.playerName}
                                playerName={player.playerName}
                                teamName={player.teamName}
                                photoInfo={photo}
                                propsByMarket={player.propsByMarket}
                                game={game}
                                isExpanded={isExpanded}
                                onToggle={() => {
                                    setExpandedPlayerName(isExpanded ? null : player.playerName);
                                }}
                            />
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-12 text-muted-foreground bg-slate-900/30 rounded-lg border border-slate-800/60">
                    <p className="text-sm">No players matched "{searchQuery}"</p>
                </div>
            )}
        </div>
    );
};

export function GameDetailModal({ game, isOpen, onClose }: GameDetailModalProps) {
    const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false);
    const [trendTeam, setTrendTeam] = useState<Team | null>(null);
    const { user } = useUser();
    const firestore = useFirestore();

    const userProfileRef = useMemoFirebase(
        () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
        [user, firestore]
    );
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    const favoriteTeams = userProfile?.favoriteTeams || [];

    const handleToggleFavorite = async (teamName: string) => {
        if (!userProfileRef) return;
        setIsUpdatingFavorite(true);
        const isCurrentlyFavorite = favoriteTeams.includes(teamName);
        try {
            await updateDoc(userProfileRef, {
                favoriteTeams: isCurrentlyFavorite ? arrayRemove(teamName) : arrayUnion(teamName),
            });
        } catch (error) {
            console.error("Failed to update favorites:", error);
        } finally {
            setIsUpdatingFavorite(false);
        }
    };

    if (!game) return null;

    const gameDate = new Date(game.startTime);
    const now = new Date();

    const isLive = game.statusState === 'in';
    const isFinal = game.statusState === 'post';
    const canBet = game.statusState === 'pre';

    const isToday =
        now.getFullYear() === gameDate.getFullYear() &&
        now.getMonth() === gameDate.getMonth() &&
        now.getDate() === gameDate.getDate();

    const gameTimeOrStatus = isLive || isFinal
        ? game.statusDetail
        : isToday
            ? gameDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
            : gameDate.toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            });

    const showPlayerProps = game.sport === 'NBA' && canBet;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-full max-w-4xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="sr-only">
                        Game Details: {game.awayTeam.name} vs {game.homeTeam.name}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        View betting lines, player props, and game information for this matchup.
                    </DialogDescription>
                    <div className="flex items-start justify-around pt-8">
                        <TeamHeader
                            team={game.awayTeam}
                            sport={game.sport}
                            isFavorite={favoriteTeams.includes(game.awayTeam.name)}
                            onToggleFavorite={() => handleToggleFavorite(game.awayTeam.name)}
                            isUpdating={isUpdatingFavorite}
                            onOpenTrends={() => setTrendTeam(game.awayTeam)}
                        />
                        {isLive || isFinal ? (
                            <div className="flex flex-col items-center self-center text-center pt-6">
                                <div className="flex items-center gap-3 sm:gap-6 text-3xl sm:text-5xl font-black tracking-tight text-white font-mono">
                                    <span>{game.liveScore?.away ?? 0}</span>
                                    <span className="text-slate-600 font-normal text-2xl">-</span>
                                    <span>{game.liveScore?.home ?? 0}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    {isLive ? (
                                        <Badge className="bg-red-600 hover:bg-red-600 text-white animate-pulse text-xs">
                                            LIVE
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-slate-400 border-slate-700 text-xs">
                                            FINAL
                                        </Badge>
                                    )}
                                    <span className="text-xs font-semibold text-slate-300">{gameTimeOrStatus}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center self-center text-center pt-10">
                                <span className="text-4xl font-bold text-muted-foreground">VS</span>
                                <div className="text-sm text-muted-foreground mt-2">{gameTimeOrStatus}</div>
                            </div>
                        )}
                        <TeamHeader
                            team={game.homeTeam}
                            sport={game.sport}
                            isFavorite={favoriteTeams.includes(game.homeTeam.name)}
                            onToggleFavorite={() => handleToggleFavorite(game.homeTeam.name)}
                            isUpdating={isUpdatingFavorite}
                            onOpenTrends={() => setTrendTeam(game.homeTeam)}
                        />
                    </div>
                </DialogHeader>

                <div className="px-6 pb-6 overflow-y-auto">
                    <Tabs defaultValue={canBet ? "lines" : "live"} className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-4">
                            <TabsTrigger value={canBet ? "lines" : "live"}>
                                {canBet ? "Game Lines" : "Live Game"}
                            </TabsTrigger>
                            <TabsTrigger value="props">Player Props</TabsTrigger>
                            <TabsTrigger value="model">
                                {canBet ? "Model Calc" : "Vegas Lines"}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value={canBet ? "lines" : "live"}>
                            {canBet ? (
                                <MainLinesView game={game} />
                            ) : (
                                <LiveGameHub game={game} />
                            )}
                        </TabsContent>

                        <TabsContent value="props">
                            <PlayerPropsView game={game} />
                        </TabsContent>

                        <TabsContent value="model">
                            {canBet ? (
                                <ModelCalculationView game={game} />
                            ) : (
                                <MainLinesView game={game} />
                            )}
                        </TabsContent>
                    </Tabs>
                </div>

                {trendTeam && (
                    <TeamTrendsModal
                        isOpen={!!trendTeam}
                        onClose={() => setTrendTeam(null)}
                        team={trendTeam}
                        sport={game.sport}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
