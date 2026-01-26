// src/app/api/sync-all-nba-teams/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { fetchBbrefHtml } from '@/lib/bbref';

export const dynamic = 'force-dynamic';
// ~5s initial + ~17s avg × 29 gaps + fetch time → allow up to 10 min (adjust for your host limits)
export const maxDuration = 600;

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
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

interface TeamData {
  teamName: string;
  abbreviation: string;
  summary: {
    totalGames: number;
    wins: number;
    losses: number;
    avgAdjustedMargin: number;
    homeMOV: number;
    awayMOV: number;
    homeAwayDelta: number;
    rollingMOV: number;
    sos?: number;
    scheduleAdjustedMOV?: number;
  };
  scheduleStats: {
    backToBackGames: number;
    threeInFourGames: number;
    deathScheduleGames: number;
    avgDaysRest: number;
  };
  games: GameResult[];
  scrapedAt: string;
}

const NBA_TEAMS: Record<string, string> = {
  'Atlanta Hawks': 'ATL',
  'Boston Celtics': 'BOS',
  'Brooklyn Nets': 'BRK',
  'Charlotte Hornets': 'CHO',
  'Chicago Bulls': 'CHI',
  'Cleveland Cavaliers': 'CLE',
  'Dallas Mavericks': 'DAL',
  'Denver Nuggets': 'DEN',
  'Detroit Pistons': 'DET',
  'Golden State Warriors': 'GSW',
  'Houston Rockets': 'HOU',
  'Indiana Pacers': 'IND',
  'Los Angeles Clippers': 'LAC',
  'Los Angeles Lakers': 'LAL',
  'Memphis Grizzlies': 'MEM',
  'Miami Heat': 'MIA',
  'Milwaukee Bucks': 'MIL',
  'Minnesota Timberwolves': 'MIN',
  'New Orleans Pelicans': 'NOP',
  'New York Knicks': 'NYK',
  'Oklahoma City Thunder': 'OKC',
  'Orlando Magic': 'ORL',
  'Philadelphia 76ers': 'PHI',
  'Phoenix Suns': 'PHX',  // FIXED: Should be PHX
  'Portland Trail Blazers': 'POR',
  'Sacramento Kings': 'SAC',
  'San Antonio Spurs': 'SAS',
  'Toronto Raptors': 'TOR',
  'Utah Jazz': 'UTA',
  'Washington Wizards': 'WAS',
};

const HOME_COURT_ADVANTAGE = 2.3;

// ============================================================================
// RATE LIMITING & ANTI-BLOCK CONFIG
// ============================================================================
// Basketball Reference rate-limits and blocks aggressive scrapers. We use:
// - NBA-style Referer so requests look like they originate from nba.com
// - Long delays with random jitter between teams to avoid IP bans
// - Exponential backoff on retries

const INITIAL_DELAY_MS = 5000;           // Wait before first request (cold start)
const DELAY_BETWEEN_TEAMS_MS_MIN = 12000; // Min delay between teams (seconds)
const DELAY_BETWEEN_TEAMS_MS_MAX = 22000; // Max delay (random jitter in between)
const RETRY_DELAY_BASE_MS = 8000;        // Base for exponential backoff (8s, 20s, 45s)

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelayBetweenTeams(): number {
  const min = DELAY_BETWEEN_TEAMS_MS_MIN;
  const max = DELAY_BETWEEN_TEAMS_MS_MAX;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================================================
// SCHEDULE ANALYSIS FUNCTIONS
// ============================================================================

function calculateDaysRest(currentGameDate: string, previousGameDate: string | null): number {
  if (!previousGameDate) return 99;
  
  const current = new Date(currentGameDate);
  const previous = new Date(previousGameDate);
  
  const diffTime = current.getTime() - previous.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays - 1;
}

function countGamesInLastNDays(currentIndex: number, games: any[], days: number): number {
  if (currentIndex === 0) return 1;
  
  const currentDate = new Date(games[currentIndex].date);
  const cutoffDate = new Date(currentDate);
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  let count = 1;
  
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
// ENHANCED SCRAPER WITH BETTER ERROR HANDLING
// ============================================================================

async function scrapeTeam(
  teamName: string, 
  abbreviation: string, 
  retryCount: number = 0
): Promise<TeamData | null> {
  const MAX_RETRIES = 3;
  
  try {
    console.log(`📥 Scraping ${teamName} (${abbreviation})...`);
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const seasonEndYear = currentMonth >= 7 ? currentYear + 1 : currentYear;

    const url = `https://www.basketball-reference.com/teams/${abbreviation}/${seasonEndYear}_games.html`;
    console.log(`   URL: ${url}`);

    const html = await fetchBbrefHtml(url);

    // Check if HTML is valid
    if (!html.includes('basketball-reference.com') && !html.includes('games')) {
      console.error(`❌ Invalid HTML received for ${teamName}`);
      console.error(`First 500 chars: ${html.substring(0, 500)}`);
      throw new Error(`Invalid HTML response for ${teamName}`);
    }

    const $ = cheerio.load(html);

    const games: any[] = [];
    let gameNumber = 0;

    $('#games tbody tr').each((_, row) => {
      const $row = $(row);
      
      if ($row.hasClass('thead')) return;
      
      const result = $row.find('td[data-stat="game_result"]').text().trim();
      if (!result || (result !== 'W' && result !== 'L')) return;

      gameNumber++;

      const date = $row.find('td[data-stat="date_game"]').text().trim();
      const locationSymbol = $row.find('td[data-stat="game_location"]').text().trim();
      const isHome = locationSymbol !== '@';
      const opponent = $row.find('td[data-stat="opp_name"]').text().trim();
      const teamScore = parseInt($row.find('td[data-stat="pts"]').text()) || 0;
      const opponentScore = parseInt($row.find('td[data-stat="opp_pts"]').text()) || 0;

      if (!teamScore || !opponentScore) return;

      const margin = teamScore - opponentScore;
      const adjustedMargin = isHome ? margin - HOME_COURT_ADVANTAGE : margin + HOME_COURT_ADVANTAGE;

      games.push({
        gameNumber,
        date,
        isHome,
        opponent,
        result: result as 'W' | 'L',
        teamScore,
        opponentScore,
        margin,
        adjustedMargin,
      });
    });

    // Check if we got games
    if (games.length === 0) {
      console.error(`❌ No games found for ${teamName}. Checking HTML structure...`);
      console.error(`Table exists: ${$('#games').length > 0}`);
      console.error(`Rows found: ${$('#games tbody tr').length}`);
      throw new Error(`No games found for ${teamName} - possible HTML structure change`);
    }

    // Add schedule fatigue analysis
    const gamesWithSchedule = analyzeScheduleFatigue(games);

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

    console.log(`✅ ${teamName}: ${totalGames} games (${wins}-${losses}), ${deathScheduleGames} death schedule games`);

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
    
  } catch (error: any) {
    console.error(`❌ Error scraping ${teamName}: ${error.message}`);
    
    if (retryCount < MAX_RETRIES) {
      const backoffMs = RETRY_DELAY_BASE_MS * Math.pow(2.5, retryCount);
      console.log(`🔄 Retrying ${teamName} (attempt ${retryCount + 1}/${MAX_RETRIES}) in ${Math.round(backoffMs / 1000)}s...`);
      await delayMs(backoffMs);
      return scrapeTeam(teamName, abbreviation, retryCount + 1);
    }
    
    console.error(`💀 ${teamName} failed after ${MAX_RETRIES} retries`);
    return null;
  }
}

// ============================================================================
// MAIN SYNC FUNCTION
// ============================================================================

const BATCH_SIZE = 10;

export async function POST(request: NextRequest) {
  try {
    let body: { batch?: number } = {};
    try {
      body = await request.json();
    } catch {
      /* no body */
    }
    const batchNum = typeof body.batch === 'number' && [1, 2, 3].includes(body.batch) ? body.batch : null;

    const allEntries = Object.entries(NBA_TEAMS);
    const teams = batchNum
      ? allEntries.slice((batchNum - 1) * BATCH_SIZE, batchNum * BATCH_SIZE)
      : allEntries;
    const batchLabel = batchNum ? `${(batchNum - 1) * BATCH_SIZE + 1}-${batchNum * BATCH_SIZE}` : null;

    console.log(batchNum
      ? `🚀 Starting sync batch ${batchNum} (teams ${batchLabel})...`
      : '🚀 Starting sync of all 30 NBA teams...');
    console.log(`⏱️  Initial delay ${INITIAL_DELAY_MS / 1000}s, then ${DELAY_BETWEEN_TEAMS_MS_MIN / 1000}-${DELAY_BETWEEN_TEAMS_MS_MAX / 1000}s between teams (NBA Referer)`);

    await delayMs(INITIAL_DELAY_MS);
    console.log('✅ Cold-start delay complete, starting scrapes...\n');

    const results: { success: TeamData[]; failed: string[] } = { success: [], failed: [] };

    for (let i = 0; i < teams.length; i++) {
      const [teamName, abbreviation] = teams[i];

      console.log(`\n[${i + 1}/${teams.length}] Processing ${teamName}...`);

      const teamData = await scrapeTeam(teamName, abbreviation);

      if (teamData) {
        results.success.push(teamData);
      } else {
        results.failed.push(teamName);
      }

      if (i < teams.length - 1) {
        const waitMs = randomDelayBetweenTeams();
        console.log(`⏳ Waiting ${(waitMs / 1000).toFixed(1)}s before next request (anti-block buffer)...`);
        await delayMs(waitMs);
      }
    }

    console.log(`\n🎉 Scrape complete: ${results.success.length}/${teams.length} success, ${results.failed.length} failed`);

    if (results.failed.length > 0) {
      console.log(`⚠️ Failed teams: ${results.failed.join(', ')}`);
    }

    // Build MOV map: use newly scraped data + load existing from Firestore for other teams (SOS)
    const teamMOVMap = new Map<string, number>();
    results.success.forEach((team) => {
      teamMOVMap.set(team.teamName, team.summary.avgAdjustedMargin);
    });
    if (batchNum || results.success.length < allEntries.length) {
      const existing = await db.collection('nba_team_stats').get();
      existing.docs.forEach((d) => {
        const d2 = d.data();
        const name = d2?.teamName as string | undefined;
        const mov = d2?.summary?.avgAdjustedMargin as number | undefined;
        if (name != null && typeof mov === 'number' && !teamMOVMap.has(name)) {
          teamMOVMap.set(name, mov);
        }
      });
    }

    // Calculate Strength of Schedule (SOS) for scraped teams only
    console.log('\n📊 Calculating Strength of Schedule...');

    const teamsWithSOS = results.success.map((team) => {
      let totalOpponentMOV = 0;
      let opponentCount = 0;

      team.games.forEach((game) => {
        const opponentMOV = teamMOVMap.get(game.opponent);
        if (opponentMOV !== undefined) {
          totalOpponentMOV += opponentMOV;
          opponentCount++;
        }
      });

      const sos = opponentCount > 0 ? totalOpponentMOV / opponentCount : 0;
      const scheduleAdjustedMOV = team.summary.avgAdjustedMargin - sos;

      return {
        ...team,
        summary: {
          ...team.summary,
          sos,
          scheduleAdjustedMOV,
        },
      };
    });

    console.log('✅ SOS calculation complete');

    // Save to Firestore (only this batch when using batches)
    console.log('\n💾 Saving to Firestore...');

    const writeBatch = db.batch();

    teamsWithSOS.forEach((team) => {
      const teamRef = db.collection('nba_team_stats').doc(team.abbreviation);
      writeBatch.set(teamRef, {
        teamName: team.teamName,
        abbreviation: team.abbreviation,
        summary: team.summary,
        scheduleStats: team.scheduleStats,
        games: team.games,
        scrapedAt: team.scrapedAt,
        updatedAt: new Date().toISOString(),
      });
    });

    await writeBatch.commit();
    console.log(`✅ Saved ${teamsWithSOS.length} teams to Firestore`);

    return NextResponse.json({
      success: true,
      message: batchLabel
        ? `Synced ${results.success.length} of ${teams.length} teams (batch ${batchLabel})`
        : `Synced ${results.success.length} of ${teams.length} teams`,
      failedTeams: results.failed,
      totalTeams: teams.length,
      successCount: results.success.length,
      failedCount: results.failed.length,
      savedToFirestore: true,
      scheduleAnalysisComplete: true,
      batch: batchNum ?? undefined,
      batchLabel: batchLabel ?? undefined,
    });
  } catch (error: any) {
    console.error('❌ Sync error:', error);
    return NextResponse.json(
      {
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}