import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);

export async function POST() {
    try {
        const scriptPath = path.join(process.cwd(), 'python', 'nfl_model', 'run_nfl_engine.py');
        const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };

        // Run NFL engine
        await execFileAsync('python', [scriptPath], {
            cwd: process.cwd(),
            env,
            timeout: 60000
        });

        // Read generated projections artifact
        const jsonPath = path.join(process.cwd(), 'python', 'nfl_model', 'data', 'nfl_projections.json');
        let projectionsData: any = {};
        if (fs.existsSync(jsonPath)) {
            projectionsData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        }

        const games = projectionsData.games || [];
        const topBets = games.filter((g: any) => g.best_bet && g.best_bet.signal_tier !== 'No Play');

        return NextResponse.json({
            success: true,
            sport: 'NFL',
            generatedAt: projectionsData.generated_at || new Date().toISOString(),
            totalGames: games.length,
            simulationsPerGame: projectionsData.simulations_per_game || 25000,
            games: games.map((g: any) => ({
                id: g.game_id,
                matchup: g.matchup,
                homeTeam: g.home_team,
                awayTeam: g.away_team,
                marketSpread: g.consensus_spread,
                projectedSpread: g.projected_spread,
                spreadEdge: g.spread_edge,
                marketTotal: g.consensus_total,
                projectedTotal: g.projected_total,
                homeWinProb: g.home_win_prob,
                awayWinProb: g.away_win_prob,
                signal: g.primary_signal,
                bestBet: g.best_bet
            })),
            topBets
        });

    } catch (error: any) {
        console.error('[run-nfl-engine] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to run NFL engine' }, { status: 500 });
    }
}
