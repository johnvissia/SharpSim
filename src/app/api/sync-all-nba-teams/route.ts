// src/app/api/sync-all-nba-teams/route.ts
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
  const RETRY_DELAY = 5000; // Increased to 5 seconds
  
  try {
    console.log(`📥 Scraping ${teamName} (${abbreviation})...`);
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const seasonEndYear = currentMonth >= 7 ? currentYear + 1 : currentYear;

    const url = `https://www.basketball-reference.com/teams/${abbreviation}/${seasonEndYear}_games.html`;
    console.log(`   URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${teamName}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
      throw new Error(`Unexpected content type: ${contentType} for ${teamName}`);
    }

    const html = await response.text();
    
    // Check if we got an error page
    if (html.includes('Rate Limit') || html.includes('Too Many Requests') || html.includes('403 Forbidden')) {
      throw new Error(`Rate limited or blocked for ${teamName}`);
    }

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
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 Retrying ${teamName} (attempt ${retryCount + 1}/${MAX_RETRIES}) in ${RETRY_DELAY/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return scrapeTeam(teamName, abbreviation, retryCount + 1);
    }
    
    console.error(`💀 ${teamName} failed after ${MAX_RETRIES} retries`);
    return null;
  }
}

// ============================================================================
// MAIN SYNC FUNCTION
// ============================================================================

export async function POST() {
  try {
    console.log('🚀 Starting sync of all 30 NBA teams...');
    console.log('⏱️  Using 4-second delays to avoid rate limiting...');
    
    const teams = Object.entries(NBA_TEAMS);
    const results: { success: TeamData[], failed: string[] } = { success: [], failed: [] };

    // Scrape teams one by one with delay
    for (let i = 0; i < teams.length; i++) {
      const [teamName, abbreviation] = teams[i];
      
      console.log(`\n[${i + 1}/${teams.length}] Processing ${teamName}...`);
      
      const teamData = await scrapeTeam(teamName, abbreviation);
      
      if (teamData) {
        results.success.push(teamData);
      } else {
        results.failed.push(teamName);
      }

      // Delay between requests (4 seconds to avoid rate limiting)
      if (i < teams.length - 1) {
        console.log(`⏳ Waiting 4 seconds before next request...`);
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    }

    console.log(`\n🎉 Scrape complete: ${results.success.length}/30 success, ${results.failed.length} failed`);

    if (results.failed.length > 0) {
      console.log(`⚠️ Failed teams: ${results.failed.join(', ')}`);
    }

    // Calculate Strength of Schedule (SOS)
    console.log('\n📊 Calculating Strength of Schedule...');
    
    const teamMOVMap = new Map<string, number>();
    results.success.forEach(team => {
      teamMOVMap.set(team.teamName, team.summary.avgAdjustedMargin);
    });

    const teamsWithSOS = results.success.map(team => {
      let totalOpponentMOV = 0;
      let opponentCount = 0;

      team.games.forEach(game => {
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

    // Save to Firestore
    console.log('\n💾 Saving to Firestore...');
    
    const batch = db.batch();
    
    teamsWithSOS.forEach(team => {
      const teamRef = db.collection('nba_team_stats').doc(team.abbreviation);
      batch.set(teamRef, {
        teamName: team.teamName,
        abbreviation: team.abbreviation,
        summary: team.summary,
        scheduleStats: team.scheduleStats,
        games: team.games,
        scrapedAt: team.scrapedAt,
        updatedAt: new Date().toISOString(),
      });
    });

    await batch.commit();
    console.log(`✅ Saved ${teamsWithSOS.length} teams to Firestore`);

    return NextResponse.json({
      success: true,
      message: `Synced ${results.success.length} of ${teams.length} teams`,
      failedTeams: results.failed,
      totalTeams: teams.length,
      successCount: results.success.length,
      failedCount: results.failed.length,
      savedToFirestore: true,
      scheduleAnalysisComplete: true,
    });

  } catch (error: any) {
    console.error('❌ Sync error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}