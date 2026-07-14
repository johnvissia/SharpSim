import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
    return handleSync(request);
}

export async function POST(request: NextRequest) {
    return handleSync(request);
}

async function handleSync(request: NextRequest) {
    try {
        // Auth check (if CRON_SECRET is configured)
        const authHeader = request.headers.get('Authorization');
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret) {
            if (authHeader !== `Bearer ${cronSecret}`) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const { searchParams } = new URL(request.url);
        const fullSeason = searchParams.get('fullSeason') === 'true';
        const season = searchParams.get('season') || '2024-25';

        let url = `https://stats.nba.com/stats/playergamelogs?Season=${season}&SeasonType=Regular+Season&PlayerOrTeam=P&LeagueID=00`;

        if (!fullSeason) {
            // Default: Sync only the last 5 days to avoid quota limits
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 5);
            const pad = (n: number) => String(n).padStart(2, '0');
            const dateFromStr = `${pad(pastDate.getMonth() + 1)}/${pad(pastDate.getDate())}/${pastDate.getFullYear()}`;
            url += `&DateFrom=${dateFromStr}`;
            console.log(`[PLAYER LOGS API] Syncing logs since ${dateFromStr}`);
        } else {
            console.log(`[PLAYER LOGS API] Syncing FULL season logs for ${season}`);
        }

        const headers = {
            'Host': 'stats.nba.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://www.nba.com/',
            'Origin': 'https://www.nba.com',
            'x-nba-stats-origin': 'stats',
            'x-nba-stats-token': 'true',
        };

        console.log("[PLAYER LOGS API] Fetching from stats.nba.com...");
        const res = await fetch(url, { headers });
        if (!res.ok) {
            throw new Error(`NBA API returned status ${res.status}`);
        }

        const data = await res.json();
        const resultSet = data.resultSets?.[0];
        if (!resultSet || !resultSet.rowSet || resultSet.rowSet.length === 0) {
            return NextResponse.json({ success: true, count: 0, message: "No new logs found to sync." });
        }

        const cols = resultSet.headers;
        const playerIndex = cols.indexOf('PLAYER_NAME');
        const gameIdIndex = cols.indexOf('GAME_ID');
        const ptsIndex = cols.indexOf('PTS');
        const gameDateIndex = cols.indexOf('GAME_DATE');

        if (playerIndex === -1 || gameIdIndex === -1 || ptsIndex === -1 || gameDateIndex === -1) {
            throw new Error("Missing required columns in NBA API response");
        }

        console.log(`[PLAYER LOGS API] Processing ${resultSet.rowSet.length} rows...`);

        let count = 0;
        const batchSize = 450;
        let batch = db.batch();

        for (const row of resultSet.rowSet) {
            const playerName = String(row[playerIndex]);
            const gameId = String(row[gameIdIndex]);
            const pts = Number(row[ptsIndex]);
            const gameDateRaw = String(row[gameDateIndex]);

            const gameDate = gameDateRaw.includes('T') ? gameDateRaw.split('T')[0] : gameDateRaw;
            const safePlayerName = playerName.replace(/ /g, '_').replace(/\//g, '_');
            const docId = `${safePlayerName}_${gameId}`;

            const docRef = db.collection('completed_player_stats').doc(docId);
            batch.set(docRef, {
                playerName,
                gameDate,
                stats: {
                    points: pts
                },
                sys_updated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            count++;

            if (count % batchSize === 0) {
                await batch.commit();
                batch = db.batch();
                console.log(`[PLAYER LOGS API] Saved ${count} records...`);
            }
        }

        // Commit remainder
        if (count % batchSize !== 0) {
            await batch.commit();
        }

        console.log(`[PLAYER LOGS API] Successfully synced ${count} player game logs.`);
        return NextResponse.json({ success: true, count });

    } catch (error: any) {
        console.error("[PLAYER LOGS API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
