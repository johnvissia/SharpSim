'use client';

import { useEffect, useState } from 'react';
import type { Game } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Activity, Users, MapPin, Tv, ShieldAlert, CheckCircle2, TrendingUp, User } from 'lucide-react';
import Image from 'next/image';

interface LiveGameHubProps {
    game: Game;
}

interface LeaderAthlete {
    category: string;
    displayName: string;
    player: string;
    headshot?: string;
    jersey?: string;
    position?: string;
    stat: string;
}

interface TeamBoxStats {
    teamName: string;
    stats: Record<string, string>;
}

interface LineScoreItem {
    period: string;
    away: string;
    home: string;
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
        case 'WNBA': return 'basketball/wnba';
        default: return 'basketball/nba';
    }
}

export function LiveGameHub({ game }: LiveGameHubProps) {
    const [loading, setLoading] = useState(true);
    const [awayLeaders, setAwayLeaders] = useState<LeaderAthlete[]>([]);
    const [homeLeaders, setHomeLeaders] = useState<LeaderAthlete[]>([]);
    const [lineScores, setLineScores] = useState<LineScoreItem[]>([]);
    const [awayTotal, setAwayTotal] = useState<string>('');
    const [homeTotal, setHomeTotal] = useState<string>('');
    const [awayBoxStats, setAwayBoxStats] = useState<Record<string, string>>({});
    const [homeBoxStats, setHomeBoxStats] = useState<Record<string, string>>({});
    const [venueInfo, setVenueInfo] = useState<string>('');
    const [broadcastInfo, setBroadcastInfo] = useState<string>('');

    useEffect(() => {
        let isMounted = true;
        async function fetchLiveGameDetails() {
            try {
                setLoading(true);
                const sportPath = getEspnSportPath(game.sport);
                // game.id is the ESPN event ID
                const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sportPath}/summary?event=${encodeURIComponent(game.id)}`);
                if (!res.ok) {
                    setLoading(false);
                    return;
                }
                const data = await res.json();
                if (!isMounted) return;

                // 1. Line scores
                const competitors = data.header?.competitions?.[0]?.competitors || [];
                const awayComp = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];
                const homeComp = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];

                if (awayComp && homeComp) {
                    setAwayTotal(awayComp.score || String(game.liveScore?.away || ''));
                    setHomeTotal(homeComp.score || String(game.liveScore?.home || ''));

                    const awayPeriods = awayComp.linescores || [];
                    const homePeriods = homeComp.linescores || [];
                    const maxP = Math.max(awayPeriods.length, homePeriods.length);
                    const periods: LineScoreItem[] = [];

                    for (let i = 0; i < maxP; i++) {
                        let pLabel = `Q${i + 1}`;
                        if (game.sport === 'NHL') pLabel = `P${i + 1}`;
                        if (game.sport === 'MLB') pLabel = `${i + 1}`;
                        if (game.sport === 'EPL' || game.sport === 'UCL' || game.sport === 'MLS') pLabel = i === 0 ? '1st' : '2nd';
                        if (i >= 4 && (game.sport === 'NBA' || game.sport === 'NCAAM')) pLabel = `OT${i - 3}`;

                        periods.push({
                            period: pLabel,
                            away: awayPeriods[i]?.displayValue || '-',
                            home: homePeriods[i]?.displayValue || '-',
                        });
                    }
                    setLineScores(periods);
                }

                // 2. Leaders with headshots
                const leadersArray = data.leaders || [];
                const parseLeaders = (teamLeadersObj: any): LeaderAthlete[] => {
                    if (!teamLeadersObj?.leaders) return [];
                    const result: LeaderAthlete[] = [];
                    for (const cat of teamLeadersObj.leaders) {
                        const topAthlete = cat.leaders?.[0];
                        if (topAthlete) {
                            result.push({
                                category: cat.name || cat.displayName || 'Leader',
                                displayName: cat.displayName || cat.name || 'Leader',
                                player: topAthlete.athlete?.displayName || topAthlete.athlete?.shortName || 'Player',
                                headshot: topAthlete.athlete?.headshot?.href,
                                jersey: topAthlete.athlete?.jersey,
                                position: topAthlete.athlete?.position?.abbreviation,
                                stat: topAthlete.displayValue || '',
                            });
                        }
                    }
                    return result;
                };

                if (leadersArray.length >= 2) {
                    // Match to away/home by team id or display name
                    const awayTeamId = String(game.awayTeam.id);
                    const homeTeamId = String(game.homeTeam.id);

                    const awayObj = leadersArray.find((l: any) => String(l.team?.id) === awayTeamId) || leadersArray[0];
                    const homeObj = leadersArray.find((l: any) => String(l.team?.id) === homeTeamId) || leadersArray[1];

                    setAwayLeaders(parseLeaders(awayObj));
                    setHomeLeaders(parseLeaders(homeObj));
                }

                // 3. Team Statistics (Boxscore)
                const boxTeams = data.boxscore?.teams || [];
                if (boxTeams.length >= 2) {
                    const parseStats = (statsArr: any[]) => {
                        const map: Record<string, string> = {};
                        (statsArr || []).forEach((s: any) => {
                            const label = s.label || s.name;
                            if (label) map[label] = s.displayValue;
                        });
                        return map;
                    };
                    setAwayBoxStats(parseStats(boxTeams[0]?.statistics));
                    setHomeBoxStats(parseStats(boxTeams[1]?.statistics));
                }

                // 4. Venue & Broadcast
                const venue = data.gameInfo?.venue?.fullName;
                const city = data.gameInfo?.venue?.address?.city;
                const state = data.gameInfo?.venue?.address?.state;
                if (venue) {
                    setVenueInfo([venue, city, state].filter(Boolean).join(', '));
                }
                const bcast = (data.broadcasts?.[0]?.names || []).join(', ');
                if (bcast) setBroadcastInfo(bcast);

            } catch (err) {
                console.warn('LiveGameHub: Failed to load ESPN live details:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchLiveGameDetails();
        return () => { isMounted = false; };
    }, [game.id, game.sport]);

    // Model Pick Snapshot Details
    const hasModelPrediction = !!game.modelPrediction;
    const modelPick = game.modelPrediction?.recommendedSide;
    const betSignal = game.modelPrediction?.betSignal || 'MODEL PICK';
    const projSpread = game.modelPrediction?.projectedSpread;
    const vegasSpread = game.odds?.spread?.points;

    // Live margin calculations
    const awayScoreNum = parseInt(awayTotal || String(game.liveScore?.away || '0'), 10);
    const homeScoreNum = parseInt(homeTotal || String(game.liveScore?.home || '0'), 10);
    const scoreDiff = Math.abs(homeScoreNum - awayScoreNum);
    const leadingTeamName = homeScoreNum > awayScoreNum
        ? game.homeTeam.name
        : awayScoreNum > homeScoreNum
            ? game.awayTeam.name
            : 'Tied';

    // Pick covering status
    let coverStatusText = '';
    if (modelPick && vegasSpread !== undefined) {
        const isPickHome = modelPick.toLowerCase().includes(game.homeTeam.name.toLowerCase()) ||
            game.homeTeam.name.toLowerCase().includes(modelPick.toLowerCase());
        const margin = isPickHome ? (homeScoreNum - awayScoreNum) : (awayScoreNum - homeScoreNum);
        const spreadTarget = isPickHome ? vegasSpread : -vegasSpread;
        if (margin > spreadTarget) {
            coverStatusText = 'Currently Covering';
        } else if (margin === spreadTarget) {
            coverStatusText = 'Push';
        } else {
            coverStatusText = 'Not Covering';
        }
    }

    // Determine relevant stats by sport
    const getStatRows = () => {
        if (game.sport === 'NBA' || game.sport === 'NCAAM') {
            return [
                { label: 'Field Goal %', away: awayBoxStats['Field Goal %'] || awayBoxStats['FG%'] || awayBoxStats['FG'] || '-', home: homeBoxStats['Field Goal %'] || homeBoxStats['FG%'] || homeBoxStats['FG'] || '-' },
                { label: '3-Point %', away: awayBoxStats['Three Point %'] || awayBoxStats['3P%'] || awayBoxStats['3PT'] || '-', home: homeBoxStats['Three Point %'] || homeBoxStats['3P%'] || homeBoxStats['3PT'] || '-' },
                { label: 'Free Throw %', away: awayBoxStats['Free Throw %'] || awayBoxStats['FT%'] || awayBoxStats['FT'] || '-', home: homeBoxStats['Free Throw %'] || homeBoxStats['FT%'] || homeBoxStats['FT'] || '-' },
                { label: 'Total Rebounds', away: awayBoxStats['Rebounds'] || awayBoxStats['Total Rebounds'] || '-', home: homeBoxStats['Rebounds'] || homeBoxStats['Total Rebounds'] || '-' },
                { label: 'Assists', away: awayBoxStats['Assists'] || '-', home: homeBoxStats['Assists'] || '-' },
                { label: 'Turnovers', away: awayBoxStats['Turnovers'] || awayBoxStats['Total Turnovers'] || '-', home: homeBoxStats['Turnovers'] || homeBoxStats['Total Turnovers'] || '-' },
                { label: 'Fast Break Points', away: awayBoxStats['Fast Break Points'] || '-', home: homeBoxStats['Fast Break Points'] || '-' },
                { label: 'Points in Paint', away: awayBoxStats['Points in Paint'] || '-', home: homeBoxStats['Points in Paint'] || '-' },
            ].filter(r => r.away !== '-' || r.home !== '-');
        }

        if (game.sport === 'NFL') {
            return [
                { label: 'Total Yards', away: awayBoxStats['Total Yards'] || '-', home: homeBoxStats['Total Yards'] || '-' },
                { label: 'Passing Yards', away: awayBoxStats['Passing Yards'] || '-', home: homeBoxStats['Passing Yards'] || '-' },
                { label: 'Rushing Yards', away: awayBoxStats['Rushing Yards'] || '-', home: homeBoxStats['Rushing Yards'] || '-' },
                { label: 'First Downs', away: awayBoxStats['First Downs'] || '-', home: homeBoxStats['First Downs'] || '-' },
                { label: '3rd Down Efficiency', away: awayBoxStats['3rd Down Efficiency'] || awayBoxStats['Third Down Efficiency'] || '-', home: homeBoxStats['3rd Down Efficiency'] || homeBoxStats['Third Down Efficiency'] || '-' },
                { label: 'Turnovers', away: awayBoxStats['Turnovers'] || '-', home: homeBoxStats['Turnovers'] || '-' },
                { label: 'Possession Time', away: awayBoxStats['Possession'] || awayBoxStats['Time of Possession'] || '-', home: homeBoxStats['Possession'] || homeBoxStats['Time of Possession'] || '-' },
            ].filter(r => r.away !== '-' || r.home !== '-');
        }

        if (game.sport === 'NHL') {
            return [
                { label: 'Shots on Goal', away: awayBoxStats['Shots'] || awayBoxStats['Shots on Goal'] || '-', home: homeBoxStats['Shots'] || homeBoxStats['Shots on Goal'] || '-' },
                { label: 'Faceoff Win %', away: awayBoxStats['Faceoff %'] || awayBoxStats['Faceoff Win %'] || '-', home: homeBoxStats['Faceoff %'] || homeBoxStats['Faceoff Win %'] || '-' },
                { label: 'Power Plays', away: awayBoxStats['Power Plays'] || awayBoxStats['Power Play Goals'] || '-', home: homeBoxStats['Power Plays'] || homeBoxStats['Power Play Goals'] || '-' },
                { label: 'Hits', away: awayBoxStats['Hits'] || '-', home: homeBoxStats['Hits'] || '-' },
                { label: 'Blocked Shots', away: awayBoxStats['Blocks'] || awayBoxStats['Blocked Shots'] || '-', home: homeBoxStats['Blocks'] || homeBoxStats['Blocked Shots'] || '-' },
            ].filter(r => r.away !== '-' || r.home !== '-');
        }

        // Soccer (EPL / UCL / MLS)
        return [
            { label: 'Possession', away: awayBoxStats['Possession'] || awayBoxStats['Possession %'] || '-', home: homeBoxStats['Possession'] || homeBoxStats['Possession %'] || '-' },
            { label: 'Total Shots', away: awayBoxStats['Shots'] || awayBoxStats['Total Shots'] || '-', home: homeBoxStats['Shots'] || homeBoxStats['Total Shots'] || '-' },
            { label: 'Shots on Target', away: awayBoxStats['Shots on Target'] || awayBoxStats['On Target'] || '-', home: homeBoxStats['Shots on Target'] || homeBoxStats['On Target'] || '-' },
            { label: 'Corner Kicks', away: awayBoxStats['Corners'] || awayBoxStats['Corner Kicks'] || '-', home: homeBoxStats['Corners'] || homeBoxStats['Corner Kicks'] || '-' },
            { label: 'Fouls', away: awayBoxStats['Fouls'] || '-', home: homeBoxStats['Fouls'] || '-' },
            { label: 'Yellow Cards', away: awayBoxStats['Yellow Cards'] || '-', home: homeBoxStats['Yellow Cards'] || '-' },
        ].filter(r => r.away !== '-' || r.home !== '-');
    };

    const statRows = getStatRows();

    return (
        <div className="space-y-6">
            {/* 1. LINESCORE BOARD */}
            {lineScores.length > 0 && (
                <Card className="bg-slate-900/90 border-slate-800 backdrop-blur-sm overflow-hidden">
                    <CardHeader className="py-3 px-4 bg-slate-800/40 border-b border-slate-800/60 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-emerald-400" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                                Line Score
                            </span>
                        </div>
                        <Badge variant="outline" className="text-[11px] text-slate-400 border-slate-700">
                            {game.statusDetail || 'In Progress'}
                        </Badge>
                    </CardHeader>
                    <div className="p-4 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-slate-400 text-xs border-b border-slate-800">
                                    <th className="text-left pb-2 font-medium">Team</th>
                                    {lineScores.map(ls => (
                                        <th key={ls.period} className="text-center pb-2 px-3 font-medium">
                                            {ls.period}
                                        </th>
                                    ))}
                                    <th className="text-right pb-2 pr-1 font-bold text-white">T</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {/* Away Team Row */}
                                <tr>
                                    <td className="py-2.5 flex items-center gap-2 font-medium text-slate-200">
                                        {game.awayTeam.logo && (
                                            <img
                                                src={game.awayTeam.logo}
                                                alt={game.awayTeam.name}
                                                className="w-5 h-5 object-contain"
                                            />
                                        )}
                                        <span className="truncate max-w-[140px]">{game.awayTeam.name}</span>
                                    </td>
                                    {lineScores.map((ls, idx) => (
                                        <td key={idx} className="text-center py-2.5 px-3 text-slate-300 font-mono">
                                            {ls.away}
                                        </td>
                                    ))}
                                    <td className="text-right py-2.5 pr-1 font-bold text-white font-mono text-base">
                                        {awayTotal || game.liveScore?.away || 0}
                                    </td>
                                </tr>

                                {/* Home Team Row */}
                                <tr>
                                    <td className="py-2.5 flex items-center gap-2 font-medium text-slate-200">
                                        {game.homeTeam.logo && (
                                            <img
                                                src={game.homeTeam.logo}
                                                alt={game.homeTeam.name}
                                                className="w-5 h-5 object-contain"
                                            />
                                        )}
                                        <span className="truncate max-w-[140px]">{game.homeTeam.name}</span>
                                    </td>
                                    {lineScores.map((ls, idx) => (
                                        <td key={idx} className="text-center py-2.5 px-3 text-slate-300 font-mono">
                                            {ls.home}
                                        </td>
                                    ))}
                                    <td className="text-right py-2.5 pr-1 font-bold text-white font-mono text-base">
                                        {homeTotal || game.liveScore?.home || 0}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* 2. PRE-GAME MODEL PICK & CLOSING LINE INSIGHT (INSTANT RECAP) */}
            <Card className="bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 border-indigo-900/40">
                <CardHeader className="py-3 px-4 bg-indigo-950/30 border-b border-indigo-900/30 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-amber-400" />
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                            Model Pre-Game Pick & Value Analysis
                        </CardTitle>
                    </div>
                    {hasModelPrediction && (
                        <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs">
                            {betSignal}
                        </Badge>
                    )}
                </CardHeader>
                <CardContent className="p-4">
                    {hasModelPrediction ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                                <p className="text-xs text-slate-400">Pre-Game Recommendation</p>
                                <p className="text-base font-bold text-emerald-400 mt-1">
                                    {modelPick || 'Lean Home'}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Projected Spread: {projSpread !== undefined ? (projSpread > 0 ? `+${projSpread}` : projSpread) : 'N/A'}
                                </p>
                            </div>

                            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                                <p className="text-xs text-slate-400">Closing Vegas Line</p>
                                <p className="text-base font-bold text-slate-200 mt-1">
                                    Spread: {vegasSpread !== undefined ? (vegasSpread > 0 ? `+${vegasSpread}` : vegasSpread) : 'Pick'}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Total: {game.odds?.total?.points || 'N/A'} O/U
                                </p>
                            </div>

                            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                                <p className="text-xs text-slate-400">Current Margin</p>
                                <p className="text-base font-bold text-white mt-1">
                                    {leadingTeamName === 'Tied' ? 'Tied' : `${leadingTeamName} by ${scoreDiff}`}
                                </p>
                                {coverStatusText && (
                                    <p className={`text-[11px] font-semibold mt-0.5 ${coverStatusText.includes('Covering') ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {coverStatusText}
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-lg border border-slate-800">
                            <div>
                                <p className="text-xs text-slate-400">Closing Vegas Line</p>
                                <p className="text-sm font-semibold text-slate-200 mt-0.5">
                                    Spread: {vegasSpread !== undefined ? (vegasSpread > 0 ? `+${vegasSpread}` : vegasSpread) : 'Pick'} • Total: {game.odds?.total?.points || 'N/A'}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-400">Current Margin</p>
                                <p className="text-sm font-bold text-white mt-0.5">
                                    {leadingTeamName === 'Tied' ? 'Tied' : `${leadingTeamName} by ${scoreDiff}`}
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 3. GAME LEADERS WITH REAL PLAYER HEADSHOTS */}
            {(awayLeaders.length > 0 || homeLeaders.length > 0) && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <Users className="h-4 w-4 text-sky-400" />
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                            Game Leaders
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Away Leaders */}
                        <Card className="bg-slate-900 border-slate-800 overflow-hidden">
                            <CardHeader className="py-2.5 px-4 bg-slate-800/40 border-b border-slate-800/60 flex flex-row items-center gap-2">
                                {game.awayTeam.logo && (
                                    <img src={game.awayTeam.logo} alt="" className="w-5 h-5 object-contain" />
                                )}
                                <span className="font-bold text-sm text-slate-200 truncate">{game.awayTeam.name}</span>
                            </CardHeader>
                            <CardContent className="p-3 space-y-2.5">
                                {awayLeaders.map((ldr, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/70">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {ldr.headshot ? (
                                                <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden flex-shrink-0 border border-slate-700">
                                                    <img
                                                        src={ldr.headshot}
                                                        alt={ldr.player}
                                                        className="w-full h-full object-cover object-top"
                                                        onError={(e) => {
                                                            // Fallback to placeholder if image fails
                                                            (e.target as HTMLElement).style.display = 'none';
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-400 font-bold text-xs border border-slate-700">
                                                    {ldr.jersey ? `#${ldr.jersey}` : <User className="w-5 h-5" />}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-xs text-slate-400 font-medium">{ldr.displayName}</p>
                                                <p className="text-sm font-bold text-white truncate">{ldr.player}</p>
                                                {ldr.position && (
                                                    <p className="text-[10px] text-slate-500">
                                                        {ldr.position} {ldr.jersey ? `• #${ldr.jersey}` : ''}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-sm font-mono font-bold px-2.5 py-1">
                                            {ldr.stat}
                                        </Badge>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Home Leaders */}
                        <Card className="bg-slate-900 border-slate-800 overflow-hidden">
                            <CardHeader className="py-2.5 px-4 bg-slate-800/40 border-b border-slate-800/60 flex flex-row items-center gap-2">
                                {game.homeTeam.logo && (
                                    <img src={game.homeTeam.logo} alt="" className="w-5 h-5 object-contain" />
                                )}
                                <span className="font-bold text-sm text-slate-200 truncate">{game.homeTeam.name}</span>
                            </CardHeader>
                            <CardContent className="p-3 space-y-2.5">
                                {homeLeaders.map((ldr, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/70">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {ldr.headshot ? (
                                                <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden flex-shrink-0 border border-slate-700">
                                                    <img
                                                        src={ldr.headshot}
                                                        alt={ldr.player}
                                                        className="w-full h-full object-cover object-top"
                                                        onError={(e) => {
                                                            (e.target as HTMLElement).style.display = 'none';
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-400 font-bold text-xs border border-slate-700">
                                                    {ldr.jersey ? `#${ldr.jersey}` : <User className="w-5 h-5" />}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-xs text-slate-400 font-medium">{ldr.displayName}</p>
                                                <p className="text-sm font-bold text-white truncate">{ldr.player}</p>
                                                {ldr.position && (
                                                    <p className="text-[10px] text-slate-500">
                                                        {ldr.position} {ldr.jersey ? `• #${ldr.jersey}` : ''}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-sm font-mono font-bold px-2.5 py-1">
                                            {ldr.stat}
                                        </Badge>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* 4. TEAM MATCHUP STATS COMPARISON */}
            {statRows.length > 0 && (
                <Card className="bg-slate-900 border-slate-800 overflow-hidden">
                    <CardHeader className="py-3 px-4 bg-slate-800/40 border-b border-slate-800/60 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-emerald-400" />
                            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                                Team Matchup Stats
                            </CardTitle>
                        </div>
                        <div className="flex items-center gap-6 text-xs font-bold">
                            <span className="text-slate-300">{game.awayTeam.name.split(' ').pop()}</span>
                            <span className="text-slate-500">vs</span>
                            <span className="text-slate-300">{game.homeTeam.name.split(' ').pop()}</span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                        {statRows.map((stat, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/50 last:border-0">
                                <span className="font-mono font-bold text-slate-200 text-sm w-16 text-left">
                                    {stat.away}
                                </span>
                                <span className="text-slate-400 text-center font-medium flex-1">
                                    {stat.label}
                                </span>
                                <span className="font-mono font-bold text-slate-200 text-sm w-16 text-right">
                                    {stat.home}
                                </span>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* 5. VENUE & BROADCAST FOOTER */}
            {(venueInfo || broadcastInfo) && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs text-slate-400 bg-slate-950/50 rounded-lg border border-slate-800/60">
                    {venueInfo && (
                        <div className="flex items-center gap-1.5 truncate">
                            <MapPin className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                            <span className="truncate">{venueInfo}</span>
                        </div>
                    )}
                    {broadcastInfo && (
                        <div className="flex items-center gap-1.5">
                            <Tv className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                            <span>{broadcastInfo}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
