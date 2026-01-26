// src/app/api/scrape-bbref-team/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { fetchBbrefHtml } from '@/lib/bbref';

export const dynamic = 'force-dynamic';

interface TeamStats {
  teamName: string;
  abbreviation: string;
  wins: number;
  losses: number;
  pointsPerGame: number;
  opponentPointsPerGame: number;
  avgMargin: number;
  offensiveRating: number;
  defensiveRating: number;
  pace: number;
  effectiveFieldGoalPct: number;
  turnoverPct: number;
  offensiveReboundPct: number;
  freeThrowRate: number;
  scrapedAt: string;
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

    console.log(`🏀 Scraping Basketball Reference for ${teamName} (${abbreviation})...`);

    // Basketball Reference team page
    const url = `https://www.basketball-reference.com/teams/${abbreviation}/2025.html`;

    const html = await fetchBbrefHtml(url);
    const $ = cheerio.load(html);

    // Extract team stats from the page
    const teamStats: Partial<TeamStats> = {
      teamName,
      abbreviation,
      scrapedAt: new Date().toISOString(),
    };

    // Get record from the page
    const recordText = $('div.current_record p').first().text();
    const recordMatch = recordText.match(/(\d+)-(\d+)/);
    if (recordMatch) {
      teamStats.wins = parseInt(recordMatch[1]);
      teamStats.losses = parseInt(recordMatch[2]);
    }

    // Get per game stats from team_and_opponent table
    $('#team_and_opponent tbody tr').each((_, row) => {
      const $row = $(row);
      const statLabel = $row.find('th').text().trim();
      
      if (statLabel === 'Team') {
        const cells = $row.find('td');
        teamStats.pointsPerGame = parseFloat($(cells[3]).text()) || 0; // PTS column
      } else if (statLabel === 'Opponent') {
        const cells = $row.find('td');
        teamStats.opponentPointsPerGame = parseFloat($(cells[3]).text()) || 0;
      }
    });

    // Calculate average margin
    if (teamStats.pointsPerGame && teamStats.opponentPointsPerGame) {
      teamStats.avgMargin = teamStats.pointsPerGame - teamStats.opponentPointsPerGame;
    }

    // Get advanced stats from team_misc table
    $('#team_misc tbody tr').each((_, row) => {
      const $row = $(row);
      const statLabel = $row.find('th').text().trim();
      
      if (statLabel === 'Team') {
        const cells = $row.find('td');
        // These indices might need adjustment based on actual table structure
        teamStats.pace = parseFloat($(cells[0]).text()) || 0;
        teamStats.offensiveRating = parseFloat($(cells[1]).text()) || 0;
        teamStats.defensiveRating = parseFloat($(cells[2]).text()) || 0;
        teamStats.effectiveFieldGoalPct = parseFloat($(cells[7]).text()) || 0;
        teamStats.turnoverPct = parseFloat($(cells[8]).text()) || 0;
        teamStats.offensiveReboundPct = parseFloat($(cells[9]).text()) || 0;
        teamStats.freeThrowRate = parseFloat($(cells[10]).text()) || 0;
      }
    });

    console.log(`✅ Successfully scraped ${teamName} stats`);

    return NextResponse.json({
      success: true,
      stats: teamStats as TeamStats,
    });

  } catch (error: any) {
    console.error('❌ Scraping error:', error);
    return NextResponse.json({ 
      error: error.message,
      details: 'Failed to scrape Basketball Reference. The site may be down or structure changed.'
    }, { status: 500 });
  }
}