'use client';

import { useState, useEffect, useMemo } from 'react';
import { GameCard } from '@/components/dashboard/game-card';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, orderBy, query, where, writeBatch, increment } from 'firebase/firestore';
import { syncGameLinesAndScores, syncNBAPlayerStats } from '@/lib/api';
import { fetchEspnSchedule, fetchAllTeamLogos } from '@/lib/espn';
import type { Game, Sport, SystemStatus, DailyGame, TeamRanking, Team, SportsbookOdds, UserBet, ParlayLeg, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader, RefreshCw, Users, Activity } from 'lucide-react';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { GameDetailModal } from '@/components/dashboard/GameDetailModal';
import { sportNameMapping } from '@/lib/sports';
import { getConference } from '@/lib/ncaa-conferences';
import { power4TeamNames } from '@/lib/power-4-teams';
import { useRouter } from 'next/navigation';
import { normalizeTeamName } from '@/lib/team-names';

const transformDailyGamesToGames = (
    dailyGames: DailyGame[] | null,
    rankingsMap: Map<string, { rank: number; conference: string }>,
    logoMap: Map<string, string>
): Game[] => {
    if (!dailyGames) return [];

    return dailyGames.map((dg): Game | null => {
        const sportName = sportNameMapping[dg.sportKey];
        if (!sportName) {
            console.warn(`No sport name mapping for key: ${dg.sportKey}`);
            return null;
        }

        const allOdds: SportsbookOdds[] = (dg.bookmakerOdds || []).map((jsonString: string): SportsbookOdds | null => {
            try {
                const bookmaker = JSON.parse(jsonString);
                const h2hMarket = bookmaker.markets.find((m: any) => m.key === 'h2h');
                const spreadsMarket = bookmaker.markets.find((m: any) => m.key === 'spreads');
                const totalsMarket = bookmaker.markets.find((m: any) => m.key === 'totals');

                const normalizedHome = normalizeTeamName(dg.homeTeam);
                const normalizedAway = normalizeTeamName(dg.awayTeam);

                const moneyline = {
                    home: h2hMarket?.outcomes.find((o: any) => normalizeTeamName(o.name) === normalizedHome)?.price || 0,
                    away: h2hMarket?.outcomes.find((o: any) => normalizeTeamName(o.name) === normalizedAway)?.price || 0,
                };

                // Don't discard the whole bookmaker if moneyline is missing
                if (!h2hMarket && !spreadsMarket && !totalsMarket) return null;

                let spread = { points: 0, home: 0, away: 0 };
                if (spreadsMarket) {
                    const homeSpreadOutcome = spreadsMarket.outcomes.find((o: any) => normalizeTeamName(o.name) === normalizedHome);
                    const awaySpreadOutcome = spreadsMarket.outcomes.find((o: any) => normalizeTeamName(o.name) === normalizedAway);
                    if (homeSpreadOutcome && awaySpreadOutcome) {
                        spread = { points: homeSpreadOutcome.point, home: homeSpreadOutcome.price, away: awaySpreadOutcome.price };
                    }
                }

                let total = { points: 0, over: 0, under: 0 };
                if (totalsMarket && totalsMarket.outcomes.length >= 2) {
                    total = {
                        points: totalsMarket.outcomes[0].point,
                        over: totalsMarket.outcomes.find((o: any) => o.name === 'Over')?.price || 0,
                        under: totalsMarket.outcomes.find((o: any) => o.name === 'Under')?.price || 0,
                    };
                }

                return {
                    sportsbook: bookmaker.title,
                    odds: { moneyline, spread, total },
                };
            } catch (e) {
                return null;
            }
        }).filter((o): o is SportsbookOdds => o !== null);

        const homeRankingInfo = rankingsMap.get(dg.homeTeam);
        const homeConference = homeRankingInfo?.conference || getConference(dg.homeTeam);

        const homeTeam: Team = {
            id: dg.homeTeam,
            name: dg.homeTeam,
            logo: logoMap.get(dg.homeTeam) || '',
            players: [],
            rank: homeRankingInfo?.rank,
            conference: homeConference,
        };

        const awayRankingInfo = rankingsMap.get(dg.awayTeam);
        const awayConference = awayRankingInfo?.conference || getConference(dg.awayTeam);

        const awayTeam: Team = {
            id: dg.awayTeam,
            name: dg.awayTeam,
            logo: logoMap.get(dg.awayTeam) || '',
            players: [],
            rank: awayRankingInfo?.rank,
            conference: awayConference,
        };

        const game: Game = {
            id: dg.id,
            sport: sportName,
            startTime: dg.commenceTime,
            homeTeam,
            awayTeam,
        };

        if (allOdds.length > 0) {
            game.allOdds = allOdds;
            // Search for an odds object that actually has a non-zero spread
            const bestOdds = allOdds.find(o => o.odds.spread && o.odds.spread.points !== 0);
            game.odds = bestOdds ? bestOdds.odds : allOdds[0].odds;
        }

        return game;
    }).filter((g): g is Game => g !== null);
};


export default function DashboardPage() {
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedConference, setSelectedConference] = useState('All');
    const [selectedSoccerLeague, setSelectedSoccerLeague] = useState('All');
    const [selectedGame, setSelectedGame] = useState<Game | null>(null);
    const [espnGames, setEspnGames] = useState<Game[]>([]);
    const [isLoadingEspn, setIsLoadingEspn] = useState(true);
    const [isSyncingLines, setIsSyncingLines] = useState(false);
    const [selectedDateOffset, setSelectedDateOffset] = useState(0);
    const [teamLogos, setTeamLogos] = useState<Map<string, string>>(new Map());

    const dateOptions = useMemo(() => {
        const options = [];
        for (let i = -1; i <= 1; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            let label = '';
            if (i === -1) label = 'Yesterday';
            else if (i === 0) label = 'Today';
            else if (i === 1) label = 'Tomorrow';

            options.push({
                offset: i,
                label,
                dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
                dateNum: d.getDate(),
                fullDate: d.toLocaleDateString('en-CA') // YYYY-MM-DD in local time
            });
        }
        return options;
    }, []);

    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [user, isUserLoading, router]);

    useEffect(() => {
        const loadLogos = async () => {
            try {
                const logosRecord = await fetchAllTeamLogos();
                setTeamLogos(new Map(Object.entries(logosRecord)));
            } catch (e) {
                console.error('Failed to load logos:', e);
            }
        };
        loadLogos();
    }, []);

    const handleSyncLines = async () => {
        if (!firestore) {
            toast({
                title: 'Error',
                description: 'Firestore is not initialized.',
                variant: 'destructive',
            });
            return;
        }
        setIsSyncingLines(true);
        try {
            await syncGameLinesAndScores(firestore);
            await syncNBAPlayerStats(firestore, 3);
            toast({
                title: 'Sync Complete',
                description: 'Game lines, scores, and player stats have been updated.',
            });
        } catch (error: any) {
            console.error('Failed to sync game lines:', error);
            toast({
                title: 'Sync Failed',
                description: error.message || 'Could not sync game line data.',
                variant: 'destructive',
            });
        } finally {
            setIsSyncingLines(false);
        }
    };

    const [isUpdatingInjuries, setIsUpdatingInjuries] = useState(false);

    const handleUpdateInjuries = async () => {
        setIsUpdatingInjuries(true);
        try {
            const res = await fetch('/api/update-injuries', { method: 'POST' });
            const data = await res.json();

            if (data.success) {
                toast({
                    title: 'Injuries Updated',
                    description: data.message,
                });
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            console.error('Failed to update injuries:', error);
            toast({
                title: 'Update Failed',
                description: error.message || 'Could not update injury data.',
                variant: 'destructive',
            });
        } finally {
            setIsUpdatingInjuries(false);
        }
    };

    const userProfileRef = useMemoFirebase(
        () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
        [user, firestore]
    );
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    const favoriteTeams = useMemo(() => userProfile?.favoriteTeams || [], [userProfile]);

    const dailyGamesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'daily_games'), orderBy('commenceTime'));
    }, [firestore]);
    const { data: dailyGames, isLoading: isLoadingGames } = useCollection<DailyGame>(dailyGamesQuery);

    const rankingsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'rankings');
    }, [firestore]);
    const { data: rankings, isLoading: isLoadingRankings } = useCollection<TeamRanking>(rankingsQuery);

    const modelPredictionsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'model_predictions');
    }, [firestore]);
    const { data: rawModelPredictions } = useCollection<any>(modelPredictionsQuery);

    const pendingBetsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'users', user.uid, 'bets'), where('status', '==', 'pending'));
    }, [user, firestore]);
    const { data: pendingBets } = useCollection<UserBet>(pendingBetsQuery);

    const activeBetGameIds = useMemo(() => {
        if (!pendingBets) return new Set<string>();
        const gameIds = new Set<string>();
        pendingBets.forEach(bet => {
            if (bet.betType === 'parlay' && bet.legs) {
                bet.legs.forEach(leg => gameIds.add(leg.gameId));
            } else if (bet.gameId) {
                if (bet.gameId.includes(',')) {
                    bet.gameId.split(',').forEach(id => gameIds.add(id));
                } else {
                    gameIds.add(bet.gameId);
                }
            }
        });
        return gameIds;
    }, [pendingBets]);

    useEffect(() => {
        const getEspnData = async () => {
            const games = await fetchEspnSchedule();
            setEspnGames(games);
            setIsLoadingEspn(false);
        };

        getEspnData(); // Initial fetch

        // Poll for live score updates every 30 seconds
        const intervalId = setInterval(getEspnData, 30000);

        // Clean up interval on unmount
        return () => clearInterval(intervalId);
    }, []);

    const mergedGames = useMemo(() => {
        const rankingsMap = new Map(rankings?.map(r => [r.teamName, { rank: r.rank, conference: r.conference }]) || []);
        const oddsGames = transformDailyGamesToGames(dailyGames, rankingsMap, teamLogos);

        const predictionsMap = new Map<string, any>();
        if (rawModelPredictions) {
            rawModelPredictions.forEach((p: any) => {
                if (p.gameId) predictionsMap.set(p.gameId, p);
                const hName = normalizeTeamName(p.homeTeam || '');
                const aName = normalizeTeamName(p.awayTeam || '');
                if (hName && aName) {
                    predictionsMap.set(`${p.sport}-${hName}-${aName}`, p);
                }
            });
        }

        const finalGames = new Map<string, Game>();

        espnGames.forEach(espnGame => {
            const homeName = normalizeTeamName(espnGame.homeTeam.name);
            const awayName = normalizeTeamName(espnGame.awayTeam.name);
            // Include date in the key to prevent multi-day series from colliding
            const dateStr = new Date(espnGame.startTime).toLocaleDateString('en-CA');
            const key = `${espnGame.sport}-${homeName}-${awayName}-${dateStr}`;

            const homeRankingInfo = rankingsMap.get(espnGame.homeTeam.name);
            const awayRankingInfo = rankingsMap.get(espnGame.awayTeam.name);
            const pred = predictionsMap.get(espnGame.id) || predictionsMap.get(`${espnGame.sport}-${homeName}-${awayName}`);

            const enrichedEspnGame: Game = {
                ...espnGame,
                modelPrediction: pred ? {
                    recommendedSide: pred.recommendedSide,
                    projectedSpread: pred.projectedSpread,
                    betSignal: pred.betSignal,
                    zScore: pred.zScore
                } : undefined,
                homeTeam: {
                    ...espnGame.homeTeam,
                    rank: homeRankingInfo?.rank,
                    conference: homeRankingInfo?.conference || getConference(espnGame.homeTeam.name)
                },
                awayTeam: {
                    ...espnGame.awayTeam,
                    rank: awayRankingInfo?.rank,
                    conference: awayRankingInfo?.conference || getConference(espnGame.awayTeam.name)
                }
            };
            finalGames.set(key, enrichedEspnGame);
        });

        oddsGames.forEach(oddsGame => {
            const homeName = normalizeTeamName(oddsGame.homeTeam.name);
            const awayName = normalizeTeamName(oddsGame.awayTeam.name);
            const dateStr = new Date(oddsGame.startTime).toLocaleDateString('en-CA');
            const key = `${oddsGame.sport}-${homeName}-${awayName}-${dateStr}`;
            const existingGame = finalGames.get(key);
            const pred = predictionsMap.get(oddsGame.id) || predictionsMap.get(`${oddsGame.sport}-${homeName}-${awayName}`);

            if (existingGame) {
                finalGames.set(key, {
                    ...existingGame,
                    odds: oddsGame.odds,
                    allOdds: oddsGame.allOdds,
                    id: existingGame.id,
                    oddsApiId: oddsGame.id,
                    modelPrediction: existingGame.modelPrediction || (pred ? {
                        recommendedSide: pred.recommendedSide,
                        projectedSpread: pred.projectedSpread,
                        betSignal: pred.betSignal,
                        zScore: pred.zScore
                    } : undefined)
                });
            } else {
                // For NCAAM, ESPN is the authoritative source for game schedules.
                // Do NOT add odds-only NCAAM games that have no ESPN match — the Firestore
                // data can contain stale or incorrect bracket matchups.
                if (oddsGame.sport === 'NCAAM') return;

                finalGames.set(key, {
                    ...oddsGame,
                    id: oddsGame.id,
                    oddsApiId: oddsGame.id,
                    modelPrediction: pred ? {
                        recommendedSide: pred.recommendedSide,
                        projectedSpread: pred.projectedSpread,
                        betSignal: pred.betSignal,
                        zScore: pred.zScore
                    } : undefined
                });
            }
        });

        const allGames = Array.from(finalGames.values());

        // The ESPN source ID is a long numeric string (e.g. "401856600").
        // The odds-API source ID is a UUID with dashes.
        // Games that came from ESPN should ALWAYS be shown (they are real scheduled games).
        // Only apply the Power-4 filter to odds-only games that have no ESPN match,
        // because those can be stale regular-season entries with non-tournament teams.
        const espnGameIds = new Set(espnGames.map(g => g.id));

        const power4Filtered = allGames.filter(game => {
            if (game.sport === 'NCAAM') {
                // If this game came directly from ESPN, always include it
                // (covers postseason teams like UConn who aren't Power 4).
                if (espnGameIds.has(game.id)) return true;
                // Otherwise apply Power 4 filter to regular-season odds data.
                return power4TeamNames.has(game.homeTeam.name) || power4TeamNames.has(game.awayTeam.name);
            }
            return true;
        });

        if (isLoadingEspn && finalGames.size === 0) {
            return oddsGames.filter(game => {
                if (game.sport === 'NCAAM') {
                    return power4TeamNames.has(game.homeTeam.name) || power4TeamNames.has(game.awayTeam.name);
                }
                return true;
            });
        }

        return power4Filtered;

    }, [dailyGames, rankings, espnGames, isLoadingEspn, teamLogos]);

    const filteredAndSortedGames = useMemo(() => {
        const now = new Date();
        // Keep games for 12 hours after they start, unless they are marked as 'in' (live).
        const staleCutoff = now.getTime() - (12 * 60 * 60 * 1000);

        return mergedGames.filter(game => {
            if (selectedCategory === 'Favorites') {
                if (!favoriteTeams.includes(game.homeTeam.name) && !favoriteTeams.includes(game.awayTeam.name)) {
                    return false;
                }
            } else if (selectedCategory !== 'All') {
                if (selectedCategory === 'Soccer') {
                    if (!['EPL', 'MLS', 'UCL', 'Liga MX'].includes(game.sport)) {
                        return false;
                    }
                    if (selectedSoccerLeague !== 'All' && game.sport !== selectedSoccerLeague) {
                        return false;
                    }
                } else if (game.sport !== selectedCategory) {
                    return false;
                }
            }

            if (selectedCategory === 'NCAAM' && selectedConference !== 'All') {
                if (game.homeTeam.conference !== selectedConference && game.awayTeam.conference !== selectedConference) {
                    return false;
                }
            }

            const gameDate = new Date(game.startTime);
            const gameDateStr = gameDate.toLocaleDateString('en-CA');
            const selectedDay = dateOptions.find(o => o.offset === selectedDateOffset);

            // Filter by selected date
            if (selectedDay && gameDateStr !== selectedDay.fullDate) {
                return false;
            }

            // Always show live games.
            if (game.statusState === 'in') {
                return true;
            }

            // Hide games that started more than 12 hours ago only if we are looking at Today
            if (selectedDateOffset === 0 && gameDate.getTime() < staleCutoff) {
                return false;
            }

            return true;
        })
            .sort((a, b) => {
                const isGameToday = (gameDateStr: string) => {
                    const gameDate = new Date(gameDateStr);
                    return gameDate.toLocaleDateString('en-CA') === now.toLocaleDateString('en-CA');
                };

                const isFavA = favoriteTeams.includes(a.homeTeam.name) || favoriteTeams.includes(a.awayTeam.name);
                const isPriorityFavA = isFavA && isGameToday(a.startTime);

                const isFavB = favoriteTeams.includes(b.homeTeam.name) || favoriteTeams.includes(b.awayTeam.name);
                const isPriorityFavB = isFavB && isGameToday(b.startTime);

                if (isPriorityFavA !== isPriorityFavB) {
                    return isPriorityFavA ? -1 : 1;
                }

                const aHasBet = !!a.oddsApiId && activeBetGameIds.has(a.oddsApiId);
                const bHasBet = !!b.oddsApiId && activeBetGameIds.has(b.oddsApiId);

                if (aHasBet !== bHasBet) {
                    return aHasBet ? -1 : 1;
                }

                const statusOrder = {
                    'in': 1,
                    'pre': 2,
                    'post': 3,
                };

                const aStatus = a.statusState ?? 'pre';
                const bStatus = b.statusState ?? 'pre';

                const aOrder = statusOrder[aStatus as keyof typeof statusOrder] || 4;
                const bOrder = statusOrder[bStatus as keyof typeof statusOrder] || 4;

                if (aOrder !== bOrder) {
                    return aOrder - bOrder;
                }

                if (aStatus === 'post') {
                    return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
                }

                return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
            });
    }, [mergedGames, selectedCategory, selectedConference, selectedSoccerLeague, activeBetGameIds, favoriteTeams, selectedDateOffset, dateOptions]);

    const groupedGames = useMemo(() => {
        const groups: Record<string, Game[]> = {};
        filteredAndSortedGames.forEach(game => {
            const sport = game.sport;
            if (!groups[sport]) groups[sport] = [];
            groups[sport].push(game);
        });
        // Sort sports alphabetically but maybe keep some priority? 
        // For now, let's just use the keys.
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }, [filteredAndSortedGames]);

    // Effect to keep the selected game in sync with the master list
    useEffect(() => {
        if (selectedGame) {
            const refreshedGame = filteredAndSortedGames.find(g => g.id === selectedGame.id);
            // Update the state only if the refreshed game data is different
            if (refreshedGame && JSON.stringify(refreshedGame) !== JSON.stringify(selectedGame)) {
                setSelectedGame(refreshedGame);
            }
        }
    }, [filteredAndSortedGames, selectedGame]);


    const showLoadingSpinner = isUserLoading || (isLoadingGames && !dailyGames);
    const isLoading = isLoadingGames || isLoadingEspn;

    if (isUserLoading || !user) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 text-center h-64">
                <Loader className="h-12 w-12 animate-spin text-brand-500" />
                <h2 className="text-xl font-semibold text-foreground">
                    Redirecting to login...
                </h2>
                <p className="text-muted-foreground">
                    Please log in to view the dashboard.
                </p>
            </div>
        );
    }

    return (
        <>
            {showLoadingSpinner ? (
                <div className="flex flex-col items-center justify-center gap-4 text-center h-64">
                    <Loader className="h-12 w-12 animate-spin text-brand-500" />
                    <h2 className="text-xl font-semibold text-foreground">
                        Loading Daily Lines...
                    </h2>
                    <p className="text-muted-foreground">
                        Getting the latest game information.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-4 w-full">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/50 p-3 rounded-xl border border-slate-800 backdrop-blur-sm">
                        <div className="flex gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
                            {['All', 'Favorites', 'NBA', 'NCAAM', 'MLB', 'NHL', 'NFL', 'Soccer'].map(sport => (
                                <button
                                    key={sport}
                                    onClick={() => setSelectedCategory(sport)}
                                    className={`
                            px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                            ${selectedCategory === sport
                                            ? 'bg-white text-slate-950 shadow-lg'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}
                        `}
                                >
                                    {sport}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">

                            <button
                                onClick={handleSyncLines}
                                disabled={isSyncingLines}
                                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-brand-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <RefreshCw className={`w-4 h-4 ${isSyncingLines ? 'animate-spin' : ''}`} />
                                {isSyncingLines ? 'Syncing...' : 'Sync Game Lines'}
                            </button>
                        </div>
                    </div>

                    {/* Date Navigation Strip */}
                    <div className="flex justify-center w-full">
                        <div className="flex gap-2 p-1 bg-slate-900/80 rounded-2xl border border-slate-800 backdrop-blur-md shadow-inner">
                            {dateOptions.map((opt) => (
                                <button
                                    key={opt.offset}
                                    onClick={() => setSelectedDateOffset(opt.offset)}
                                    className={`
                                        flex flex-col items-center min-w-[100px] px-6 py-3 rounded-xl transition-all duration-300
                                        ${selectedDateOffset === opt.offset
                                            ? 'bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-lg shadow-brand-500/30 scale-105'
                                            : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}
                                    `}
                                >
                                    <span className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-1 ${selectedDateOffset === opt.offset ? 'text-brand-100' : 'text-slate-500'}`}>
                                        {opt.label}
                                    </span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-xl font-black">{opt.dateNum}</span>
                                        <span className="text-xs font-medium opacity-60 uppercase">{opt.dayName}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {selectedCategory === 'NCAAM' && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
                            {['All', 'ACC', 'Big 10', 'Big 12', 'SEC'].map(conf => (
                                <button
                                    key={conf}
                                    onClick={() => setSelectedConference(conf)}
                                    className={`
                      px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                      ${selectedConference === conf
                                            ? 'bg-amber-400 text-slate-950 shadow-lg'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}
                    `}
                                >
                                    {conf}
                                </button>
                            ))}
                        </div>
                    )}
                    
                    {selectedCategory === 'Soccer' && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
                            {['All', 'EPL', 'MLS', 'UCL', 'Liga MX'].map(league => (
                                <button
                                    key={league}
                                    onClick={() => setSelectedSoccerLeague(league)}
                                    className={`
                      px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                      ${selectedSoccerLeague === league
                                            ? 'bg-emerald-400 text-slate-950 shadow-lg'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}
                    `}
                                >
                                    {league}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-col gap-8">
                        {isLoading && filteredAndSortedGames.length === 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6">
                                {Array.from({ length: 9 }).map((_, i) => (
                                    <Skeleton key={i} className="h-64 w-full rounded-2xl bg-slate-900/40" />
                                ))}
                            </div>
                        ) : filteredAndSortedGames.length > 0 ? (
                            groupedGames.map(([sport, games]) => (
                                <div key={sport} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center gap-4">
                                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-500 whitespace-nowrap">
                                            {sport}
                                        </h3>
                                        <div className="h-px w-full bg-gradient-to-r from-slate-800 to-transparent" />
                                    </div>

                                    {/* Live / Final Games - Denser Grid */}
                                    {games.filter(g => g.statusState === 'in' || g.statusState === 'post').length > 0 && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                                            {games
                                                .filter(g => g.statusState === 'in' || g.statusState === 'post')
                                                .map((game) => (
                                                    <GameCard
                                                        key={`${game.id}-${game.homeTeam.name}`}
                                                        game={game}
                                                        onGameClick={setSelectedGame}
                                                        hasActiveBet={!!game.oddsApiId && activeBetGameIds.has(game.oddsApiId)}
                                                    />
                                                ))}
                                        </div>
                                    )}

                                    {/* Upcoming Games - Original Wide Grid for Odds */}
                                    {games.filter(g => g.statusState !== 'in' && g.statusState !== 'post').length > 0 && (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-6">
                                            {games
                                                .filter(g => g.statusState !== 'in' && g.statusState !== 'post')
                                                .map((game) => (
                                                    <GameCard
                                                        key={`${game.id}-${game.homeTeam.name}`}
                                                        game={game}
                                                        onGameClick={setSelectedGame}
                                                        hasActiveBet={!!game.oddsApiId && activeBetGameIds.has(game.oddsApiId)}
                                                    />
                                                ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
                                <Activity className="h-12 w-12 text-slate-700" />
                                <div className="space-y-1">
                                    <h3 className="text-lg font-bold text-slate-400">No scheduled games found</h3>
                                    <p className="text-sm text-slate-600 max-w-[280px]">
                                        Try selecting a different date or sport category.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <GameDetailModal game={selectedGame} isOpen={!!selectedGame} onClose={() => setSelectedGame(null)} />
        </>
    );
}