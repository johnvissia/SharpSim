'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    Users,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    Loader2,
    ArrowUpRight,
    Target,
    Activity,
    ChevronRight
} from 'lucide-react';

interface PropPrediction {
    id: string;
    playerName: string;
    matchup: string;
    market: string;
    line: number;
    overOdds: number;
    underOdds: number;
    projectedPoints: number;
    seasonAvg: number;
    last5Avg: number;
    edge: number;
    recommendation: 'Over' | 'Under' | 'No Play';
    confidence: number;
    sampleSize: number;
}

export default function PropHubPage() {
    const [predictions, setPredictions] = useState<PropPrediction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchPredictions();
    }, []);

    const fetchPredictions = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/predict-props');
            if (!res.ok) throw new Error('Failed to fetch prop predictions');
            const data = await res.json();
            setPredictions(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                <p className="text-slate-400 font-medium animate-pulse text-sm uppercase tracking-widest">
                    Analyzing Player Forms...
                </p>
            </div>
        );
    }

    const topValue = predictions.filter(p => p.recommendation !== 'No Play').slice(0, 10);

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8">
            <header className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <Target className="h-10 w-10 text-indigo-500" />
                    <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">
                        Prop Hub <span className="text-indigo-500 font-normal not-italic">α</span>
                    </h1>
                </div>
                <p className="text-slate-400 max-w-2xl font-medium">
                    Mathematical projections for NBA Player Points. Ranked by market value (Edge) against the sharpest lines.
                </p>
            </header>

            {/* Market Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <Users className="w-5 h-5 text-indigo-400" />
                        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">Active</Badge>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white">{predictions.length}</h3>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Players Analyzed</p>
                    </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <TrendingUp className="w-5 h-5 text-green-400" />
                        <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">Value</Badge>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white">{topValue.length}</h3>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">High Edge Plays</p>
                    </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <Activity className="w-5 h-5 text-amber-400" />
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">Data</Badge>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white">L15</h3>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Lookback Window</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-white uppercase italic tracking-tight">Top Value Opportunities</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{new Date().toLocaleDateString()}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {topValue.map((prop) => (
                        <Card key={prop.id} className="border-slate-800 bg-slate-900/40 hover:bg-slate-900/60 transition-all border-l-4 border-l-indigo-500">
                            <CardContent className="p-5">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-black text-white">{prop.playerName}</h3>
                                            <Badge variant="outline" className={`${prop.recommendation === 'Over' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'} border-transparent font-black px-2 py-0`}>
                                                {prop.recommendation} {prop.line}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold uppercase">
                                            <span>{prop.matchup}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-xl font-black ${prop.edge > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {prop.edge > 0 ? '+' : ''}{prop.edge}% <span className="text-[10px] text-slate-600 uppercase">Edge</span>
                                        </div>
                                        <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Confidence: {prop.confidence.toFixed(0)}%</div>
                                    </div>
                                </div>

                                <div className="mt-6 grid grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <div className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">Market Line</div>
                                        <div className="text-lg font-bold text-white font-mono">{prop.line}</div>
                                    </div>
                                    <div className="space-y-1 border-x border-slate-800/50 px-4">
                                        <div className="text-[10px] text-indigo-400 uppercase font-black tracking-tighter">Model Proj</div>
                                        <div className="text-lg font-bold text-indigo-400 font-mono">{prop.projectedPoints}</div>
                                    </div>
                                    <div className="space-y-1 pl-4">
                                        <div className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">Trend (L5)</div>
                                        <div className="text-lg font-bold text-slate-300 font-mono">{prop.last5Avg}</div>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-800/50 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-slate-600 uppercase font-bold">Season Avg</span>
                                            <span className="text-xs text-slate-400 font-bold">{prop.seasonAvg}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-slate-600 uppercase font-bold">Games</span>
                                            <span className="text-xs text-slate-400 font-bold">{prop.sampleSize}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors">
                                        <span className="text-[10px] font-black uppercase tracking-widest italic">Bet Now</span>
                                        <ArrowUpRight className="w-3 h-3" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {topValue.length === 0 && !loading && (
                    <div className="bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl p-12 flex flex-col items-center gap-4 text-center">
                        <AlertCircle className="w-10 h-10 text-slate-700" />
                        <div>
                            <h3 className="text-slate-400 font-bold uppercase italic">No High-Value Props Found</h3>
                            <p className="text-sm text-slate-600">Model projections are currently within market error margins. Recalculate or check back closer to tip-off.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
