require('dotenv').config({ path: '.env.local' });

async function compare() {
  const oddsRes = await fetch(`https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?apiKey=${process.env.NEXT_PUBLIC_ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=american`);
  const oddsData = await oddsRes.json();
  const oddsNames = new Set();
  if (oddsData && oddsData.length > 0) {
    oddsData.forEach(game => {
      oddsNames.add(game.home_team);
      oddsNames.add(game.away_team);
    });
    console.log("Odds API Names:", Array.from(oddsNames).slice(0, 10));
  }
  
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  const espnRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateStr}&limit=100`);
  const espnData = await espnRes.json();
  const espnNames = new Set();
  if (espnData.events) {
    espnData.events.forEach(event => {
       const home = event.competitions[0].competitors.find(c => c.homeAway === 'home');
       const away = event.competitions[0].competitors.find(c => c.homeAway === 'away');
       espnNames.add(home.team.displayName);
       espnNames.add(away.team.displayName);
    });
    console.log("ESPN API Names:", Array.from(espnNames).slice(0, 10));
  }
}

compare();
