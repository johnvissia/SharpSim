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
  'Phoenix Suns': 'PHX',
  'Portland Trail Blazers': 'POR',
  'Sacramento Kings': 'SAC',
  'San Antonio Spurs': 'SAS',
  'Toronto Raptors': 'TOR',
  'Utah Jazz': 'UTA',
  'Washington Wizards': 'WAS',
};

const HOME_COURT_ADVANTAGE = 2.5;

async function scrapeTeam(teamName: string, abbreviation: string): Promise<TeamData | null> {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const seasonEndYear = currentMonth >= 7 ? currentYear + 1 : currentYear;

    const url = `https://www.basketball-reference.com/teams/${abbreviation}/${seasonEndYear}_games.html`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${teamName}: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const games: GameResult[] = [];
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

    const totalGames = games.length;
    const wins = games.filter(g => g.result === 'W').length;
    const losses = games.filter(g => g.result === 'L').length;
    
    const avgAdjustedMargin = totalGames > 0 
      ? games.reduce((sum, g) => sum + g.adjustedMargin, 0) / totalGames 
      : 0;

    const homeGames = games.filter(g => g.isHome);
    const awayGames = games.filter(g => !g.isHome);
    
    const homeMOV = homeGames.length > 0
      ? homeGames.reduce((sum, g) => sum + g.adjustedMargin, 0) / homeGames.length
      : 0;
    
    const awayMOV = awayGames.length > 0
      ? awayGames.reduce((sum, g) => sum + g.adjustedMargin, 0) / awayGames.length
      : 0;
    
    const homeAwayDelta = homeMOV - awayMOV;

    const recentGames = games.slice(-10);
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
      games,
      scrapedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error scraping ${teamName}:`, error);
    return null;
  }
}

export async function POST() {
  try {
    console.log('🚀 Starting sync of all NBA teams...');
    
    const teams = Object.entries(NBA_TEAMS);
    const results: { success: TeamData[], failed: string[] } = { success: [], failed: [] };

    // Scrape teams one by one with delay to avoid rate limiting
    for (const [teamName, abbreviation] of teams) {
      console.log(`📥 Scraping ${teamName}...`);
      
      const teamData = await scrapeTeam(teamName, abbreviation);
      
      if (teamData) {
        results.success.push(teamData);
        console.log(`✅ ${teamName}: ${teamData.summary.totalGames} games`);
      } else {
        results.failed.push(teamName);
        console.log(`❌ ${teamName}: Failed`);
      }

      // Delay between requests to be polite to Basketball Reference
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    console.log(`\n🎉 Scrape complete: ${results.success.length} success, ${results.failed.length} failed`);

    // Calculate Strength of Schedule (SOS) for each team
    console.log('\n📊 Calculating Strength of Schedule...');
    
    // Create a map of team name to MOV for quick lookup
    const teamMOVMap = new Map<string, number>();
    results.success.forEach(team => {
      teamMOVMap.set(team.teamName, team.summary.avgAdjustedMargin);
    });

    // Calculate SOS for each team
    const teamsWithSOS = results.success.map(team => {
      let totalOpponentMOV = 0;
      let opponentCount = 0;

      // Sum up the MOV of all opponents
      team.games.forEach(game => {
        const opponentMOV = teamMOVMap.get(game.opponent);
        if (opponentMOV !== undefined) {
          totalOpponentMOV += opponentMOV;
          opponentCount++;
        }
      });

      const sos = opponentCount > 0 ? totalOpponentMOV / opponentCount : 0;
      
      // Schedule-Adjusted MOV (Formula #5)
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

    // Save all teams to Firestore
    console.log('\n💾 Saving to Firestore...');
    
    const batch = db.batch();
    
    teamsWithSOS.forEach(team => {
      const teamRef = db.collection('nba_team_stats').doc(team.abbreviation);
      batch.set(teamRef, {
        teamName: team.teamName,
        abbreviation: team.abbreviation,
        summary: team.summary,
        games: team.games,
        scrapedAt: team.scrapedAt,
        updatedAt: new Date().toISOString(),
      });
    });

    await batch.commit();
    console.log(`✅ Saved ${teamsWithSOS.length} teams to Firestore`);

    return NextResponse.json({
      success: true,
      message: `Synced ${results.success.length} of ${teams.length} teams and saved to Firestore`,
      failedTeams: results.failed,
      totalTeams: teams.length,
      successCount: results.success.length,
      failedCount: results.failed.length,
      savedToFirestore: true,
    });

  } catch (error: any) {
    console.error('❌ Sync error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}