// src/app/api/scrape-team-games/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

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
  adjustedMargin: number; // Adjusted for home court
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

const HOME_COURT_ADVANTAGE = 2.5;

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

    // Determine current season year (Basketball Reference uses the END year)
    // NBA season runs Oct-Apr, so if it's before July, use current year, otherwise next year
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const seasonEndYear = currentMonth >= 7 ? currentYear + 1 : currentYear;

    // Basketball Reference schedule page
    const url = `https://www.basketball-reference.com/teams/${abbreviation}/${seasonEndYear}_games.html`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Basketball Reference returned ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const games: GameResult[] = [];
    let gameNumber = 0;

    // Parse the games table
    $('#games tbody tr').each((_, row) => {
      const $row = $(row);
      
      // Skip header rows
      if ($row.hasClass('thead')) {
        return;
      }
      
      // IMPORTANT: Only include games that have been played (have a result)
      const result = $row.find('td[data-stat="game_result"]').text().trim();
      if (!result || (result !== 'W' && result !== 'L')) {
        return; // Skip future games without results
      }

      gameNumber++;

      const date = $row.find('td[data-stat="date_game"]').text().trim();
      const locationSymbol = $row.find('td[data-stat="game_location"]').text().trim();
      const isHome = locationSymbol !== '@'; // @ means away game
      const opponent = $row.find('td[data-stat="opp_name"]').text().trim();
      const teamScore = parseInt($row.find('td[data-stat="pts"]').text()) || 0;
      const opponentScore = parseInt($row.find('td[data-stat="opp_pts"]').text()) || 0;

      // Double-check that both scores exist (another safeguard for completed games)
      if (!teamScore || !opponentScore) return;

      // Calculate margin (positive = win, negative = loss)
      const margin = teamScore - opponentScore;

      // Adjust for home court advantage (Formula #2)
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

    // Calculate basic stats
    const totalGames = games.length;
    const wins = games.filter(g => g.result === 'W').length;
    const losses = games.filter(g => g.result === 'L').length;
    
    // Formula #3: Average Adjusted Margin (MOV)
    const avgAdjustedMargin = totalGames > 0 
      ? games.reduce((sum, g) => sum + g.adjustedMargin, 0) / totalGames 
      : 0;

    // Home/Away splits (Formula #7)
    const homeGames = games.filter(g => g.isHome);
    const awayGames = games.filter(g => !g.isHome);
    
    const homeMOV = homeGames.length > 0
      ? homeGames.reduce((sum, g) => sum + g.adjustedMargin, 0) / homeGames.length
      : 0;
    
    const awayMOV = awayGames.length > 0
      ? awayGames.reduce((sum, g) => sum + g.adjustedMargin, 0) / awayGames.length
      : 0;
    
    const homeAwayDelta = homeMOV - awayMOV;

    // Formula #6: Rolling Margin (last 10 games, weighted)
    const recentGames = games.slice(-10);
    let rollingMOV = 0;
    if (recentGames.length > 0) {
      let totalWeight = 0;
      let weightedSum = 0;
      
      recentGames.forEach((game, idx) => {
        const weight = idx + 1; // More recent = higher weight
        weightedSum += game.adjustedMargin * weight;
        totalWeight += weight;
      });
      
      rollingMOV = weightedSum / totalWeight;
    }

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
      games,
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