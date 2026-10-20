'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    Loader2, 
    RefreshCcw, 
    CheckCircle2, 
    XCircle, 
    Trophy, 
    Target, 
    Calendar as CalendarIcon, 
    X, 
    Lock, 
    Sparkles, 
    TrendingUp, 
    Layers, 
    Search, 
    LayoutGrid, 
    ListFilter,
    ShieldCheck,
    Clock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';

import type { DateRange } from 'react-day-picker';
import { useToast } from '@/hooks/use-toast';

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
    isFrozen?: boolean;
    frozenAt?: string;
    snapshotTime?: string;
    updatedAt?: string;
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
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

    // Date Filtering state - defaults to Last 5 Days to keep data clean and fast
    const [selectedDateFilter, setSelectedDateFilter] = useState<'LAST_5_DAYS' | 'TODAY' | 'YESTERDAY' | 'RANGE' | 'ALL'>('LAST_5_DAYS');
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
            roi: (winRate * 0.90) - (100 - winRate) // Rough ROI based on -110 odds
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

    // Base filtered predictions by sport and date
    const baseFilteredPredictions = useMemo(() => {
        const now = Date.now();
        const fiveDaysAgo = now - 5 * 24 * 60 * 60 * 1000;

        return predictions.filter(p => {
            const matchesSport = selectedSport === 'ALL' || p.sport?.toUpperCase() === selectedSport.toUpperCase();
            
            let matchesDate = true;
            const timeVal = p.startTime || p.snapshotTime || p.updatedAt;
            if (timeVal) {
                const pTime = new Date(timeVal).getTime();

                if (selectedDateFilter === 'LAST_5_DAYS') {
                    // Includes games in the last 5 days and upcoming fixtures
                    matchesDate = pTime >= fiveDaysAgo;
                } else if (selectedDateFilter === 'TODAY') {
                    const pDateStr = new Date(timeVal).toLocaleDateString('en-CA');
                    matchesDate = pDateStr === getTodayDateStr();
                } else if (selectedDateFilter === 'YESTERDAY') {
                    const pDateStr = new Date(timeVal).toLocaleDateString('en-CA');
                    matchesDate = pDateStr === getYesterdayDateStr();
                } else if (selectedDateFilter === 'RANGE' && dateRange?.from) {
                    const fromTime = new Date(dateRange.from).setHours(0, 0, 0, 0);
                    const toTime = dateRange.to
                        ? new Date(dateRange.to).setHours(23, 59, 59, 999)
                        : new Date(dateRange.from).setHours(23, 59, 59, 999);
                    matchesDate = pTime >= fromTime && pTime <= toTime;
                } else if (selectedDateFilter === 'ALL') {
                    matchesDate = true;
                }
            }

            // Do not show pending games that are scheduled more than 36 hours away (too far out to predict/lock)
            if (p.status === 'pending' && p.startTime) {
                const timeUntil = new Date(p.startTime).getTime() - now;
                if (timeUntil > 36 * 3600 * 1000) return false;
            }

            return matchesSport && matchesDate;
        });
    }, [predictions, selectedSport, selectedDateFilter, dateRange]);

    // Live counts for the signal filter tabs
    const signalCounts = useMemo(() => {
        const counts = { ALL: 0, 'ELITE VALUE': 0, 'STRONG VALUE': 0, 'PLAYABLE': 0, 'NO PLAY': 0 };
        baseFilteredPredictions.forEach(p => {
            counts.ALL += 1;
            const sig = p.betSignal?.toUpperCase() || 'NO PLAY';
            if (sig.includes('ELITE')) counts['ELITE VALUE'] += 1;
            else if (sig.includes('STRONG')) counts['STRONG VALUE'] += 1;
            else if (sig.includes('PLAYABLE')) counts['PLAYABLE'] += 1;
            else counts['NO PLAY'] += 1;
        });
        return counts;
    }, [baseFilteredPredictions]);

    // Final filtered predictions with signal and search query
    const filteredPredictions = useMemo(() => {
        return baseFilteredPredictions.filter(p => {
            const matchesSignal = activeTab === 'ALL' || (p.betSignal?.toUpperCase() || 'NO PLAY').includes(activeTab.replace(' VALUE', ''));
            
            let matchesSearch = true;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                matchesSearch = (p.homeTeam?.toLowerCase().includes(q) ?? false) ||
                                (p.awayTeam?.toLowerCase().includes(q) ?? false) ||
                                (p.recommendedSide?.toLowerCase().includes(q) ?? false);
            }

            return matchesSignal && matchesSearch;
        });
    }, [baseFilteredPredictions, activeTab, searchQuery]);

    const filteredStats = calculateStats(filteredPredictions);

    useEffect(() => {
        fetchPredictions(selectedSport);
    }, []);

    const { toast } = useToast();

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/sync-accuracy');
            if (res.ok) {
                const data = await res.json();
                await fetchPredictions(selectedSport);
                const gradedCount = data.graded?.length || 0;
                const snapshotCount = data.snapshots?.length || 0;
                toast({
                    title: "Sync & Grading Complete",
                    description: `Successfully graded ${gradedCount} completed game(s) and snapshotted ${snapshotCount} upcoming prediction(s).`,
                });
            } else {
                const err = await res.json().catch(() => ({}));
                toast({
                    title: "Sync Failed",
                    description: err.error || "Failed to sync predictions.",
                    variant: "destructive",
                });
            }
        } catch (e: any) {
            console.error(e);
            toast({
                title: "Sync Error",
                description: e.message || "An unexpected error occurred during sync.",
                variant: "destructive",
            });
        } finally {
            setSyncing(false);
        }
    };

    const getSportBadgeColor = (sport: string) => {
        switch (sport?.toUpperCase()) {
            case 'NFL':
                return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
            case 'MLB':
                return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
            case 'NBA':
                return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30';
            case 'NCAAM':
                return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30';
            case 'UCL':
                return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
            case 'EPL':
                return 'bg-purple-500/10 text-purple-400 border border-purple-500/30';
            default:
                return 'bg-slate-800 text-slate-400 border border-slate-700';
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
        if (fullName.includes('Real Madrid')) return 'Real Madrid';
        if (fullName.includes('Manchester City')) return 'Man City';
        if (fullName.includes('Paris Saint-Germain')) return 'PSG';
        if (fullName.includes('Borussia Dortmund')) return 'Dortmund';
        if (fullName.includes('Aston Villa')) return 'Aston Villa';
        if (fullName.includes('Real Betis')) return 'Real Betis';
        if (fullName.includes('AS Roma')) return 'AS Roma';
        if (fullName.includes('FC Porto')) return 'FC Porto';
        if (fullName.includes('Shakhtar Donetsk')) return 'Shakhtar';
        if (fullName.includes('Slovan Bratislava')) return 'Slovan';
        if (fullName.includes('VfB Stuttgart')) return 'Stuttgart';
        if (fullName.includes('LASK Linz')) return 'LASK Linz';
        if (fullName.includes('Bodo/Glimt')) return 'Bodo/Glimt';
        if (fullName.includes('Feyenoord')) return 'Feyenoord';

        const parts = fullName.trim().split(' ');
        return parts[parts.length - 1];
    };

    const getModelPickInfo = (p: GradedPrediction) => {
        const proj = p.projectedSpread ?? 0;
        const isMlb = p.sport?.toUpperCase() === 'MLB';
        const isSoccer = p.sport?.toUpperCase() === 'UCL' || p.sport?.toUpperCase() === 'EPL';
        const unit = isMlb ? 'runs' : isSoccer ? 'goals' : 'pts';

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

    const getEdgeInfo = (p: GradedPrediction) => {
        const isMlb = p.sport?.toUpperCase() === 'MLB';
        const isSoccer = p.sport?.toUpperCase() === 'UCL' || p.sport?.toUpperCase() === 'EPL';
        const unit = isMlb ? 'runs' : isSoccer ? 'goals' : 'pts';

        const proj = p.projectedSpread ?? 0;
        const market = p.marketSpread ?? 0;
        const diff = Math.abs(proj - market);

        return {
            diff: diff.toFixed(1),
            unit,
            text: `+${diff.toFixed(1)} ${unit} edge`
        };
    };

    const formatGameTime = (timeStr: string) => {
        try {
            const d = new Date(timeStr);
            const now = new Date();
            const isToday = d.toLocaleDateString('en-CA') === now.toLocaleDateString('en-CA');
            
            const timeFormat = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            if (isToday) {
                return `Today • ${timeFormat}`;
            }
            return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • ${timeFormat}`;
        } catch {
            return timeStr;
        }
    };

    const renderSignalBadge = (signal: string) => {
        const s = signal?.toUpperCase() || 'NO PLAY';
        if (s.includes('ELITE')) {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm">
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    Elite Value
                </span>
            );
        }
        if (s.includes('STRONG')) {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    Strong Value
                </span>
            );
        }
        if (s.includes('PLAYABLE')) {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Playable
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                No Play (Slight Edge)
            </span>
        );
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-8">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                        <Target className="h-8 w-8 text-indigo-500" />
                        Model Accuracy & Tracked Picks
                    </h1>
                    <div className="flex flex-wrap items-center gap-2.5 mt-2">
                        <p className="text-slate-400 text-sm">
                            Independent tracking of automated model predictions vs closing lines and settled scores.
                        </p>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                            <Lock className="w-3 h-3" /> Locks permanently 15m before kickoff (anti-tamper)
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        onClick={handleSync}
                        disabled={syncing}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2 shadow-lg shadow-indigo-600/20"
                    >
                        <RefreshCcw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing & Grading...' : 'Sync & Grade Predictions'}
                    </Button>
                </div>
            </div>

            {/* Top KPI Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-slate-900/60 border-slate-800 hover:border-slate-700/80 transition-all">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Settled Games</CardTitle>
                        <Layers className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white">{filteredStats.total}</div>
                        <p className="text-xs text-slate-500 mt-1">Locked & Graded</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/60 border-slate-800 hover:border-slate-700/80 transition-all">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Record (W - L)</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-emerald-400">
                            {filteredStats.wins} - {filteredStats.losses}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Against Closing Line</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/60 border-slate-800 hover:border-slate-700/80 transition-all">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Win Rate</CardTitle>
                        <Trophy className="h-4 w-4 text-indigo-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-indigo-400">
                            {filteredStats.winRate.toFixed(1)}%
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Target: &gt;52.4% Breakeven</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/60 border-slate-800 hover:border-slate-700/80 transition-all">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lockdown Mode</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            T-15m Active
                        </div>
                        <p className="text-xs text-slate-500 mt-1.5">Freezes 15m before start</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Quick Date Filters */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Date:</span>
                        <Button
                            variant={selectedDateFilter === 'LAST_5_DAYS' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => { setSelectedDateFilter('LAST_5_DAYS'); setDateRange(undefined); }}
                            className={selectedDateFilter === 'LAST_5_DAYS' ? 'bg-indigo-600 font-bold hover:bg-indigo-500 text-white' : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-white'}
                        >
                            Last 5 Days
                        </Button>
                        <Button
                            variant={selectedDateFilter === 'TODAY' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedDateFilter('TODAY')}
                            className={selectedDateFilter === 'TODAY' ? 'bg-indigo-600 font-bold hover:bg-indigo-500 text-white' : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-white'}
                        >
                            Today
                        </Button>
                        <Button
                            variant={selectedDateFilter === 'YESTERDAY' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedDateFilter('YESTERDAY')}
                            className={selectedDateFilter === 'YESTERDAY' ? 'bg-indigo-600 font-bold hover:bg-indigo-500 text-white' : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-white'}
                        >
                            Yesterday
                        </Button>
                        <Button
                            variant={selectedDateFilter === 'ALL' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => { setSelectedDateFilter('ALL'); setDateRange(undefined); }}
                            className={selectedDateFilter === 'ALL' ? 'bg-indigo-600 font-bold hover:bg-indigo-500 text-white' : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-white'}
                        >
                            All History
                        </Button>

                        {/* Calendar Popover */}
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
                                            `${dateRange.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${dateRange.to.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                                        ) : (
                                            dateRange.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                        )
                                    ) : (
                                        'Custom Range'
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-800 text-white shadow-2xl" align="start">
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

                    {/* Search Input */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                        <Input
                            type="text"
                            placeholder="Search team or pick..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 pl-8 text-xs bg-slate-950/60 border-slate-800 text-slate-200 placeholder:text-slate-500 rounded-md focus-visible:ring-indigo-500"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Sport Selector Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Sport:</span>
                    {['ALL', 'NFL', 'NBA', 'MLB', 'UCL', 'EPL', 'NCAAM'].map((sport) => (
                        <Button
                            key={sport}
                            variant={selectedSport === sport ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleSportChange(sport)}
                            className={`h-7 px-3 text-xs ${
                                selectedSport === sport
                                    ? 'bg-indigo-600 hover:bg-indigo-500 font-bold text-white'
                                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-white'
                            }`}
                        >
                            {sport === 'ALL' ? 'All Sports' : sport}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Main Lockdown Predictions Panel */}
            <Card className="bg-slate-900/60 border-slate-800 shadow-xl">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                    <div>
                        <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                            <span>Lockdown Tracked Predictions</span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                {filteredPredictions.length}
                            </span>
                        </CardTitle>
                        <p className="text-xs text-slate-400 mt-1">
                            Snapshot locked before game start. Compare model prediction with closing market line.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Tier Filter Tabs with Counts */}
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-slate-950/60 p-1 rounded-lg border border-slate-800">
                            <TabsList className="bg-transparent h-8 gap-1">
                                <TabsTrigger 
                                    value="ALL" 
                                    className="text-xs data-[state=active]:bg-slate-800 data-[state=active]:text-white font-medium"
                                >
                                    All ({signalCounts.ALL})
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="ELITE VALUE" 
                                    className="text-xs data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-400 font-semibold"
                                >
                                    Elite ({signalCounts['ELITE VALUE']})
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="STRONG VALUE" 
                                    className="text-xs data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 font-semibold"
                                >
                                    Strong ({signalCounts['STRONG VALUE']})
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="PLAYABLE" 
                                    className="text-xs data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 font-semibold"
                                >
                                    Playable ({signalCounts.PLAYABLE})
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="NO PLAY" 
                                    className="text-xs data-[state=active]:bg-slate-800 data-[state=active]:text-amber-400 font-semibold"
                                >
                                    No Play ({signalCounts['NO PLAY']})
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        {/* View Mode Toggle */}
                        <div className="flex items-center bg-slate-950/60 p-1 rounded-lg border border-slate-800">
                            <button
                                onClick={() => setViewMode('table')}
                                title="Table View"
                                className={`p-1.5 rounded text-xs transition-colors ${viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                <ListFilter className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setViewMode('cards')}
                                title="Cards View"
                                className={`p-1.5 rounded text-xs transition-colors ${viewMode === 'cards' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-20 text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
                            <p className="text-xs text-slate-400 mt-2 font-medium">Loading tracked predictions...</p>
                        </div>
                    ) : filteredPredictions.length === 0 ? (
                        <div className="py-16 text-center px-4">
                            <Target className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                            <h3 className="text-sm font-bold text-slate-300">No predictions found</h3>
                            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                                No {selectedSport !== 'ALL' ? selectedSport : ''} predictions match your current date and tier filters. Click &quot;Sync & Grade Predictions&quot; to snapshot games locking today.
                            </p>
                        </div>
                    ) : viewMode === 'table' ? (
                        /* Uncluttered, Modern 4-Column Table */
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                        <th className="py-3 px-5">Matchup & Time</th>
                                        <th className="py-3 px-5">Recommended Pick</th>
                                        <th className="py-3 px-5">Model vs Vegas (Edge)</th>
                                        <th className="py-3 px-5">Result & Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/70">
                                    {filteredPredictions.map((p) => {
                                        const pickInfo = getModelPickInfo(p);
                                        const homeMascot = getMascot(p.homeTeam || '');
                                        const recMascot = getMascot(p.recommendedSide || '');
                                        
                                        // Pick spread line calculation
                                        const isHomePick = p.recommendedSide === p.homeTeam;
                                        const pickLine = isHomePick ? p.marketSpread : -p.marketSpread;
                                        const pickLineDisplay = pickLine > 0 ? `+${pickLine}` : pickLine === 0 ? 'PK' : `${pickLine}`;

                                        // Original Vegas spread
                                        const origLineDisplay = p.marketSpread > 0 ? `+${p.marketSpread}` : p.marketSpread === 0 ? 'PK' : `${p.marketSpread}`;

                                        // Edge
                                        const edgeInfo = getEdgeInfo(p);

                                        // Is game locked? Only locks within 15m of start
                                        const timeUntilStart = p.startTime ? new Date(p.startTime).getTime() - Date.now() : Infinity;
                                        const isLocked = timeUntilStart <= 15 * 60 * 1000;

                                        return (
                                            <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                                                {/* 1. MATCHUP & TIME */}
                                                <td className="py-4 px-5 align-top">
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${getSportBadgeColor(p.sport)}`}>
                                                                {p.sport || 'NFL'}
                                                            </span>
                                                            <span className="text-xs text-slate-400 font-medium">
                                                                {formatGameTime(p.startTime)}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm font-semibold text-slate-100">
                                                            <span>{p.awayTeam}</span>
                                                            <span className="text-slate-500 font-normal mx-1.5">@</span>
                                                            <span>{p.homeTeam}</span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* 2. RECOMMENDED PICK */}
                                                <td className="py-4 px-5 align-top">
                                                    {p.recommendedSide ? (
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="text-base font-black text-white">
                                                                    {recMascot || p.recommendedSide}
                                                                </span>
                                                                <span className="text-base font-extrabold text-indigo-400 font-mono">
                                                                    {pickLineDisplay}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                {renderSignalBadge(p.betSignal)}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            <span className="text-xs text-slate-500 font-medium">Pass (No Edge)</span>
                                                            <div>{renderSignalBadge('NO PLAY')}</div>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* 3. MODEL VS MARKET (THE EDGE) */}
                                                <td className="py-4 px-5 align-top">
                                                    <div className="space-y-1 text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-400 font-medium">Vegas Line:</span>
                                                            <span className="font-bold text-slate-200 font-mono">
                                                                {homeMascot || p.homeTeam} {origLineDisplay}
                                                            </span>
                                                            {p.spreadSource && p.spreadSource !== 'none' && (
                                                                <span className="text-[10px] text-slate-500">
                                                                    ({p.spreadSource})
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-400 font-medium">Model Project:</span>
                                                            <span className="font-semibold text-indigo-300">
                                                                {pickInfo.text}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 pt-0.5 text-emerald-400 font-semibold">
                                                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                                            <span>{edgeInfo.text}</span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* 4. RESULT & STATUS */}
                                                <td className="py-4 px-5 align-top">
                                                    {p.status === 'graded' ? (
                                                        <div className="space-y-1.5">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${
                                                                p.correct 
                                                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                                            }`}>
                                                                {p.correct ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                                                {p.correct ? 'Covered (Win)' : 'Missed (Loss)'}
                                                            </span>
                                                            {p.actualScore && (
                                                                <div className="text-xs text-slate-400 font-mono">
                                                                    Final: <span className="text-slate-200 font-bold">{getMascot(p.awayTeam)} {p.actualScore.away} - {p.actualScore.home} {getMascot(p.homeTeam)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : isLocked ? (
                                                        <div className="space-y-1">
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                                                <Lock className="w-3 h-3" />
                                                                Locked (T-15m)
                                                            </span>
                                                            <div className="text-[11px] text-slate-400">
                                                                Snapshot frozen for grading
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                                                                <Clock className="w-3 h-3 text-slate-400" />
                                                                Pending Game
                                                            </span>
                                                            <div className="text-[11px] text-slate-500">
                                                                Locks 15m before kickoff
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* Modern Cards View Grid */
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredPredictions.map((p) => {
                                const pickInfo = getModelPickInfo(p);
                                const homeMascot = getMascot(p.homeTeam || '');
                                const recMascot = getMascot(p.recommendedSide || '');
                                
                                const isHomePick = p.recommendedSide === p.homeTeam;
                                const pickLine = isHomePick ? p.marketSpread : -p.marketSpread;
                                const pickLineDisplay = pickLine > 0 ? `+${pickLine}` : pickLine === 0 ? 'PK' : `${pickLine}`;
                                const origLineDisplay = p.marketSpread > 0 ? `+${p.marketSpread}` : p.marketSpread === 0 ? 'PK' : `${p.marketSpread}`;
                                const edgeInfo = getEdgeInfo(p);
                                const timeUntilStart = p.startTime ? new Date(p.startTime).getTime() - Date.now() : Infinity;
                                const isLocked = timeUntilStart <= 15 * 60 * 1000;

                                return (
                                    <div key={p.id} className="bg-slate-950/60 rounded-xl border border-slate-800 p-4 space-y-3.5 hover:border-slate-700/80 transition-all shadow-md">
                                        {/* Card Header: Sport, Time, and Status */}
                                        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${getSportBadgeColor(p.sport)}`}>
                                                    {p.sport || 'NFL'}
                                                </span>
                                                <span className="text-xs text-slate-400 font-medium">
                                                    {formatGameTime(p.startTime)}
                                                </span>
                                            </div>

                                            {p.status === 'graded' ? (
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                                                    p.correct ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                                                }`}>
                                                    {p.correct ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                    {p.correct ? 'Covered' : 'Missed'}
                                                </span>
                                            ) : isLocked ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold text-amber-400 bg-amber-500/10">
                                                    <Lock className="w-3 h-3" /> Locked
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-400 bg-slate-800/60 border border-slate-700/50">
                                                    <Clock className="w-3 h-3 text-slate-400" /> Pending
                                                </span>
                                            )}
                                        </div>

                                        {/* Matchup */}
                                        <div>
                                            <div className="text-xs text-slate-500 font-medium">Matchup</div>
                                            <div className="text-sm font-bold text-slate-100 mt-0.5">
                                                {p.awayTeam} <span className="text-slate-500 font-normal">@</span> {p.homeTeam}
                                            </div>
                                        </div>

                                        {/* The Pick Box */}
                                        <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-800 flex items-center justify-between">
                                            <div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recommended Pick</div>
                                                <div className="text-base font-black text-white mt-0.5">
                                                    {recMascot || p.recommendedSide || 'No Pick'}{' '}
                                                    <span className="text-indigo-400 font-mono">{p.recommendedSide ? pickLineDisplay : ''}</span>
                                                </div>
                                            </div>
                                            <div>
                                                {renderSignalBadge(p.betSignal)}
                                            </div>
                                        </div>

                                        {/* Market vs Model Edge Details */}
                                        <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/80">
                                            <div>
                                                <span className="text-slate-500 block text-[11px]">Vegas Line</span>
                                                <span className="font-semibold text-slate-300 font-mono">{homeMascot || p.homeTeam} {origLineDisplay}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block text-[11px]">Model Edge</span>
                                                <span className="font-bold text-emerald-400">{edgeInfo.text}</span>
                                            </div>
                                        </div>

                                        {/* Settled Score */}
                                        {p.status === 'graded' && p.actualScore && (
                                            <div className="text-xs bg-slate-900/50 rounded p-2 text-center text-slate-300 font-mono border border-slate-800/50">
                                                Final: <span className="font-bold text-white">{getMascot(p.awayTeam)} {p.actualScore.away} - {p.actualScore.home} {getMascot(p.homeTeam)}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
