import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

const normalizeMlbAbbrev = (abbrev: string): string => {
  const map: Record<string, string> = {
    'CWS': 'CHW',
    'TBR': 'TB',
    'KCR': 'KC',
    'SDP': 'SD',
    'SFG': 'SF',
    'WSN': 'WSH',
    'ATH': 'OAK',
  };
  return map[abbrev] || abbrev;
};

function calculateBaseRuns(s: any): number {
  if (!s) return 0;
  const H = s.hits || 0;
  const BB = s.baseOnBalls || 0;
  const HBP = s.hitByPitch || 0;
  const HR = s.homeRuns || 0;
  const IBB = s.intentionalWalks || 0;
  const TB = s.totalBases || 0;
  const SB = s.stolenBases || 0;
  const CS = s.caughtStealing || 0;
  const GDP = s.groundIntoDoublePlay || 0;
  const AB = s.atBats || 0;

  const A = H + BB + HBP - HR - 0.5 * IBB;
  const B = 1.4 * TB - 0.6 * H - 3 * HR + 0.1 * (BB + HBP - IBB) + 0.9 * (SB - CS - GDP);
  const C = AB - H + CS + GDP;
  const D = HR;

  const denom = B + C;
  if (denom === 0) return D;
  return (A * B) / denom + D;
}

export async function POST(request: NextRequest) {
  try {
    const currentYear = new Date().getFullYear();

    // 1. Fetch MLB Teams from MLB Stats API
    console.log('[MLB Sync] Fetching teams list...');
    const teamsRes = await fetch('https://statsapi.mlb.com/api/v1/teams?sportId=1', { cache: 'no-store' });
    if (!teamsRes.ok) {
      throw new Error(`MLB Stats API teams endpoint returned status ${teamsRes.status}`);
    }
    const teamsData = await teamsRes.json();
    const mlbTeams = teamsData.teams || [];

    // Map statsapi team ID to team details
    const teamMap = new Map<number, { name: string; abbreviation: string; logo: string }>();
    mlbTeams.forEach((t: any) => {
      const canonicalAbbrev = normalizeMlbAbbrev(t.abbreviation);
      teamMap.set(t.id, {
        name: t.name,
        abbreviation: canonicalAbbrev,
        logo: `https://a.espncdn.com/i/teamlogos/mlb/500/${canonicalAbbrev.toLowerCase()}.png`
      });
    });

    // 2. Fetch Hitting and Pitching GameLogs for all teams in parallel
    console.log('[MLB Sync] Fetching hitting & pitching logs for all teams...');
    
    const finalResults = await Promise.all(
      mlbTeams.map(async (team: any) => {
        const teamId = team.id;
        const details = teamMap.get(teamId)!;

        try {
          const [hitRes, pitchRes] = await Promise.all([
            fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=gameLog&season=${currentYear}&group=hitting`, { cache: 'no-store' }),
            fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=gameLog&season=${currentYear}&group=pitching`, { cache: 'no-store' })
          ]);

          if (!hitRes.ok || !pitchRes.ok) {
            throw new Error(`Failed to fetch logs for team ${details.abbreviation}`);
          }

          const hitData = await hitRes.json();
          const pitchData = await pitchRes.json();

          const hitSplits = hitData.stats?.[0]?.splits || [];
          const pitchSplits = pitchData.stats?.[0]?.splits || [];

          // Map pitching splits by gamePk for fast lookup
          const pitchMap = new Map<number, any>();
          pitchSplits.forEach((s: any) => {
            if (s.game?.gamePk) {
              pitchMap.set(s.game.gamePk, s.stat);
            }
          });

          const games: any[] = [];

          hitSplits.forEach((hs: any) => {
            const gamePk = hs.game?.gamePk;
            if (!gamePk) return;

            const ps = pitchMap.get(gamePk);
            if (!ps) return; // Need matching pitching stats

            // Calculate BaseRuns (BsR)
            const bsrFor = calculateBaseRuns(hs.stat);
            const bsrAgainst = calculateBaseRuns(ps);

            const oppDetails = teamMap.get(hs.opponent?.id);
            const opponentAbbrev = oppDetails ? oppDetails.abbreviation : normalizeMlbAbbrev(hs.opponent?.abbreviation || 'UNKNOWN');

            // Luck adjustment metrics
            const babip = hs.stat.babip ? parseFloat(hs.stat.babip) : 0.300;
            const babipAllowed = ps.babip ? parseFloat(ps.babip) : 0.300;
            
            // Calculate LOB% = (H + BB - R) / (H + BB - 1.4 * HR)
            const lobHits = hs.stat.hits || 0;
            const lobBB = hs.stat.baseOnBalls || 0;
            const lobHR = hs.stat.homeRuns || 0;
            const lobRuns = hs.stat.runs || 0;
            const lobDenom = (lobHits + lobBB - 1.4 * lobHR);
            const lobPct = lobDenom > 0 ? (lobHits + lobBB - lobRuns) / lobDenom : 0.72; // default 72%

            // HR/FB% = HR / (airOuts * 0.4)
            const flyBalls = (hs.stat.airOuts || 0) * 0.4;
            const hrfb = flyBalls > 0 ? (hs.stat.homeRuns || 0) / flyBalls : 0.10; // default 10%

            games.push({
              gameId: String(gamePk),
              date: hs.date,
              isHome: hs.isHome,
              opponent: opponentAbbrev,
              result: hs.stat.runs > ps.runs ? 'W' : 'L',
              teamScore: hs.stat.runs,
              opponentScore: ps.runs,
              margin: hs.stat.runs - ps.runs,
              bsrFor,
              bsrAgainst,
              babip,
              babipAllowed,
              lobPct,
              hrfb,
              // Keep raw stats just in case
              rawStats: {
                hits: hs.stat.hits || 0,
                walks: hs.stat.baseOnBalls || 0,
                hr: hs.stat.homeRuns || 0,
                so: hs.stat.strikeOuts || 0,
                ab: hs.stat.atBats || 0,
                ip: ps.inningsPitched ? parseFloat(ps.inningsPitched) : 9.0
              }
            });
          });

          // Sort games chronologically
          games.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          games.forEach((g, idx) => {
            g.gameNumber = idx + 1;
          });

          const totalGames = games.length;
          const wins = games.filter(g => g.result === 'W').length;
          const losses = games.filter(g => g.result === 'L').length;

          // Simple averages of expected runs
          const avgBsRFor = totalGames > 0 ? games.reduce((sum, g) => sum + g.bsrFor, 0) / totalGames : 0;
          const avgBsRAgainst = totalGames > 0 ? games.reduce((sum, g) => sum + g.bsrAgainst, 0) / totalGames : 0;

          // Calculate average margin using actual scores
          const avgActualMargin = totalGames > 0 ? games.reduce((sum, g) => sum + g.margin, 0) / totalGames : 0;

          return {
            teamName: details.name,
            abbreviation: details.abbreviation,
            logo: details.logo,
            games,
            summary: {
              totalGames,
              wins,
              losses,
              avgBsRFor,
              avgBsRAgainst,
              avgAdjustedMargin: avgActualMargin // Stored for admin dashboard compatibility
            }
          };

        } catch (e: any) {
          console.error(`Failed to sync team ${details.abbreviation}:`, e.message);
          return null;
        }
      })
    );

    // Filter out failed teams
    const validResults = finalResults.filter(r => r !== null);

    // Save to Firestore
    if (db && validResults.length > 0) {
      const batch = db.batch();
      validResults.forEach((team) => {
        const ref = db.collection('mlb_team_stats').doc(team.abbreviation);
        batch.set(ref, {
          ...team,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      });
      await batch.commit();
      console.log(`[MLB Sync] Successfully synchronized ${validResults.length} MLB teams and games.`);
    }

    return NextResponse.json({
      success: true,
      successCount: validResults.length,
      totalTeams: validResults.length,
      failedTeams: [],
      message: `Successfully synchronized ${validResults.length} MLB teams and expected runs (BaseRuns).`
    });

  } catch (error: any) {
    console.error('Error synchronizing MLB teams:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      message: "Failed to synchronize MLB teams"
    }, { status: 500 });
  }
}
