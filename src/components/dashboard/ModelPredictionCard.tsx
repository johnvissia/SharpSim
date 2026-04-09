'use client';

import { useEffect, useState } from 'react';
import { Game } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronDown } from 'lucide-react';
import { GameDetailSheet } from '@/components/dashboard/GameDetailSheet';

interface PredictionData {
    matchup: string;
    prediction: {
        projectedSpread: number;
        marketSpread: number;
        zScore: number;
        betSignal: string;
        recommendedSide: string | null;
        confidence: string;
    };
    components: {
        home: { baseRating: number; injuryPenalty: number; finalTPR: number };
        away: { baseRating: number; injuryPenalty: number; finalTPR: number };
        hca: { total: number; breakdown: any };
    };
    injuries: {
        home: Array<{ name: string; status: string; impact: string }>;
        away: Array<{ name: string; status: string; impact: string }>;
    };
    trace?: any;
}

export function ModelPredictionCard({ game, compact = false, preloadedData }: { game: Game; compact?: boolean, preloadedData?: any }) {
    const [data, setData] = useState<PredictionData | null>(preloadedData || null);
    const [loading, setLoading] = useState(!preloadedData);
    const [error, setError] = useState<string | null>(null);
    const [showDetail, setShowDetail] = useState(false);

    useEffect(() => {
        if (preloadedData) {
            setData(preloadedData);
            setLoading(false);
            return;
        }

        async function fetchModelData() {
            setLoading(true);
            try {
                let spreadPoints: number | string = 'null';
                const hasValidSpread = game.odds?.spread !== undefined && typeof game.odds?.spread?.points === 'number';

                if (hasValidSpread) {
                    spreadPoints = game.odds?.spread?.points as number;
                    if (Math.abs(spreadPoints) > 50) spreadPoints = 'null';
                }

                const response = await fetch(`/api/predict-game?home=${game.homeTeam.name}&away=${game.awayTeam.name}&marketSpread=${spreadPoints}`);
                const result = await response.json();

                if (!response.ok) throw new Error(result.error || 'Failed to calculate');

                setData(result);
            } catch (e: any) {
                console.error(e);
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }

        if (game) {
            fetchModelData();
        }
    }, [game, preloadedData]);

    if (loading) {
        return (
            <Card className="bg-slate-900 border-slate-800 h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </Card>
        );
    }

    if (error || !data || !data.prediction) {
        return (
            <Card className="bg-red-950/20 border-red-900/50 p-4 flex items-center justify-center">
                <span className="text-red-400 text-sm">Unavailable: {error || "Invalid Data"}</span>
            </Card>
        );
    }

    const { prediction, injuries = { home: [], away: [] } } = data;
    const isHomePick = prediction.recommendedSide === game.homeTeam.name;
    const pickSide = prediction.recommendedSide || "No Play";
    const pickLogo = isHomePick ? game.homeTeam.logo : game.awayTeam.logo;

    const marketSpread = prediction.marketSpread;
    const projectedSpread = prediction.projectedSpread;

    const hasMarketSpread = marketSpread !== null && marketSpread !== undefined;

    const pickSpreadDisplay = !hasMarketSpread 
        ? 'No Line'
        : isHomePick
            ? (marketSpread > 0 ? `+${marketSpread}` : (marketSpread === 0 ? 'PK' : marketSpread))
            : (marketSpread * -1 > 0 ? `+${marketSpread * -1}` : (marketSpread === 0 ? 'PK' : marketSpread * -1));

    const projOnPick = isHomePick ? projectedSpread : -projectedSpread;
    const projDisplay = projOnPick > 0 ? `+${projOnPick.toFixed(1)}` : projOnPick.toFixed(1);

    const signalColors: Record<string, string> = {
        'ELITE VALUE': 'text-green-400 bg-green-950/40 border-green-500/50',
        'STRONG VALUE': 'text-brand-400 bg-brand-950/40 border-brand-500/50',
        'PLAYABLE': 'text-yellow-400 bg-yellow-950/40 border-yellow-500/50',
        'No Play': 'text-slate-400 bg-slate-900 border-slate-700'
    };
    const activeColor = signalColors[prediction.betSignal] || signalColors['No Play'];

    return (
        <>
            <Card className={`overflow-hidden border-slate-800 bg-slate-900 ${compact ? '' : 'h-full'}`}>
                {/* Header */}
                <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center text-white">
                    <div className="text-xs font-bold uppercase tracking-wider">
                        {game.awayTeam.name} @ {game.homeTeam.name}
                    </div>
                    {prediction.betSignal !== 'No Play' && (
                        <Badge variant="outline" className={`${prediction.betSignal.includes('ELITE') ? 'bg-green-600/20 text-green-400 border-green-500/30' : 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30'} text-[10px] font-bold uppercase py-0 px-2`}>
                            {prediction.betSignal}
                        </Badge>
                    )}
                </div>

                <CardContent className="p-0">
                    <div className="p-5 flex flex-col gap-5">

                        {/* Recommendation Box */}
                        <div className={`p-4 rounded-xl border ${activeColor} relative overflow-hidden`}>
                            <div className="flex justify-between items-center z-10 relative">
                                <div>
                                    <div className="text-[10px] uppercase opacity-80 font-bold mb-1">Recommended Pick</div>
                                    <div className="flex items-center gap-3">
                                        {pickLogo && prediction.recommendedSide && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={pickLogo} alt={pickSide} className="w-10 h-10 object-contain drop-shadow-lg" />
                                        )}
                                        <div className="text-2xl font-black text-white">
                                            {pickSide} <span className="opacity-80 font-mono text-lg">{prediction.recommendedSide ? pickSpreadDisplay : ''}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] uppercase opacity-80 font-bold mb-1">Z-Score</div>
                                    <div className="text-3xl font-black text-white">
                                        {hasMarketSpread ? prediction.zScore.toFixed(2) : '-.--'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Vegas vs Model */}
                        <div className="flex items-center justify-between text-sm px-1">
                            <div className="text-center w-[45%]">
                                <div className="text-[10px] text-slate-500 uppercase font-black mb-1">Vegas Line</div>
                                <div className="text-sm font-mono font-bold bg-slate-800 text-slate-300 px-3 py-2 rounded flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap">
                                    <span className="opacity-60">{isHomePick ? game.homeTeam.name : game.awayTeam.name}</span>
                                    <span>{hasMarketSpread ? pickSpreadDisplay : 'No Line'}</span>
                                </div>
                            </div>
                            <div className="text-slate-700 font-black text-[10px]">VS</div>
                            <div className="text-center w-[45%]">
                                <div className="text-[10px] text-brand-400 uppercase font-black mb-1">Model Proj</div>
                                <div className="text-sm font-mono font-bold bg-brand-950/30 text-brand-300 border border-brand-500/30 px-3 py-2 rounded flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap">
                                    <span className="opacity-60">{isHomePick ? game.homeTeam.name : game.awayTeam.name}</span>
                                    <span>{projDisplay}</span>
                                </div>
                            </div>
                        </div>

                        {/* Injuries Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { label: game.awayTeam.name, list: injuries.away },
                                { label: game.homeTeam.name, list: injuries.home },
                            ].map(({ label, list }) => (
                                <div key={label} className="bg-slate-950/40 rounded-lg p-3 border border-slate-800/50">
                                    <div className="text-[9px] text-slate-500 uppercase font-black mb-3 flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                                        <div className="w-2 h-2 rounded-full bg-slate-700 shrink-0" />
                                        <span>{label} Injuries</span>
                                    </div>
                                    <div className="space-y-2">
                                        {list.length > 0 ? (
                                            list.map((inj, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-[10px]">
                                                    <div className="flex flex-col">
                                                        <span className="text-slate-300 font-bold truncate max-w-[80px]">{inj.name}</span>
                                                        <span className="text-slate-600 text-[9px] uppercase">{inj.status}</span>
                                                    </div>
                                                    <div className="font-mono text-red-400/80 font-bold">{inj.impact}</div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-[10px] text-green-500/40 italic font-medium py-1">Healthy</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* See Details Button */}
                        {data.trace && (
                            <button
                                onClick={() => setShowDetail(true)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-brand-500/30 bg-brand-950/20 text-brand-400 text-xs font-bold hover:bg-brand-950/40 hover:border-brand-400/50 transition-all group"
                            >
                                <span>See Full Computation Breakdown</span>
                                <ChevronDown className="h-3.5 w-3.5 group-hover:translate-y-0.5 transition-transform" />
                            </button>
                        )}

                    </div>
                </CardContent>
            </Card>

            {/* Computation Detail Sheet */}
            {data.trace && (
                <GameDetailSheet
                    open={showDetail}
                    onOpenChange={setShowDetail}
                    matchup={data.matchup || `${game.awayTeam.name} @ ${game.homeTeam.name}`}
                    trace={data.trace}
                    homeLogo={game.homeTeam.logo}
                    awayLogo={game.awayTeam.logo}
                />
            )}
        </>
    );
}
