// src/app/api/scrape-team-games/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { fetchBbrefHtml } from '@/lib/bbref';

export const dynamic = 'force-dynamic';

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

// Map team names to Basketball Reference abbreviations
const teamAbbreviations: Record<string, string> = {
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
  'LA Clippers': 'LAC',
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
  'Phoenix Suns': 'PHX',
  'Portland Trail Blazers': 'POR',
  'Sacramento Kings': 'SAC',
  'San Antonio Spurs': 'SAS',
  'Toronto Raptors': 'TOR',
  'Utah Jazz': 'UTA',
  'Washington Wizards': 'WAS',
};

const HOME_COURT_ADVANTAGE = 2.3; // Updated from 2.5 to 2.3

// ============================================================================
// SCHEDULE ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Calculate days of rest between two game dates
 */
function calculateDaysRest(currentGameDate: string, previousGameDate: string | null): number {
  if (!previousGameDate) return 99; // First game of season
  
  const current = new Date(currentGameDate);
  const previous = new Date(previousGameDate);
  
  const diffTime = current.getTime() - previous.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays - 1; // Same day = 0 days rest
}

/**
 * Count games in the last N days (including current game)
 */
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

/**
 * Add schedule fatigue analysis to all games
 */
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
// MAIN SCRAPER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teamName = searchParams.get('team');
    
    if (!teamName) {
      return NextResponse.json({ error: 'team parameter required' }, { status: 400 });
    }

    const abbreviation = teamAbbreviations[teamName];
    if (!abbreviation) {
      return NextResponse.json({ 
        error: 'Team not found',
        availableTeams: Object.keys(teamAbbreviations)
      }, { status: 400 });
    }

    console.log(`🏀 Scraping game results for ${teamName} (${abbreviation})...`);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const seasonEndYear = currentMonth >= 7 ? currentYear + 1 : currentYear;

    const url = `https://www.basketball-reference.com/teams/${abbreviation}/${seasonEndYear}_games.html`;

    const html = await fetchBbrefHtml(url);
    const $ = cheerio.load(html);

    const games: any[] = [];
    let gameNumber = 0;

    // Parse the games table
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
      const adjustedMargin = isHome 
        ? margin - HOME_COURT_ADVANTAGE 
        : margin + HOME_COURT_ADVANTAGE;

      games.push({
        gameNumber,
        date,
        isHome,
        opponent,
        result,
        teamScore,
        opponentScore,
        margin,
        adjustedMargin,
      });
    });

    console.log(`✅ Scraped ${games.length} games for ${teamName}`);

    // ========================================================================
    // ADD SCHEDULE FATIGUE ANALYSIS
    // ========================================================================
    const gamesWithSchedule = analyzeScheduleFatigue(games);

    // Calculate basic stats
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

    // ========================================================================
    // SCHEDULE STATISTICS
    // ========================================================================
    const backToBackGames = gamesWithSchedule.filter(g => g.isBackToBack).length;
    const threeInFourGames = gamesWithSchedule.filter(g => g.gamesInLast4Days >= 3).length;
    const deathScheduleGames = gamesWithSchedule.filter(g => g.gamesInLast5Days >= 4).length;
    const avgDaysRest = totalGames > 0
      ? gamesWithSchedule.reduce((sum, g) => sum + g.daysRest, 0) / totalGames
      : 0;

    return NextResponse.json({
      success: true,
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
    });

  } catch (error: any) {
    console.error('❌ Scraping error:', error);
    return NextResponse.json({ 
      error: error.message,
      details: 'Failed to scrape game results'
    }, { status: 500 });
  }
}