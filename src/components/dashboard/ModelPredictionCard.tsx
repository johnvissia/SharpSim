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
    }, [game]);

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
                <span className="text-red-400 text-sm">Unavailable</span>
            </Card>
        );
    }

    // Determine Pick Side
    const pickSide = data.projectedSpread < data.marketSpread ? data.homeTeam : data.awayTeam;
    const isHomePick = pickSide === data.homeTeam;
    const edgeColor = data.edge > 4 ? "text-green-400" : data.edge > 2 ? "text-yellow-400" : "text-slate-400";
    const edgeBg = data.edge > 4 ? "bg-green-500/10 border-green-500/20" : "bg-yellow-500/10 border-yellow-500/20";

    // Format projected spread vs market
    // Market: Home -3. Project Home -10. 
    // Pick: Home.
    // Display: "Pick: Home -3.0 (Target -10.0)"

    const marketLineDisplay = data.marketSpread > 0 ? `+${data.marketSpread}` : data.marketSpread;
    const projLineDisplay = data.projectedSpread > 0 ? `+${(-data.projectedSpread).toFixed(1)}` : `${data.projectedSpread.toFixed(1)}`;
    // Wait, projectedSpread is negative for Home favored? 
    // Logic: projectedSpread = -(Home - Away). 
    // If Home is better by 10, Gap=10. Proj = -10. Correct.
    // Display string: Home -10.0.

    // Correct formatting for display
    const targetSpread = isHomePick ? data.projectedSpread : -data.projectedSpread; // As viewed from pick side?
    // Let's stick to Home-relative spread for clarity in debug, but for UI user needs "Team +/- X"

    const pickLine = isHomePick
        ? (data.marketSpread > 0 ? `+${data.marketSpread}` : data.marketSpread)
        : (data.marketSpread > 0 ? `-${data.marketSpread}` : `+${Math.abs(data.marketSpread)}`); // Logic varies based on how marketSpread is stored (Home relative?)

    // Simplified: JUST SHOW WHO TO BET

    return (
        <Card className={`overflow-hidden border-slate-800 bg-slate-900 ${compact ? '' : 'h-full'}`}>
            {/* Header: Matchup & Date */}
            <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Model Prediction
                </div>
                {data.edge > 3 && (
                    <Badge variant="outline" className="bg-green-950 text-green-400 border-green-800 text-xs gap-1">
                        <Trophy className="w-3 h-3" /> Top Value
                    </Badge>
                )}
            </div>

            <CardContent className="p-0">
                <div className="p-5 flex flex-col gap-4">

                    {/* Visual Recommendation */}
                    <div className={`p-4 rounded-xl border ${edgeBg} flex items-center justify-between`}>
                        <div>
                            <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Recommended Pick</div>
                            <div className="text-2xl font-black text-white flex items-baseline gap-2">
                                {pickSide}
                                <span className="text-lg font-medium text-slate-400">
                                    {isHomePick ? (data.marketSpread > 0 ? `+${data.marketSpread}` : data.marketSpread) : (data.marketSpread * -1 > 0 ? `+${data.marketSpread * -1}` : data.marketSpread * -1)}
                                </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                                Target Line: {isHomePick ? data.homeTeam : data.awayTeam} {isHomePick ? data.projectedSpread.toFixed(1) : (-data.projectedSpread).toFixed(1)}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Model Edge</div>
                            <div className={`text-3xl font-black ${edgeColor}`}>
                                {data.edge.toFixed(1)}<span className="text-sm font-medium text-slate-500">pts</span>
                            </div>
                        </div>
                    </div>

                    {/* Grid Stats */}
                    <div className="grid grid-cols-2 gap-px bg-slate-800/50 rounded-lg overflow-hidden border border-slate-800">
                        <div className="bg-slate-900/80 p-3 text-center">
                            <div className="text-[10px] uppercase text-slate-500 font-bold">Proj Margin</div>
                            <div className="text-sm font-semibold text-slate-200">
                                {data.projectedSpread < 0 ? `${data.homeTeam} by ${Math.abs(data.projectedSpread).toFixed(1)}` : `${data.awayTeam} by ${data.projectedSpread.toFixed(1)}`}
                            </div>
                        </div>
                        <div className="bg-slate-900/80 p-3 text-center">
                            <div className="text-[10px] uppercase text-slate-500 font-bold">Impact Injuries</div>
                            <div className="text-sm font-semibold text-red-300">
                                {data.homeTotalPenalty < -1 && `${data.homeTeam} `}
                                {data.awayTotalPenalty < -1 && `${data.awayTeam} `}
                                {data.homeTotalPenalty >= -1 && data.awayTotalPenalty >= -1 && "None"}
                            </div>
                        </div>
                    </div>

                    {/* Detailed Analysis (Hidden in compact mode or separate?) */}
                    {!compact && (
                        <div className="space-y-3 pt-2 text-sm">
                            <div className="flex justify-between items-center text-xs pb-1 border-b border-slate-800">
                                <span className="text-slate-500">TPR Breakdown</span>
                                <span className="text-slate-500">Score</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className={data.homeFinalTPR > data.awayFinalTPR ? "font-bold text-white" : "text-slate-400"}>{data.homeTeam}</span>
                                    <span className="text-[10px] text-slate-500">Base: {data.homeBaseline.toFixed(1)} | Inj: {data.homeTotalPenalty.toFixed(1)}</span>
                                </div>
                                <span className="font-mono font-medium">{data.homeFinalTPR.toFixed(1)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className={data.awayFinalTPR > data.homeFinalTPR ? "font-bold text-white" : "text-slate-400"}>{data.awayTeam}</span>
                                    <span className="text-[10px] text-slate-500">Base: {data.awayBaseline.toFixed(1)} | Inj: {data.awayTotalPenalty.toFixed(1)}</span>
                                </div>
                                <span className="font-mono font-medium">{data.awayFinalTPR.toFixed(1)}</span>
                            </div>

                            {/* HCA Line */}
                            <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
                                <span>Home Court Advantage</span>
                                <span>+{data.hca} pts</span>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
