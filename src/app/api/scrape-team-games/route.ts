// src/app/api/scrape-team-games/route.ts
import { NextRequest, NextResponse } from 'next/server';

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

// Map team names to ESPN Team IDs
// Derived from ESPN API teams list
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
  'Los Angeles Clippers': '12', // Handle potential name variations
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

const HOME_COURT_ADVANTAGE = 2.3;

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
// MAIN SCRAPER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teamName = searchParams.get('team');

    if (!teamName) {
      return NextResponse.json({ error: 'team parameter required' }, { status: 400 });
    }

    const teamId = espnTeamIds[teamName];
    if (!teamId) {
      return NextResponse.json({
        error: 'Team not found',
        availableTeams: Object.keys(espnTeamIds)
      }, { status: 400 });
    }

    console.log(`🏀 Fetching games via ESPN API for ${teamName} (ID: ${teamId})...`);

    // Fetch schedule from ESPN
    // Usage: https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{id}/schedule
    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/schedule`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`ESPN API returned status: ${response.status}`);
    }

    const data = await response.json();
    const events = data.events || [];

    let gameNumber = 0;
    const games: any[] = [];

    // Iterate through events and transform to GameResult
    for (const event of events) {
      const competition = event.competitions?.[0];
      if (!competition) continue;

      // Check status at event level OR competition level
      const statusName = event.status?.type?.name || competition.status?.type?.name;

      // Skip future games where status suggests it hasn't happened
      if (statusName !== 'STATUS_FINAL') continue;

      // Find the competitors
      const teamCompetitor = competition.competitors.find((c: any) => c.id === teamId);
      const opponentCompetitor = competition.competitors.find((c: any) => c.id !== teamId);

      if (!teamCompetitor || !opponentCompetitor) continue;

      gameNumber++;
      const date = event.date; // ISO string
      const isHome = teamCompetitor.homeAway === 'home';
      const opponent = opponentCompetitor.team.abbreviation; // e.g. "NYK"

      const teamScore = parseInt(teamCompetitor.score?.value || '0');
      const opponentScore = parseInt(opponentCompetitor.score?.value || '0');

      // Determine result (W/L)
      // Check 'winner' boolean flag first
      let result: 'W' | 'L' | null = null;
      if (teamCompetitor.winner === true) result = 'W';
      else if (teamCompetitor.winner === false) result = 'L';
      else {
        // Fallback to score comparison if winner flag missing
        if (teamScore > opponentScore) result = 'W';
        else if (teamScore < opponentScore) result = 'L';
        else result = null; // Tie or error
      }

      if (!result) continue; // Should effectively always have a result for Final games

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
        // Will be calculated in analyzeScheduleFatigue
        daysRest: 0,
        isBackToBack: false,
        gamesInLast4Days: 0,
        gamesInLast5Days: 0,
      });
    }

    // Sort by date ascending to ensure schedule stats are correct
    games.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Re-assign game numbers after sort
    games.forEach((g, i) => g.gameNumber = i + 1);

    console.log(`✅ Fetched ${games.length} completed games for ${teamName} from ESPN`);

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
      abbreviation: data.team?.abbreviation || 'N/A',
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
    console.error('❌ ESPN Fetch error:', error);
    return NextResponse.json({
      error: error.message,
      details: 'Failed to fetch game results from ESPN'
    }, { status: 500 });
  }
}