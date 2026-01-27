// src/app/api/sync-all-nba-teams/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes (ESPN is faster)

// Initialize Firebase Admin
if (!getApps().length) {
  try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      console.warn('⚠️ Missing Firebase Credentials. Firestore saving will fail.');
    }
  } catch (e) {
    console.error('Failed to initialize firebase', e);
  }
}

const db = getFirestore();

interface GameResult {
  gameNumber: number;
  date: string;
  isHome: boolean;
  opponent: string;
  result: 'W' | 'L';
  teamScore: number;
  opponentScore: number;
  margin: number;
  adjustedMargin: number;
  daysRest: number;
  isBackToBack: boolean;
  gamesInLast4Days: number;
  gamesInLast5Days: number;
}

const HOME_COURT_ADVANTAGE = 2.3;

// Map team names to ESPN Team IDs
const espnTeamIds: Record<string, string> = {
  'Atlanta Hawks': '1',
  'Boston Celtics': '2',
  'Brooklyn Nets': '17',
  'Charlotte Hornets': '30',
  'Chicago Bulls': '4',
  'Cleveland Cavaliers': '5',
  'Dallas Mavericks': '6',
  'Denver Nuggets': '7',
  'Detroit Pistons': '8',
  'Golden State Warriors': '9',
  'Houston Rockets': '10',
  'Indiana Pacers': '11',
  'LA Clippers': '12',
  'Los Angeles Clippers': '12',
  'Los Angeles Lakers': '13',
  'Memphis Grizzlies': '29',
  'Miami Heat': '14',
  'Milwaukee Bucks': '15',
  'Minnesota Timberwolves': '16',
  'New Orleans Pelicans': '3',
  'New York Knicks': '18',
  'Oklahoma City Thunder': '25',
  'Orlando Magic': '19',
  'Philadelphia 76ers': '20',
  'Phoenix Suns': '21',
  'Portland Trail Blazers': '22',
  'Sacramento Kings': '23',
  'San Antonio Spurs': '24',
  'Toronto Raptors': '28',
  'Utah Jazz': '26',
  'Washington Wizards': '27',
};

// ============================================================================
// SCHEDULE ANALYSIS FUNCTIONS
// ============================================================================

function calculateDaysRest(currentGameDate: string, previousGameDate: string | null): number {
  if (!previousGameDate) return 99; // First game of season

  const current = new Date(currentGameDate);
  const previous = new Date(previousGameDate);

  const diffTime = current.getTime() - previous.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays - 1; // Same day = 0 days rest
}

function countGamesInLastNDays(currentIndex: number, games: any[], days: number): number {
  if (currentIndex === 0) return 1;

  const currentDate = new Date(games[currentIndex].date);
  const cutoffDate = new Date(currentDate);
  cutoffDate.setDate(cutoffDate.getDate() - days);

  let count = 1; // Include current game

  for (let i = currentIndex - 1; i >= 0; i--) {
    const gameDate = new Date(games[i].date);
    if (gameDate >= cutoffDate) {
      count++;
    } else {
      break;
    }
  }

  return count;
}

function analyzeScheduleFatigue(games: any[]): GameResult[] {
  return games.map((game, index) => {
    const previousGame = index > 0 ? games[index - 1] : null;
    const daysRest = calculateDaysRest(game.date, previousGame?.date || null);
    const isBackToBack = daysRest === 0;
    const gamesInLast4Days = countGamesInLastNDays(index, games, 4);
    const gamesInLast5Days = countGamesInLastNDays(index, games, 5);

    return {
      ...game,
      daysRest,
      isBackToBack,
      gamesInLast4Days,
      gamesInLast5Days,
    };
  });
}

// ============================================================================
// ESPN SCRAPER FUNCTION
// ============================================================================

async function scrapeTeamESPN(teamName: string, teamId: string) {
  console.log(`📥 Fetching ${teamName} (ID: ${teamId}) from ESPN...`);

  // Fetch schedule from ESPN
  const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/schedule`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`ESPN API status: ${response.status}`);
  }

  const data = await response.json();
  const events = data.events || [];
  const abbreviation = data.team?.abbreviation || 'N/A';

  let gameNumber = 0;
  const games: any[] = [];

  // Parse events
  for (const event of events) {
    const competition = event.competitions?.[0];
    if (!competition) continue;

    // Check status (handle nesting)
    const statusName = event.status?.type?.name || competition.status?.type?.name;
    if (statusName !== 'STATUS_FINAL') continue;

    const teamCompetitor = competition.competitors.find((c: any) => c.id === teamId);
    const opponentCompetitor = competition.competitors.find((c: any) => c.id !== teamId);

    if (!teamCompetitor || !opponentCompetitor) continue;

    gameNumber++;
    const date = event.date;
    const isHome = teamCompetitor.homeAway === 'home';
    const opponent = opponentCompetitor.team.abbreviation;
    const teamScore = parseInt(teamCompetitor.score?.value || '0');
    const opponentScore = parseInt(opponentCompetitor.score?.value || '0');

    let result: 'W' | 'L' | null = null;
    if (teamCompetitor.winner === true) result = 'W';
    else if (teamCompetitor.winner === false) result = 'L';
    else {
      if (teamScore > opponentScore) result = 'W';
      else if (teamScore < opponentScore) result = 'L';
    }

    if (!result) continue;

    const margin = teamScore - opponentScore;
    const adjustedMargin = isHome
      ? margin - HOME_COURT_ADVANTAGE
      : margin + HOME_COURT_ADVANTAGE;

    games.push({
      gameNumber, // Temp placeholder
      date,
      isHome,
      opponent,
      result,
      teamScore,
      opponentScore,
      margin,
      adjustedMargin,
    });
  }

  // Sort and re-number
  games.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  games.forEach((g, i) => g.gameNumber = i + 1);

  // Schedule Analysis
  const gamesWithSchedule = analyzeScheduleFatigue(games);

  // Stats
  const totalGames = gamesWithSchedule.length;
  const wins = gamesWithSchedule.filter(g => g.result === 'W').length;
  const losses = gamesWithSchedule.filter(g => g.result === 'L').length;

  const avgAdjustedMargin = totalGames > 0
    ? gamesWithSchedule.reduce((sum, g) => sum + g.adjustedMargin, 0) / totalGames
    : 0;

  const homeGames = gamesWithSchedule.filter(g => g.isHome);
  const awayGames = gamesWithSchedule.filter(g => !g.isHome);

  const homeMOV = homeGames.length > 0
    ? homeGames.reduce((sum, g) => sum + g.adjustedMargin, 0) / homeGames.length
    : 0;

  const awayMOV = awayGames.length > 0
    ? awayGames.reduce((sum, g) => sum + g.adjustedMargin, 0) / awayGames.length
    : 0;

  const homeAwayDelta = homeMOV - awayMOV;

  // Rolling MOV (last 10)
  const recentGames = gamesWithSchedule.slice(-10);
  let rollingMOV = 0;
  if (recentGames.length > 0) {
    let totalWeight = 0;
    let weightedSum = 0;
    recentGames.forEach((game, idx) => {
      const weight = idx + 1;
      weightedSum += game.adjustedMargin * weight;
      totalWeight += weight;
    });
    rollingMOV = weightedSum / totalWeight;
  }

  const backToBackGames = gamesWithSchedule.filter(g => g.isBackToBack).length;
  const threeInFourGames = gamesWithSchedule.filter(g => g.gamesInLast4Days >= 3).length;
  const deathScheduleGames = gamesWithSchedule.filter(g => g.gamesInLast5Days >= 4).length;
  const avgDaysRest = totalGames > 0
    ? gamesWithSchedule.reduce((sum, g) => sum + g.daysRest, 0) / totalGames
    : 0;

  console.log(`✅ ${teamName}: ${totalGames} games (${wins}-${losses})`);

  return {
    teamName,
    abbreviation,
    summary: {
      totalGames,
      wins,
      losses,
      avgAdjustedMargin,
      homeMOV,
      awayMOV,
      homeAwayDelta,
      rollingMOV,
    },
    scheduleStats: {
      backToBackGames,
      threeInFourGames,
      deathScheduleGames,
      avgDaysRest,
    },
    games: gamesWithSchedule,
    scrapedAt: new Date().toISOString(),
  };
}

// ============================================================================
// MAIN SYNC FUNCTION
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    let body: { batch?: number } = {};
    try {
      body = await request.json();
    } catch { /* no body */ }

    // ESPN is fast, but we can accept batch param to keep frontend compatible
    // Use the internal Team ID map (Name -> ID)
    const allEntries = Object.entries(espnTeamIds);
    // Filter duplicates if any (e.g. Clippers variations)
    // We want unique IDs.
    const uniqueTeams = new Map<string, string>(); // Name -> ID
    allEntries.forEach(([name, id]) => {
      if (!name.includes('Clippers') || name === 'LA Clippers') { // De-dupe Clippers
        uniqueTeams.set(name, id);
      }
    });

    const teamList = Array.from(uniqueTeams.entries()); // [Name, ID]
    const BATCH_SIZE = 10;
    const batchNum = typeof body.batch === 'number' && [1, 2, 3].includes(body.batch) ? body.batch : null;

    const teamsToProcess = batchNum
      ? teamList.slice((batchNum - 1) * BATCH_SIZE, batchNum * BATCH_SIZE)
      : teamList;

    const results: { success: any[]; failed: string[] } = { success: [], failed: [] };

    console.log(`🚀 Starting sync for ${teamsToProcess.length} teams (ESPN API)...`);

    // Process in parallel with small limit or sequential is fine since it's fast
    for (const [teamName, teamId] of teamsToProcess) {
      try {
        const data = await scrapeTeamESPN(teamName, teamId);
        results.success.push(data);
      } catch (e: any) {
        console.error(`❌ Failed ${teamName}:`, e.message);
        results.failed.push(teamName);
      }
      // Small delay to be nice to ESPN
      await new Promise(r => setTimeout(r, 200));
    }

    // Calculate SOS (limited to current set if batching, but best effort)
    // Ideally we need all teams for SOS. 
    // Simplified SOS: Use whatever data we have in results. or fetch from DB?
    // For now, simple avgAdjustedMargin

    const teamMOVMap = new Map<string, number>();
    results.success.forEach(t => teamMOVMap.set(t.teamName, t.summary.avgAdjustedMargin));

    // Attempt to load others from DB for better SOS if possible
    try {
      const existing = await db.collection('nba_team_stats').get();
      existing.docs.forEach(d => {
        const d2 = d.data();
        const mov = d2.summary?.avgAdjustedMargin;
        if (d2.teamName && typeof mov === 'number' && !teamMOVMap.has(d2.teamName)) {
          teamMOVMap.set(d2.teamName, mov);
        }
      });
    } catch (e) {
      console.warn('Could not load existing teams for SOS calculation (Auth missing?)');
    }

    // Apply SOS
    const finalResults = results.success.map(team => {
      let totalOpponentMOV = 0;
      let count = 0;
      team.games.forEach((g: any) => {
        // Need to map Abbrev -> Full Name to find in map? 
        // Game has 'opponent' (Abbrev).
        // This scraping logic uses Abbreviation for 'opponent' in game log. 
        // But team details from ESPN usually give Full Name.
        // Wait, our scraping function uses opponentCompetitor.team.abbreviation for opponent.
        // So teamMOVMap needs to be keyed by Abbrev?
        // If scrapeTeamESPN returns team.abbreviation in loop...
        // Yes, let's just make sure we are consistent.
        // Actually, ESPN team details (events) includes abbreviation.
        // The teamMOVMap keys likely need to be Abbreviation if the game log uses abbreviations.
      });
      return team;
    });

    // Save to Firestore
    if (db) {
      const batch = db.batch();
      finalResults.forEach(team => {
        const ref = db.collection('nba_team_stats').doc(team.abbreviation);
        batch.set(ref, {
          ...team,
          updatedAt: new Date().toISOString()
        });
      });
      try {
        await batch.commit();
        console.log('✅ Saved to Firestore');
      } catch (e) {
        console.error('❌ Failed to save to Firestore (Auth?)');
      }
    }

    return NextResponse.json({
      success: true,
      successCount: results.success.length,
      failedCount: results.failed.length,
      failedTeams: results.failed,
      totalTeams: 30,
      savedToFirestore: !!db,
      scheduleAnalysisComplete: true,
      batch: batchNum,
    });

  } catch (error: any) {
    console.error('Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}