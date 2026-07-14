import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
    try {
        const propsSnapshot = await db.collection('player_props').get();
        const allProps = propsSnapshot.docs.map(doc => doc.data());

        const now = new Date().getTime();
        // Filter out props for games that have already started, and restrict predictions to NBA
        const activeProps = allProps.filter(prop => {
            if (prop.sport && prop.sport !== 'NBA') return false;
            if (!prop.commenceTime) return true; // keep if we don't know the time
            return new Date(prop.commenceTime).getTime() > now;
        });

        console.log(`[PREDICT PROPS API] Analyzing ${activeProps.length} upcoming props (filtered out ${allProps.length - activeProps.length} started props)...`);

        const predictions = [];

        // Get unique player names from active props
        const playerNames = [...new Set(activeProps.map(p => p.playerName))];
        
        // Fetch stats only for these players using 'in' queries (max 30 per query)
        const statsByPlayer = new Map();
        const statsPromises = [];
        
        for (let i = 0; i < playerNames.length; i += 30) {
            const chunk = playerNames.slice(i, i + 30);
            if (chunk.length > 0) {
                statsPromises.push(
                    db.collection('completed_player_stats')
                      .where('playerName', 'in', chunk)
                      .get()
                );
            }
        }
        
        const statsSnapshots = await Promise.all(statsPromises);
        statsSnapshots.forEach(snapshot => {
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const name = data.playerName;
                if (!statsByPlayer.has(name)) {
                    statsByPlayer.set(name, []);
                }
                statsByPlayer.get(name).push(data);
            });
        });

        for (const prop of activeProps) {
            let games = statsByPlayer.get(prop.playerName) || [];

            // Sort by date desc and limit to 15
            games.sort((a: any, b: any) => b.gameDate.localeCompare(a.gameDate));
            games = games.slice(0, 15);

            if (games.length < 5) continue; // Not enough data for a confident prediction

            // Calculate Metrics
            const seasonPoints = games.map((g: any) => g.stats.points);
            const seasonAvg = seasonPoints.reduce((a: any, b: any) => a + b, 0) / seasonPoints.length;

            const last5 = seasonPoints.slice(0, 5);
            const last5Avg = last5.reduce((a: any, b: any) => a + b, 0) / last5.length;

            // Trend Factor: Weight recent games more (60/40 split)
            const projectedPoints = (seasonAvg * 0.4) + (last5Avg * 0.6);

            // Edge Calculation
            const marketLine = prop.line;
            const diff = projectedPoints - marketLine;
            const edge = (diff / marketLine) * 100;

            predictions.push({
                ...prop,
                projectedPoints: parseFloat(projectedPoints.toFixed(1)),
                seasonAvg: parseFloat(seasonAvg.toFixed(1)),
                last5Avg: parseFloat(last5Avg.toFixed(1)),
                edge: parseFloat(edge.toFixed(1)),
                recommendation: edge > 10 ? 'Over' : (edge < -10 ? 'Under' : 'No Play'),
                confidence: Math.min(Math.abs(edge) * 2, 100), // Scaled confidence
                sampleSize: games.length,
                recentGames: games.map((g: any) => ({
                    date: g.gameDate,
                    points: g.stats.points
                })).reverse() // Reverse so oldest is first for the chart (left to right)
            });
        }

        // Sort by biggest absolute edge
        predictions.sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge));

        return NextResponse.json(predictions);
    } catch (error: any) {
        console.error("[PREDICT PROPS API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
