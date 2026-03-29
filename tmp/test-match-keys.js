require('dotenv').config({ path: '.env.local' });

// We define normalizeTeamName exactly as in team-names.ts to avoid imports
const mascots = [
    'Spartans', 'Rebels', 'Wolfpack', 'Huskies', 'Minutemen', 'Trojans', 'Tigers', 'Knights',
    'Cougars', 'Mustangs', 'Horned Frogs', 'Blazers', 'Miners', 'Roadrunners', 'Rams',
    'Panthers', 'Demon Deacons', 'Tar Heels', 'Blue Devils', 'Wildcats', 'Jayhawks',
    'Boilermakers', 'Volunteers', 'Golden Eagles', 'Cyclones', 'Bluejays', 'Bears',
    'Bulldogs', 'Fighting Illini', 'Crimson Tide', 'Gamecocks', 'Gators', 'Badgers',
    'Longhorns', 'Red Raiders', 'Aztecs', 'Aggies', 'Wolf Pack', 'Broncos', 'Lobos',
    'Orange', 'Cavaliers', 'Seminoles', 'Eagles', 'Yellow Jackets', 'Cardinals',
    'Fighting Irish', 'Mountaineers', 'Sun Devils', 'Hokies', 'Ducks', 'Beavers',
    'Buffaloes', 'Gophers', 'Utes', 'Sooners', 'Cowboys', 'Cornhuskers', 'Hoosiers',
    'Nittany Lions', 'Buckeyes', 'Wolverines', 'Bruins', 'Commodores', 'Razorbacks',
    'Warriors', 'Gaels', 'Bulls', 'Dons', 'Waves', 'Titans', 'Matadors', 'Highlanders',
    'Antelopes', 'Lumberjacks', 'Wildcats', 'Colonels', 'Governors', 'Bisons', 'Owls',
    'Hatters', 'Dolphins', 'Ospreys', 'Eagles', 'Lions', 'Dragons', 'Blue Hens', 'Phoenix',
    'Cougars', 'Hawks', 'Pirates', 'Monarchs', 'Dukes', 'Miners', 'Broncos', 'Aggies',
    'Roadrunners', 'Blazers', 'Owls', 'Mean Green', 'Owls', 'Mustangs', 'Shockers',
    'Bulls', 'Green Wave', 'Golden Hurricane', 'Pirates', '49ers', 'Owls', 'Bulldogs',
    'Crusaders', 'Raiders', 'Leopards', 'Bison', 'Mountain Hawks', 'Mids', 'Black Knights',
    'Terriers', 'Greyhounds', 'Red Foxes', 'Peacocks', 'Monmouth', 'Stags', 'Broncos',
    'Bears', 'Tigers', 'Quakers', 'Crimson', 'Big Red', 'Bulldogs', 'Lions', 'Big Green',
    'Hurricanes', 'Blue Jackets', 'Devils', 'Islanders', 'Rangers', 'Flyers', 'Penguins',
    'Capitals', 'Predators', 'Stars', 'Blues', 'Golden Knights', 'Kings', 'Ducks', 'Sharks',
    'Kraken', 'Oilers', 'Flames', 'Canucks', 'Jets', 'Maple Leafs', 'Senators', 'Canadiens'
];

const teamNameMap = {
    'Montréal Canadiens': 'Montreal Canadiens',
    'St Louis Blues': 'St. Louis Blues',
    'Vegas Golden Knights': 'Vegas Golden Knights',
    'Atlanta Hawks': 'Atlanta Hawks',
    'Boston Celtics': 'Boston Celtics',
    'Brooklyn Nets': 'Brooklyn Nets',
    'Charlotte Hornets': 'Charlotte Hornets',
    'Chicago Bulls': 'Chicago Bulls',
    'Cleveland Cavaliers': 'Cleveland Cavaliers',
    'Dallas Mavericks': 'Dallas Mavericks',
    'Denver Nuggets': 'Denver Nuggets',
    'Detroit Pistons': 'Detroit Pistons',
    'Golden State Warriors': 'Golden State Warriors',
    'Houston Rockets': 'Houston Rockets',
    'Indiana Pacers': 'Indiana Pacers',
    'LA Clippers': 'Los Angeles Clippers',
    'Clippers': 'Los Angeles Clippers',
    'Los Angeles Clippers': 'Los Angeles Clippers',
    'Los Angeles Lakers': 'Los Angeles Lakers',
    'Lakers': 'Los Angeles Lakers',
    'Memphis Grizzlies': 'Memphis Grizzlies',
    'Miami Heat': 'Miami Heat',
    'Milwaukee Bucks': 'Milwaukee Bucks',
    'Minnesota Timberwolves': 'Minnesota Timberwolves',
    'New Orleans Pelicans': 'New Orleans Pelicans',
    'New York Knicks': 'New York Knicks',
    'Knicks': 'New York Knicks',
    'Oklahoma City Thunder': 'Oklahoma City Thunder',
    'Thunder': 'Oklahoma City Thunder',
    'Orlando Magic': 'Orlando Magic',
    'Philadelphia 76ers': 'Philadelphia 76ers',
    '76ers': 'Philadelphia 76ers',
    'Sixers': 'Philadelphia 76ers',
    'Phoenix Suns': 'Phoenix Suns',
    'Portland Trail Blazers': 'Portland Trail Blazers',
    'Sacramento Kings': 'Sacramento Kings',
    'Kings': 'Sacramento Kings',
    'San Antonio Spurs': 'San Antonio Spurs',
    'Spurs': 'San Antonio Spurs',
    'Toronto Raptors': 'Toronto Raptors',
    'Utah Jazz': 'Utah Jazz',
    'Washington Wizards': 'Washington Wizards',
};

function normalizeTeamName(name) {
    if (!name) return '';
    let processed = name.trim();
    if (teamNameMap[processed]) return teamNameMap[processed];
    processed = processed.replace(/'s\b/g, '').replace(/'/g, '');
    if (/^St\.?\s/i.test(processed) || /^Saint\s/i.test(processed)) processed = processed.replace(/^(St\.?|Saint)\s/i, 'St. ');
    if (/\s(St\.?|State)$/i.test(processed)) processed = processed.replace(/\s(St\.?|State)$/i, ' State');
    for (let i = 0; i < 2; i++) {
        for (const mascot of mascots) {
            const regex = new RegExp(`\\s+${mascot}$`, 'i');
            if (regex.test(processed)) {
                processed = processed.replace(regex, '').trim();
            }
        }
    }
    processed = processed.replace(/\bMiss\b\.?/g, 'Mississippi')
        .replace(/\bInt'l\b/g, 'International')
        .replace(/\bUniv\b\.?/g, 'University')
        .replace(/\bTenn\b\.?/g, 'Tennessee')
        .replace(/\bMich\b\.?/g, 'Michigan')
        .replace(/\bWisc\b\.?/g, 'Wisconsin')
        .replace(/\bIll\b\.?/g, 'Illinois')
        .replace(/\bPenn\b\.?/g, 'Pennsylvania');
    if (processed === 'St Louis') return 'St. Louis Blues';
    if (processed === 'St. Louis') return 'St. Louis Blues';
    return processed;
}

async function run() {
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  
  // NBA
  const nbaOddsRes = await fetch(`https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${process.env.NEXT_PUBLIC_ODDS_API_KEY}&regions=us&markets=h2h`);
  const nbaOdds = await nbaOddsRes.json();
  const nbaEspnRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`);
  const nbaEspn = await nbaEspnRes.json();
  
  console.log("=== NBA ODDS KEYS ===");
  if (Array.isArray(nbaOdds)) {
     nbaOdds.forEach(g => {
        console.log(`NBA-${normalizeTeamName(g.home_team)}-${normalizeTeamName(g.away_team)}`);
     });
  }
  console.log("=== NBA ESPN KEYS ===");
  if (nbaEspn.events) {
     nbaEspn.events.forEach(e => {
        const home = e.competitions[0].competitors.find(c => c.homeAway === 'home').team.displayName;
        const away = e.competitions[0].competitors.find(c => c.homeAway === 'away').team.displayName;
        console.log(`NBA-${normalizeTeamName(home)}-${normalizeTeamName(away)}`);
     });
  }

  // MLB
  const mlbOddsRes = await fetch(`https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?apiKey=${process.env.NEXT_PUBLIC_ODDS_API_KEY}&regions=us&markets=h2h`);
  const mlbOdds = await mlbOddsRes.json();
  const mlbEspnRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateStr}`);
  const mlbEspn = await mlbEspnRes.json();
  
  console.log("=== MLB ODDS KEYS ===");
  if (Array.isArray(mlbOdds)) {
     mlbOdds.forEach(g => {
        console.log(`MLB-${normalizeTeamName(g.home_team)}-${normalizeTeamName(g.away_team)}`);
     });
  }
  console.log("=== MLB ESPN KEYS ===");
  if (mlbEspn.events) {
     mlbEspn.events.forEach(e => {
        const home = e.competitions[0].competitors.find(c => c.homeAway === 'home').team.displayName;
        const away = e.competitions[0].competitors.find(c => c.homeAway === 'away').team.displayName;
        console.log(`MLB-${normalizeTeamName(home)}-${normalizeTeamName(away)}`);
     });
  }
}
run();
