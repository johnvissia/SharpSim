import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { normalizeTeamName } from '@/lib/team-names';
import { fetchEspnSchedule } from '@/lib/espn';

export async function GET() {
    try {
        const snapshot = await db.collection('daily_games').where('sportKey', '==', 'baseball_mlb').get();
        const dailyGames = snapshot.docs.map(doc => doc.data());

        const espnGames = await fetchEspnSchedule();
        const mlbEspnGames = espnGames.filter(g => g.sport === 'MLB');

        const finalGames = new Map<string, any>();

        mlbEspnGames.forEach(espnGame => {
            const homeName = normalizeTeamName(espnGame.homeTeam.name);
            const awayName = normalizeTeamName(espnGame.awayTeam.name);
            const key = `${espnGame.sport}-${homeName}-${awayName}`;
            finalGames.set(key, { ...espnGame, source: 'espn' });
        });

        dailyGames.forEach(dg => {
            const allOdds = (dg.bookmakerOdds || []).map((jsonStr: string) => {
                const bookmaker = JSON.parse(jsonStr);
                const h2hMarket = bookmaker.markets.find((m: any) => m.key === 'h2h');
                const normalizedHome = normalizeTeamName(dg.homeTeam);
                const normalizedAway = normalizeTeamName(dg.awayTeam);
                
                const home = h2hMarket?.outcomes.find((o: any) => normalizeTeamName(o.name) === normalizedHome)?.price || 0;
                const away = h2hMarket?.outcomes.find((o: any) => normalizeTeamName(o.name) === normalizedAway)?.price || 0;
                
                return {
                    bookmaker: bookmaker.title,
                    h2hMatchedHome: home,
                    h2hMatchedAway: away,
                    normalizedHome,
                    normalizedAway,
                    rawOutcomes: h2hMarket?.outcomes
                };
            });

            const homeName = normalizeTeamName(dg.homeTeam);
            const awayName = normalizeTeamName(dg.awayTeam);
            const key = `MLB-${homeName}-${awayName}`;
            
            const existing = finalGames.get(key);
            if (existing) {
                finalGames.set(key, {
                    ...existing,
                    source: 'both',
                    oddsApiId: dg.id,
                    allOddsDiagnostic: allOdds
                });
            } else {
                finalGames.set(key, {
                    sport: 'MLB',
                    homeTeam: { name: dg.homeTeam },
                    awayTeam: { name: dg.awayTeam },
                    source: 'odds_only',
                    allOddsDiagnostic: allOdds
                });
            }
        });

        return NextResponse.json({
            count: finalGames.size,
            games: Array.from(finalGames.entries()).map(([k, v]) => ({ key: k, data: v }))
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
