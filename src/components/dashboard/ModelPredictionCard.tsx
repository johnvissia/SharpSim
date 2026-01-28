'use client';

import { useEffect, useState } from 'react';
import { Game } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, AlertTriangle, Activity, ArrowRight, DollarSign, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PredictionData {
    homeTeam: string;
    awayTeam: string;
    homeBaseline: number;
    awayBaseline: number;
    homeInjuries: Array<{ name: string; status: string; impact: number; tier: string }>;
    awayInjuries: Array<{ name: string; status: string; impact: number; tier: string }>;
    homeTotalPenalty: number;
    awayTotalPenalty: number;
    homeFinalTPR: number;
    awayFinalTPR: number;
    projectedSpread: number;
    marketSpread: number;
    edge: number;
    valueTier: 'High' | 'Medium' | 'Low' | 'None';
    recommendation: string;
    hca: number;
}

export function ModelPredictionCard({ game, compact = false, preloadedData }: { game: Game; compact?: boolean, preloadedData?: PredictionData }) {
    const [data, setData] = useState<PredictionData | null>(preloadedData || null);
    const [loading, setLoading] = useState(!preloadedData);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (preloadedData) {
            setData(preloadedData);
            setLoading(false);
            return;
        }

        async function fetchModelData() {
            setLoading(true);
            try {
                // Get Market Spread Points
                let spreadPoints = game.odds?.spread?.points || 0;
                if (!spreadPoints && game.odds?.spread?.home) {
                    spreadPoints = game.odds.spread.home;
                }
                if (Math.abs(spreadPoints) > 50) spreadPoints = 0;

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

    if (error || !data) {
        return (
            <Card className="bg-red-950/20 border-red-900/50 p-4 flex items-center justify-center">
                <span className="text-red-400 text-sm">Unavailable: {error}</span>
            </Card>
        );
    }

    // Determine Pick Side
    const pickSide = data.projectedSpread < data.marketSpread ? data.homeTeam : data.awayTeam;
    const pickLogo = pickSide === data.homeTeam ? game.homeTeam.logo : game.awayTeam.logo;
    const isHomePick = pickSide === data.homeTeam;

    // Tier Colors
    const tierColors = {
        'High': 'text-green-400 bg-green-950/40 border-green-500/50',
        'Medium': 'text-yellow-400 bg-yellow-950/40 border-yellow-500/50',
        'Low': 'text-blue-400 bg-blue-950/40 border-blue-500/50',
        'None': 'text-slate-400 bg-slate-900 border-slate-700'
    };
    const activeColor = tierColors[data.valueTier || 'None'];

    // Formatted Spreads
    const marketFormat = data.marketSpread > 0 ? `+${data.marketSpread}` : data.marketSpread;
    const projFormat = data.projectedSpread > 0 ? `+${(-data.projectedSpread).toFixed(1)}` : `${(-data.projectedSpread).toFixed(1)}`;
    // Note: projectedSpread in backend is -(Home-Away). So if Home is -10 (favored), Proj is -10.
    // Display standard: Home -10. 

    const pickSpreadDisplay = isHomePick
        ? (data.marketSpread > 0 ? `+${data.marketSpread}` : data.marketSpread)
        : (data.marketSpread * -1 > 0 ? `+${data.marketSpread * -1}` : data.marketSpread * -1);

    return (
        <Card className={`overflow-hidden border-slate-800 bg-slate-900 ${compact ? '' : 'h-full'}`}>
            {/* Header: Matchup & Date */}
            <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        {game.awayTeam.name} @ {game.homeTeam.name}
                    </div>
                </div>
                {(data.valueTier === 'High' || data.valueTier === 'Medium') && (
                    <Badge variant="outline" className={`${data.valueTier === 'High' ? 'bg-green-900 text-green-300 border-green-700' : 'bg-yellow-900 text-yellow-300 border-yellow-700'} text-xs`}>
                        {data.valueTier} Value
                    </Badge>
                )}
            </div>

            <CardContent className="p-0">
                <div className="p-5 flex flex-col gap-5">

                    {/* Visual Recommendation Box */}
                    <div className={`p-4 rounded-xl border ${activeColor} relative overflow-hidden`}>
                        <div className="flex justify-between items-center z-10 relative">
                            <div>
                                <div className="text-[10px] uppercase opacity-80 font-bold mb-1">Recommended Pick</div>
                                <div className="flex items-center gap-3">
                                    {pickLogo && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={pickLogo} alt={pickSide} className="w-10 h-10 object-contain" />
                                    )}
                                    <div className="text-2xl font-black">
                                        {pickSide} <span className="opacity-80">{pickSpreadDisplay}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] uppercase opacity-80 font-bold mb-1">Edge</div>
                                <div className="text-3xl font-black">
                                    {data.edge.toFixed(1)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Comparison Bar */}
                    <div className="flex items-center justify-between text-sm px-1">
                        <div className="text-center">
                            <div className="text-xs text-slate-500 uppercase font-bold mb-1">Vegas Line</div>
                            <div className="text-lg font-mono font-bold bg-slate-800 px-3 py-1 rounded">
                                {data.homeTeam} {marketFormat}
                            </div>
                        </div>
                        <div className="text-slate-600 font-bold">VS</div>
                        <div className="text-center">
                            <div className="text-xs text-indigo-400 uppercase font-bold mb-1">Model Proj</div>
                            <div className="text-lg font-mono font-bold bg-indigo-950/30 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded">
                                {data.homeTeam} {
                                    (() => {
                                        const displayVal = -data.projectedSpread;
                                        return displayVal > 0 ? `+${displayVal.toFixed(1)}` : displayVal.toFixed(1);
                                    })()
                                }
                            </div>
                        </div>
                    </div>

                    {/* Impact Injuries List */}
                    <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                        <div className="text-xs text-slate-500 uppercase font-bold mb-3 flex items-center gap-2">
                            <AlertTriangle className="w-3 h-3" />
                            High Impact Injuries
                        </div>
                        <div className="space-y-2">
                            {[...data.homeInjuries, ...data.awayInjuries]
                                .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
                                .slice(0, 3) // Show top 3 only
                                .map((inj, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-1.5 h-1.5 rounded-full ${data.homeInjuries.includes(inj) ? 'bg-blue-400' : 'bg-red-400'}`}></span>
                                            <span className="text-slate-300">{inj.name}</span>
                                            <span className="text-slate-600">({inj.status})</span>
                                        </div>
                                        <div className="font-mono text-red-400">
                                            {inj.impact.toFixed(1)} pts
                                        </div>
                                    </div>
                                ))}
                            {[...data.homeInjuries, ...data.awayInjuries].length === 0 && (
                                <div className="text-xs text-green-500/70 italic text-center py-1">Full Strength</div>
                            )}
                        </div>
                    </div>

                </div>
            </CardContent>
        </Card >
    );
}
