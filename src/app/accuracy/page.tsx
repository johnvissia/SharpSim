'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, History, RefreshCcw, CheckCircle2, XCircle, Trophy, Target, Calendar as CalendarIcon, CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

import type { DateRange } from 'react-day-picker';

interface GradedPrediction {
    id: string;
    gameId: string;
    sport: string;
    homeTeam: string;
    awayTeam: string;
    startTime: string;
    marketSpread: number;
    spreadSource?: string;
    projectedSpread: number;
    recommendedSide: string;
    betSignal: string;
    actualScore: { home: number; away: number };
    actualSpread: number;
    correct: boolean;
    status: string;
}

const getDateString = (d: Date) => d.toLocaleDateString('en-CA');

const getTodayDateStr = () => getDateString(new Date());

const getYesterdayDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getDateString(d);
};

export default function AccuracyPage() {
    const [predictions, setPredictions] = useState<GradedPrediction[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [selectedSport, setSelectedSport] = useState<string>('ALL');
    const [activeTab, setActiveTab] = useState('ALL');

    // Date Filtering state
    const [selectedDateFilter, setSelectedDateFilter] = useState<'ALL' | 'YESTERDAY' | 'TODAY' | 'RANGE'>('ALL');
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

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

    const fetchPredictions = async (sport: string = selectedSport) => {
        setLoading(true);
        try {
            const url = sport === 'ALL' ? '/api/accuracy-data?limit=500' : `/api/accuracy-data?sport=${sport}&limit=500`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch predictions');
            const { predictions: data } = await res.json();
            setPredictions((data || []) as GradedPrediction[]);
        } catch (e) {
            console.error('[AccuracyPage] fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSportChange = (sport: string) => {
        setSelectedSport(sport);
        fetchPredictions(sport);
    };

    const filteredPredictions = predictions.filter(p => {
        const matchesSport = selectedSport === 'ALL' || p.sport?.toUpperCase() === selectedSport.toUpperCase();
        const matchesSignal = activeTab === 'ALL' || p.betSignal?.toUpperCase() === activeTab;
        
        let matchesDate = true;
        if (selectedDateFilter !== 'ALL' && p.startTime) {
            const pTime = new Date(p.startTime).getTime();

            if (selectedDateFilter === 'TODAY') {
                const pDateStr = new Date(p.startTime).toLocaleDateString('en-CA');
                matchesDate = pDateStr === getTodayDateStr();
            } else if (selectedDateFilter === 'YESTERDAY') {
                const pDateStr = new Date(p.startTime).toLocaleDateString('en-CA');
                matchesDate = pDateStr === getYesterdayDateStr();
            } else if (selectedDateFilter === 'RANGE' && dateRange?.from) {
                const fromTime = new Date(dateRange.from).setHours(0, 0, 0, 0);
                const toTime = dateRange.to
                    ? new Date(dateRange.to).setHours(23, 59, 59, 999)
                    : new Date(dateRange.from).setHours(23, 59, 59, 999);
                matchesDate = pTime >= fromTime && pTime <= toTime;
            }
        }

        return matchesSport && matchesSignal && matchesDate;
    });

    const filteredStats = calculateStats(filteredPredictions);

    useEffect(() => {
        fetchPredictions(selectedSport);
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/sync-accuracy');
            if (res.ok) {
                await fetchPredictions(selectedSport);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSyncing(false);
        }
    };

    const getSportBadgeColor = (sport: string) => {
        switch (sport?.toUpperCase()) {
            case 'MLB':
                return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'NBA':
                return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
            case 'NCAAM':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            default:
                return 'bg-slate-800 text-slate-400 border-slate-700';
        }
    };

    const getMascot = (fullName: string) => {
        if (!fullName) return '';
        if (fullName.includes('Red Sox')) return 'Red Sox';
        if (fullName.includes('White Sox')) return 'White Sox';
        if (fullName.includes('Blue Jays')) return 'Blue Jays';
        if (fullName.includes('Trail Blazers')) return 'Trail Blazers';
        if (fullName.includes('Golden Knights')) return 'Golden Knights';
        if (fullName.includes('Diamondbacks')) return 'D-Backs';
        if (fullName.includes('Demon Deacons')) return 'Demon Deacons';
        if (fullName.includes('Tar Heels')) return 'Tar Heels';
        if (fullName.includes('Blue Devils')) return 'Blue Devils';
        if (fullName.includes('Red Raiders')) return 'Red Raiders';
        if (fullName.includes('Horned Frogs')) return 'Horned Frogs';
        if (fullName.includes('Cornhuskers')) return 'Cornhuskers';

        const parts = fullName.trim().split(' ');
        return parts[parts.length - 1];
    };

    const getModelPickInfo = (p: GradedPrediction) => {
        const proj = p.projectedSpread ?? 0;
        const isMlb = p.sport?.toUpperCase() === 'MLB';
        const unit = isMlb ? 'runs' : 'pts';

        if (proj < 0) {
            return {
                winner: p.homeTeam,
                margin: Math.abs(proj),
                text: `${getMascot(p.homeTeam)} by ${Math.abs(proj).toFixed(1)} ${unit}`
            };
        } else if (proj > 0) {
            return {
                winner: p.awayTeam,
                margin: proj,
                text: `${getMascot(p.awayTeam)} by ${proj.toFixed(1)} ${unit}`
            };
        }
        return { winner: 'Toss-up', margin: 0, text: 'Toss-up' };
    };

    return (
        <div className="container mx-auto p-6 max-w-7xl space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                        <Target className="h-8 w-8 text-indigo-500" />
                        Model Accuracy & Tracked Picks
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Independent tracking of automated model predictions vs closing lines and actual scores.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        onClick={handleSync}
                        disabled={syncing}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2"
                    >
                        <RefreshCcw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing & Grading...' : 'Sync & Grade Predictions'}
                    </Button>
                </div>
            </div>

            {/* Date & Sport Filters Section */}
            <div className="space-y-4">
                {/* Date Controls */}
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    {/* Quick Date Tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pr-1">Date Filter:</span>
                        <Button
                            variant={selectedDateFilter === 'ALL' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => { setSelectedDateFilter('ALL'); setDateRange(undefined); }}
                            className={selectedDateFilter === 'ALL' ? 'bg-indigo-600 font-bold' : 'border-slate-800 bg-slate-950/40 text-slate-400'}
                        >
                            All Dates
                        </Button>
                        <Button
                            variant={selectedDateFilter === 'YESTERDAY' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedDateFilter('YESTERDAY')}
                            className={selectedDateFilter === 'YESTERDAY' ? 'bg-indigo-600 font-bold' : 'border-slate-800 bg-slate-950/40 text-slate-400'}
                        >
                            Yesterday
                        </Button>
                        <Button
                            variant={selectedDateFilter === 'TODAY' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedDateFilter('TODAY')}
                            className={selectedDateFilter === 'TODAY' ? 'bg-indigo-600 font-bold' : 'border-slate-800 bg-slate-950/40 text-slate-400'}
                        >
                            Today
                        </Button>
                    </div>

                    {/* Calendar Range Picker Popover */}
                    <div className="flex items-center gap-2">
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={`gap-2 border-indigo-500/40 font-bold ${selectedDateFilter === 'RANGE' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-950/60 text-indigo-300 hover:bg-slate-800'}`}
                                >
                                    <CalendarIcon className="h-4 w-4 text-indigo-400" />
                                    {selectedDateFilter === 'RANGE' && dateRange?.from ? (
                                        dateRange.to ? (
                                            `${dateRange.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${dateRange.to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                                        ) : (
                                            dateRange.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                        )
                                    ) : (
                                        'Select Date Range'
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-800 text-white shadow-2xl" align="end">
                                <Calendar
                                    mode="range"
                                    selected={dateRange}
                                    onSelect={(range) => {
                                        setDateRange(range);
                                        if (range?.from) {
                                            setSelectedDateFilter('RANGE');
                                        }
                                    }}
                                    numberOfMonths={1}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>

                        {selectedDateFilter !== 'ALL' && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setSelectedDateFilter('ALL'); setDateRange(undefined); }}
                                className="text-slate-400 hover:text-white text-xs h-8 px-2 gap-1"
                            >
                                <X className="h-3.5 w-3.5" />
                                Clear
                            </Button>
                        )}
                    </div>
                </div>

                {/* Sport Filter Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pr-1">Sport:</span>
                    {['ALL', 'NBA', 'NCAAM', 'MLB'].map((sport) => (
                        <Button
                            key={sport}
                            variant={selectedSport === sport ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleSportChange(sport)}
                            className={selectedSport === sport
                                ? 'bg-indigo-600 hover:bg-indigo-500 font-bold'
                                : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:text-white'
                            }
                        >
                            {sport === 'ALL' ? 'All Sports' : sport}
                        </Button>
                    ))}

                    {/* Active Filter Indicator Badge */}
                    {selectedDateFilter !== 'ALL' && (
                        <Badge className="ml-auto bg-indigo-500/10 text-indigo-400 border-indigo-500/30 font-bold text-xs">
                            {selectedDateFilter === 'TODAY' && 'Showing: Today'}
                            {selectedDateFilter === 'YESTERDAY' && 'Showing: Yesterday'}
                            {selectedDateFilter === 'RANGE' && dateRange?.from && (
                                dateRange.to
                                    ? `Range: ${dateRange.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to ${dateRange.to.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                                    : `Date: ${dateRange.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                            )}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-slate-900/60 border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Total Graded Games</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white">{filteredStats.total}</div>
                        <p className="text-xs text-slate-500 mt-1">Locked & Settled</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/60 border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Record (W-L)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-emerald-400">
                            {filteredStats.wins} - {filteredStats.losses}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Against Closing Line</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/60 border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Win Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-indigo-400">
                            {filteredStats.winRate.toFixed(1)}%
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Target: &gt;52.4% for Profit</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/60 border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Lockdown Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold">
                            T-15m Active
                        </Badge>
                        <p className="text-xs text-slate-500 mt-1">Locks 15 mins before tipoff</p>
                    </CardContent>
                </Card>
            </div>

            {/* Predictions Table */}
            <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                    <CardTitle className="text-lg font-bold">Lockdown Tracked Predictions</CardTitle>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-slate-950/50 p-1 rounded-lg border border-slate-800">
                        <TabsList className="bg-transparent h-8">
                            <TabsTrigger value="ALL" className="text-xs data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                                All
                            </TabsTrigger>
                            <TabsTrigger value="ELITE VALUE" className="text-xs data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-400">
                                Elite
                            </TabsTrigger>
                            <TabsTrigger value="STRONG VALUE" className="text-xs data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-400">
                                Strong
                            </TabsTrigger>
                            <TabsTrigger value="PLAYABLE" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-slate-300">
                                Playable
                            </TabsTrigger>
                            <TabsTrigger value="NO PLAY" className="text-xs data-[state=active]:bg-slate-800 data-[state=active]:text-amber-400 font-bold">
                                No Play (Slight Edge)
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-300">
                            <thead className="text-xs text-slate-500 uppercase border-b border-slate-800">
                                <tr>
                                    <th className="px-4 py-3">Sport</th>
                                    <th className="px-4 py-3">Matchup</th>
                                    <th className="px-4 py-3">Model Projected Winner</th>
                                    <th className="px-4 py-3">Spread Pick</th>
                                    <th className="px-4 py-3">Original Line</th>
                                    <th className="px-4 py-3">Signal</th>
                                    <th className="px-4 py-3">Result</th>
                                    <th className="px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-8">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-600" />
                                        </td>
                                    </tr>
                                ) : filteredPredictions.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-8 text-slate-500">
                                            No {selectedSport !== 'ALL' ? selectedSport : ''} {activeTab !== 'ALL' ? activeTab.toLowerCase() : ''} predictions recorded yet. Run &quot;Sync & Grade Predictions&quot; to snapshot locking games.
                                        </td>
                                    </tr>
                                ) : filteredPredictions.map((p) => {
                                    const pickInfo = getModelPickInfo(p);
                                    const recMascot = getMascot(p.recommendedSide || '');
                                    const homeMascot = getMascot(p.homeTeam || '');

                                    // Pick spread calculation
                                    const isHomePick = p.recommendedSide === p.homeTeam;
                                    const pickLine = isHomePick ? p.marketSpread : -p.marketSpread;
                                    const pickLineDisplay = pickLine > 0 ? `+${pickLine}` : pickLine === 0 ? 'PK' : `${pickLine}`;

                                    // Original Vegas Line calculation
                                    const origLineDisplay = p.marketSpread > 0 ? `+${p.marketSpread}` : p.marketSpread === 0 ? 'PK' : `${p.marketSpread}`;

                                    return (
                                        <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
                                            <td className="px-4 py-4">
                                                <Badge variant="outline" className={`font-bold ${getSportBadgeColor(p.sport)}`}>
                                                    {p.sport || 'NBA'}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="font-medium text-white">{p.awayTeam} @ {p.homeTeam}</div>
                                                <div className="text-xs text-slate-500">{new Date(p.startTime).toLocaleDateString()} {new Date(p.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Trophy className="h-4 w-4 text-amber-400 shrink-0" />
                                                    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold px-2.5 py-1 text-xs">
                                                        {pickInfo.text}
                                                    </Badge>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-white">
                                                {p.recommendedSide ? (
                                                    <Badge variant="outline" className="border-indigo-500/50 text-indigo-400 font-bold">
                                                        {recMascot || p.recommendedSide} {pickLineDisplay}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-slate-500">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <Badge variant="outline" className="border-slate-700 bg-slate-800/80 text-slate-200 font-bold font-mono w-fit">
                                                        {homeMascot || p.homeTeam} {origLineDisplay}
                                                    </Badge>
                                                    {p.spreadSource && p.spreadSource !== 'none' && (
                                                        <span className="text-[10px] text-slate-500 font-medium px-1">
                                                            {p.spreadSource}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <Badge className={`text-[10px] w-fit font-bold ${p.betSignal?.includes('ELITE') ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' :
                                                        p.betSignal?.includes('STRONG') ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' :
                                                            p.betSignal?.includes('PLAYABLE') ? 'bg-slate-700 text-slate-200' : 'bg-slate-800/80 text-amber-400 border-amber-500/20'
                                                        }`}>
                                                        {p.betSignal || 'NO PLAY'}
                                                    </Badge>
                                                    <div className="text-[10px] text-slate-500">
                                                        Proj: {p.projectedSpread} | Line: {p.marketSpread > 0 ? `+${p.marketSpread}` : p.marketSpread}
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
                                                    <span className="text-slate-500">Pending Game</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <Badge className={p.status === 'graded' ? 'bg-slate-800 text-slate-400' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}>
                                                    {p.status.toUpperCase()}
                                                </Badge>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
