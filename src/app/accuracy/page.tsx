'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, History, RefreshCcw, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface GradedPrediction {
    id: string;
    gameId: string;
    sport: string;
    homeTeam: string;
    awayTeam: string;
    startTime: string;
    marketSpread: number;
    projectedSpread: number;
    recommendedSide: string;
    betSignal: string;
    actualScore: { home: number; away: number };
    actualSpread: number;
    correct: boolean;
    status: string;
}

export default function AccuracyPage() {
    const [predictions, setPredictions] = useState<GradedPrediction[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [stats, setStats] = useState({
        total: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        roi: 0
    });
    const [activeTab, setActiveTab] = useState('ALL');

    const calculateStats = (data: GradedPrediction[]) => {
        const graded = data.filter(p => p.status === 'graded');
        const wins = graded.filter(p => p.correct).length;
        const losses = graded.length - wins;
        const winRate = graded.length > 0 ? (wins / graded.length) * 100 : 0;

        return {
            total: graded.length,
            wins,
            losses,
            winRate,
            roi: (winRate * 0.90) - ((100 - winRate)) // Rough ROI based on -110 odds
        };
    };

    const fetchPredictions = async () => {
        setLoading(true);
        try {
            // Use server-side API route to avoid Firestore client permission issues
            const res = await fetch('/api/accuracy-data');
            if (!res.ok) throw new Error('Failed to fetch predictions');
            const { predictions: data } = await res.json();
            setPredictions(data as GradedPrediction[]);
            setStats(calculateStats(data as GradedPrediction[]));
        } catch (e) {
            console.error('[AccuracyPage] fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    const filteredPredictions = activeTab === 'ALL'
        ? predictions
        : predictions.filter(p => p.betSignal?.toUpperCase() === activeTab);

    const filteredStats = calculateStats(filteredPredictions);

    useEffect(() => {
        fetchPredictions();
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/sync-accuracy');
            if (res.ok) {
                await fetchPredictions();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <History className="h-8 w-8 text-brand-400" />
                        Model Accuracy
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Historical performance tracking of model predictions.
                    </p>
                </div>
                <Button
                    onClick={handleSync}
                    disabled={syncing}
                    className="bg-brand-600 hover:bg-brand-700 text-white"
                >
                    {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                    Sync & Grade
                </Button>
            </div>

            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Win Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-brand-400">{filteredStats.winRate.toFixed(1)}%</div>
                        <p className="text-xs text-slate-500 mt-1">{filteredStats.wins}W - {filteredStats.losses}L</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Total Graded</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{filteredStats.total}</div>
                        <p className="text-xs text-slate-500 mt-1">Predictions ({activeTab})</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Est. ROI</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${filteredStats.roi >= 0 ? 'text-brand-400' : 'text-rose-400'}`}>
                            {filteredStats.roi > 0 ? '+' : ''}{filteredStats.roi.toFixed(1)}%
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Based on -110 standard</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Badge className="bg-brand-500/10 text-brand-500 border-brand-500/20">Active</Badge>
                        <p className="text-xs text-slate-500 mt-1">Snapshotting every 15m</p>
                    </CardContent>
                </Card>
            </div>

            {/* Predictions Table */}
            <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                    <CardTitle className="text-lg">Recent Predictions</CardTitle>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-slate-950/50 p-1 rounded-lg border border-slate-800">
                        <TabsList className="bg-transparent h-8">
                            <TabsTrigger value="ALL" className="text-xs data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                                All
                            </TabsTrigger>
                            <TabsTrigger value="ELITE VALUE" className="text-xs data-[state=active]:bg-brand-500/20 data-[state=active]:text-brand-400">
                                Elite
                            </TabsTrigger>
                            <TabsTrigger value="STRONG VALUE" className="text-xs data-[state=active]:bg-brand-500/20 data-[state=active]:text-brand-400">
                                Strong
                            </TabsTrigger>
                            <TabsTrigger value="PLAYABLE" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-slate-300">
                                Playable
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-300">
                            <thead className="text-xs text-slate-500 uppercase border-b border-slate-800">
                                <tr>
                                    <th className="px-4 py-3">Matchup</th>
                                    <th className="px-4 py-3">Recommendation</th>
                                    <th className="px-4 py-3">Signal</th>
                                    <th className="px-4 py-3">Result</th>
                                    <th className="px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-600" />
                                        </td>
                                    </tr>
                                ) : filteredPredictions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-slate-500">
                                            No {activeTab !== 'ALL' ? activeTab.toLowerCase() : ''} predictions found.
                                        </td>
                                    </tr>
                                ) : filteredPredictions.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-4">
                                            <div className="font-medium text-white">{p.awayTeam} @ {p.homeTeam}</div>
                                            <div className="text-xs text-slate-500">{new Date(p.startTime).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-4 py-4 text-white">
                                            <Badge variant="outline" className="border-brand-500/50 text-brand-400">
                                                {p.recommendedSide} {p.marketSpread > 0 ? `+${p.marketSpread}` : p.marketSpread}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-col gap-1">
                                                <Badge className={`text-[10px] w-fit font-bold ${p.betSignal?.includes('ELITE') ? 'bg-brand-500/20 text-brand-400 border-brand-500/30' :
                                                    p.betSignal?.includes('STRONG') ? 'bg-brand-500/20 text-brand-400 border-brand-500/30' :
                                                        'bg-slate-800 text-slate-400 border-slate-700'
                                                    }`}>
                                                    {p.betSignal || 'NO SIGNAL'}
                                                </Badge>
                                                <div className="text-[10px] text-slate-500">
                                                    Proj: {p.projectedSpread} (Line: {p.marketSpread})
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            {p.status === 'graded' ? (
                                                <div className="flex items-center gap-2">
                                                    {p.correct ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-rose-500" />}
                                                    <span className={p.correct ? 'text-emerald-500 font-bold' : 'text-rose-500'}>
                                                        {p.actualScore.away} - {p.actualScore.home}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-500">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            <Badge className={p.status === 'graded' ? 'bg-slate-800 text-slate-400' : 'bg-brand-500/10 text-brand-400'}>
                                                {p.status.toUpperCase()}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
