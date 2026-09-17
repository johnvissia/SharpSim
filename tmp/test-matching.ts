import { initializeApp, cert } from 'firebase-admin/app';
require('dotenv').config({ path: '.env.local' });
import { getFirestore } from 'firebase-admin/firestore';
import { teamNameMap, normalizeTeamName } from '../src/lib/team-names';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

export const sportKeyMapping: { [key: string]: string } = {
    'NBA': 'basketball_nba',
    'NFL': 'americanfootball_nfl',
    'MLB': 'baseball_mlb',
    'NHL': 'icehockey_nhl',
    'Soccer': 'soccer_epl', // Example, can be other leagues
    'WNBA': 'basketball_wnba',
    'NCAAF': 'americanfootball_ncaaf',
    'NCAAM': 'basketball_ncaab',
};

export const sportNameMapping: { [key: string]: string } = Object.entries(sportKeyMapping).reduce((acc, [name, key]) => {
    acc[key] = name;
    return acc;
}, {} as { [key: string]: string });

async function check() {
  const espnRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?limit=100`);
  const espnData = await espnRes.json();
  const espnGames: any[] = [];
  if (espnData.events) {
    espnData.events.forEach((event: any) => {
       const home = event.competitions[0].competitors.find((c: any) => c.homeAway === 'home');
       const away = event.competitions[0].competitors.find((c: any) => c.homeAway === 'away');
       espnGames.push({
         sport: 'NBA',
         homeTeam: { name: home.team.displayName },
         awayTeam: { name: away.team.displayName }
       });
    });
  }

  const snapshot = await db.collection('daily_games').where('sportKey', 'in', ['basketball_nba', 'baseball_mlb']).get();
  const oddsGames = snapshot.docs.map(d => {
    const data = d.data();
    return {
      sport: sportNameMapping[data.sportKey],
      homeTeam: { name: data.homeTeam },
      awayTeam: { name: data.awayTeam }
    };
  });

  console.log("ESPN KEYS:");
  espnGames.forEach(g => {
    const key = `${g.sport}-${normalizeTeamName(g.homeTeam.name)}-${normalizeTeamName(g.awayTeam.name)}`;
    console.log("  " + key);
  });

  console.log("ODDS KEYS:");
  oddsGames.forEach(g => {
    const key = `${g.sport}-${normalizeTeamName(g.homeTeam.name)}-${normalizeTeamName(g.awayTeam.name)}`;
    console.log("  " + key);
  });
}

check();
