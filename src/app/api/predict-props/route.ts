import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
    try {
        const propsSnapshot = await db.collection('player_props').get();
        const allProps = propsSnapshot.docs.map(doc => doc.data());

        // Use all props
        const activeProps = allProps;

        console.log(`[PREDICT PROPS API] Analyzing ${activeProps.length} props...`);

        const predictions = [];

        for (const prop of activeProps) {
            const playerId = prop.playerId || prop.playerName.replace(/\s+/g, '_');

            // Fetch stats (sort in memory to avoid index requirement)
            const statsSnapshot = await db.collection('completed_player_stats')
                .where('playerName', '==', prop.playerName)
                .get();

            let games = statsSnapshot.docs.map(doc => doc.data());

            // Sort by date desc and limit to 15
            games.sort((a, b) => b.gameDate.localeCompare(a.gameDate));
            games = games.slice(0, 15);

            if (games.length < 5) continue; // Not enough data for a confident prediction

            // Calculate Metrics
            const seasonPoints = games.map(g => g.stats.points);
            const seasonAvg = seasonPoints.reduce((a, b) => a + b, 0) / seasonPoints.length;

            const last5 = seasonPoints.slice(0, 5);
            const last5Avg = last5.reduce((a, b) => a + b, 0) / last5.length;

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
                recentGames: games.map(g => ({
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
