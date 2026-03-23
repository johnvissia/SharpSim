'use client';

import { useState, useEffect, useMemo } from 'react';
import { GameCard } from '@/components/dashboard/game-card';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, orderBy, query, where, writeBatch, increment } from 'firebase/firestore';
import { syncGameLinesAndScores, syncNBAPlayerStats } from '@/lib/api';
import { fetchEspnSchedule } from '@/lib/espn';
import type { Game, Sport, SystemStatus, DailyGame, TeamRanking, Team, SportsbookOdds, UserBet, ParlayLeg, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader, RefreshCw, Users, Activity } from 'lucide-react';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { BetSlip } from '@/components/dashboard/BetSlip';
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
            game.odds = allOdds[0].odds;
        }

        return game;
    }).filter((g): g is Game => g !== null);
};


export default function DashboardPage() {
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedConference, setSelectedConference] = useState('All');
    const [selectedGame, setSelectedGame] = useState<Game | null>(null);
    const [espnGames, setEspnGames] = useState<Game[]>([]);
    const [isLoadingEspn, setIsLoadingEspn] = useState(true);
    const [isSyncingLines, setIsSyncingLines] = useState(false);
    const [teamLogos, setTeamLogos] = useState<Map<string, string>>(new Map());

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
        const fetchTeamLogos = async () => {
            const sports = ['basketball/nba', 'football/nfl', 'hockey/nhl', 'football/college-football', 'basketball/mens-college-basketball'];
            const newLogoMap = new Map<string, string>();
            const promises = sports.map(async (sport) => {
                try {
                    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/teams?limit=1000`);
                    if (!res.ok) return;
                    const data = await res.json();
                    const teams = data?.sports?.[0]?.leagues?.[0]?.teams;
                    teams?.forEach((t: any) => {
                        const teamData = t.team;
                        if (teamData.displayName && teamData.logos && teamData.logos.length > 0) {
                            newLogoMap.set(teamData.displayName, teamData.logos[0].href);
                        }
                    });
                } catch (e) {
                    console.error(`Failed to fetch teams for ${sport}`, e);
                }
            });
            await Promise.all(promises);
            setTeamLogos(newLogoMap);
        };
        fetchTeamLogos();
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

        const finalGames = new Map<string, Game>();

        espnGames.forEach(espnGame => {
            const homeName = normalizeTeamName(espnGame.homeTeam.name);
            const awayName = normalizeTeamName(espnGame.awayTeam.name);
            const key = `${espnGame.sport}-${homeName}-${awayName}`;

            const homeRankingInfo = rankingsMap.get(espnGame.homeTeam.name);
            const awayRankingInfo = rankingsMap.get(espnGame.awayTeam.name);
            const enrichedEspnGame = {
                ...espnGame,
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
            const key = `${oddsGame.sport}-${homeName}-${awayName}`;
            const existingGame = finalGames.get(key);

            if (existingGame) {
                finalGames.set(key, {
                    ...existingGame,
                    odds: oddsGame.odds,
                    allOdds: oddsGame.allOdds,
                    id: existingGame.id,
                    oddsApiId: oddsGame.id,
                });
            } else {
                // If specific logic is needed for odds-only games, typically keep them but maybe ESPN name is better?
                // Usually we prefer matching.
                finalGames.set(key, { ...oddsGame, id: oddsGame.id, oddsApiId: oddsGame.id });
            }
        });

        const allGames = Array.from(finalGames.values());

        const power4Filtered = allGames.filter(game => {
            if (game.sport === 'NCAAM') {
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
        // Keep games for 4 hours after they start, unless they are marked as 'in' (live).
        const staleCutoff = now.getTime() - (4 * 60 * 60 * 1000);

        return mergedGames.filter(game => {
            if (selectedCategory === 'Favorites') {
                if (!favoriteTeams.includes(game.homeTeam.name) && !favoriteTeams.includes(game.awayTeam.name)) {
                    return false;
                }
            } else if (selectedCategory !== 'All') {
                if (game.sport !== selectedCategory) {
                    return false;
                }
            }

            if (selectedCategory === 'NCAAM' && selectedConference !== 'All') {
                if (game.homeTeam.conference !== selectedConference && game.awayTeam.conference !== selectedConference) {
                    return false;
                }
            }

            const gameTime = new Date(game.startTime).getTime();

            // Always show live games.
            if (game.statusState === 'in') {
                return true;
            }

            // Hide games that started more than 4 hours ago and are not live.
            if (gameTime < staleCutoff) {
                return false;
            }

            return true;
        })
            .sort((a, b) => {
                const isGameToday = (gameDateStr: string) => {
                    const gameDate = new Date(gameDateStr);
                    return gameDate.getDate() === now.getDate() &&
                        gameDate.getMonth() === now.getMonth() &&
                        gameDate.getFullYear() === now.getFullYear();
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
    }, [mergedGames, selectedCategory, selectedConference, activeBetGameIds, favoriteTeams]);

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
                <Loader className="h-12 w-12 animate-spin text-primary" />
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
                    <Loader className="h-12 w-12 animate-spin text-primary" />
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
                            {['All', 'Favorites', 'NBA', 'NCAAM', 'NHL', 'NFL'].map(sport => (
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
                                onClick={handleUpdateInjuries}
                                disabled={isUpdatingInjuries}
                                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-rose-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Activity className={`w-4 h-4 ${isUpdatingInjuries ? 'animate-pulse' : ''}`} />
                                {isUpdatingInjuries ? 'Updating...' : 'Update Injuries'}
                            </button>
                            <button
                                onClick={handleSyncLines}
                                disabled={isSyncingLines}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <RefreshCw className={`w-4 h-4 ${isSyncingLines ? 'animate-spin' : ''}`} />
                                {isSyncingLines ? 'Syncing...' : 'Sync Game Lines'}
                            </button>
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

                    <div className="flex flex-col gap-3">
                        {isLoading && filteredAndSortedGames.length === 0 ? (
                            <div className="grid grid-cols-1 gap-4">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <Skeleton key={i} className="h-32 w-full" />
                                ))}
                            </div>
                        ) : filteredAndSortedGames.length > 0 ? (
                            filteredAndSortedGames.map((game) => (
                                <GameCard
                                    key={`${game.id}-${game.homeTeam.name}`}
                                    game={game}
                                    onGameClick={setSelectedGame}
                                    hasActiveBet={!!game.oddsApiId && activeBetGameIds.has(game.oddsApiId)}
                                />
                            ))
                        ) : (
                            <p className="text-muted-foreground text-center py-8">
                                No games match your filter.
                            </p>
                        )}
                    </div>
                </div>
            )}
            <BetSlip />
            <GameDetailModal game={selectedGame} isOpen={!!selectedGame} onClose={() => setSelectedGame(null)} />
        </>
    );
}