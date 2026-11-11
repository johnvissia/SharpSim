import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow full pipeline execution

/**
 * MASTER DAILY PIPELINE
 * Single automated endpoint triggered once per day (e.g. 04:00 AM UTC).
 * Designed specifically for Vercel Hobby plan (1 cron execution per day limit).
 *
 * Sequence:
 * 1. Sync live odds lines across all sports (/api/force-sync)
 * 2. Sync active player props (/api/sync-player-props)
 * 3. Update team injury reports (/api/update-injuries)
 * 4. Recalculate power ratings (/api/calculate-power-ratings)
 * 5. Run algorithmic prediction engines (NBA, EPL, UCL)
 * 6. Snapshot predictions & Grade finished game accuracy (/api/sync-accuracy)
 * 7. Grade pending user bets & credit payouts (/api/sync-user-bets)
 */
export async function GET(request: NextRequest) {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authorized) {
        return authResult.errorResponse!;
    }

    const reqUrl = new URL(request.url);
    const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;
    const cronSecret = process.env.CRON_SECRET;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (cronSecret) {
        headers['Authorization'] = `Bearer ${cronSecret}`;
    }

    const report: Record<string, any> = {
        timestamp: new Date().toISOString(),
        steps: {},
        errors: [],
    };

    const runStep = async (stepName: string, url: string, method: 'GET' | 'POST' = 'GET', body?: any) => {
        try {
            console.log(`[auto-sync] Running step: ${stepName}...`);
            const res = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                cache: 'no-store',
            });
            const data = await res.json().catch(() => ({ status: res.status }));
            report.steps[stepName] = { ok: res.ok, status: res.status, data };
            if (!res.ok) {
                report.errors.push(`${stepName} failed with HTTP ${res.status}`);
            }
        } catch (e: any) {
            console.error(`[auto-sync] Step ${stepName} error:`, e.message);
            report.steps[stepName] = { ok: false, error: e.message };
            report.errors.push(`${stepName}: ${e.message}`);
        }
    };

    console.log('[auto-sync] === STARTING MASTER DAILY AUTOMATED PIPELINE ===');

    // 1. Sync Game Odds Lines
    await runStep('syncOddsLines', `${baseUrl}/api/force-sync`);

    // 2. Sync Player Props (NBA & MLB)
    await runStep('syncNbaProps', `${baseUrl}/api/sync-player-props?sport=nba`, 'POST');

    // 3. Update Injuries
    await runStep('updateInjuries', `${baseUrl}/api/update-injuries`);

    // 4. Update Power Ratings
    await runStep('powerRatings', `${baseUrl}/api/calculate-power-ratings`, 'POST');

    // 5. Run Prediction Engines
    await runStep('nbaEngine', `${baseUrl}/api/run-nba-engine`, 'POST');
    await runStep('eplEngine', `${baseUrl}/api/run-epl-engine`, 'POST');
    await runStep('uclEngine', `${baseUrl}/api/run-ucl-engine`, 'POST');

    // 6. Snapshot predictions & Grade completed games
    await runStep('syncAccuracyAndGrading', `${baseUrl}/api/sync-accuracy`);

    // 7. Grade pending user bets & credit payouts
    await runStep('gradeUserBets', `${baseUrl}/api/sync-user-bets`);

    console.log('[auto-sync] === MASTER DAILY AUTOMATED PIPELINE COMPLETE ===');

    const success = report.errors.length === 0;
    return NextResponse.json({
        success,
        summary: `Pipeline finished with ${report.errors.length} error(s)`,
        report,
    });
}
