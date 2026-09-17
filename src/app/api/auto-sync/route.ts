import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow 5 minutes total for full pipeline

export async function GET(request: NextRequest) {
    // Auth check (if CRON_SECRET is configured)
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const reqUrl = new URL(request.url);
    const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;
    const headers: Record<string, string> = {};
    if (cronSecret) {
        headers['Authorization'] = `Bearer ${cronSecret}`;
    }

    const report: any = {
        timestamp: new Date().toISOString(),
        oddsSync: null,
        accuracySync: null,
        error: null
    };

    try {
        console.log('[auto-sync] Starting Automated Pipeline...');

        // 1. Sync Odds lines first
        try {
            console.log('[auto-sync] Step 1: Syncing odds lines...');
            const oddsRes = await fetch(`${baseUrl}/api/force-sync`, { headers, cache: 'no-store' });
            if (oddsRes.ok) {
                report.oddsSync = await oddsRes.json();
            } else {
                report.oddsSync = { error: `HTTP ${oddsRes.status}` };
            }
        } catch (e: any) {
            report.oddsSync = { error: e.message };
        }

        // 2. Snapshot locking predictions & Grade completed games
        try {
            console.log('[auto-sync] Step 2: Syncing accuracy & grading finished games...');
            const accuracyRes = await fetch(`${baseUrl}/api/sync-accuracy`, { headers, cache: 'no-store' });
            if (accuracyRes.ok) {
                report.accuracySync = await accuracyRes.json();
            } else {
                report.accuracySync = { error: `HTTP ${accuracyRes.status}` };
            }
        } catch (e: any) {
            report.accuracySync = { error: e.message };
        }

        // 3. Grade user pending bets & credit payouts
        try {
            console.log('[auto-sync] Step 3: Grading user bets & applying payouts...');
            const userBetsRes = await fetch(`${baseUrl}/api/sync-user-bets`, { headers, cache: 'no-store' });
            if (userBetsRes.ok) {
                report.userBetsSync = await userBetsRes.json();
            } else {
                report.userBetsSync = { error: `HTTP ${userBetsRes.status}` };
            }
        } catch (e: any) {
            report.userBetsSync = { error: e.message };
        }

        console.log('[auto-sync] Pipeline finished successfully.');
        return NextResponse.json({ success: true, report });

    } catch (error: any) {
        console.error('[auto-sync] Pipeline error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
