export const nbaTeamAbbreviationToName: Record<string, string> = {
  'ATL': 'Atlanta Hawks',
  'BOS': 'Boston Celtics',
  'BKN': 'Brooklyn Nets',
  'CHA': 'Charlotte Hornets',
  'CHI': 'Chicago Bulls',
  'CLE': 'Cleveland Cavaliers',
  'DAL': 'Dallas Mavericks',
  'DEN': 'Denver Nuggets',
  'DET': 'Detroit Pistons',
  'GSW': 'Golden State Warriors',
  'HOU': 'Houston Rockets',
  'IND': 'Indiana Pacers',
  'LAC': 'Los Angeles Clippers',
  'LAL': 'Los Angeles Lakers',
  'MEM': 'Memphis Grizzlies',
  'MIA': 'Miami Heat',
  'MIL': 'Milwaukee Bucks',
  'MIN': 'Minnesota Timberwolves',
  'NOP': 'New Orleans Pelicans',
  'NYK': 'New York Knicks',
  'OKC': 'Oklahoma City Thunder',
  'ORL': 'Orlando Magic',
  'PHI': 'Philadelphia 76ers',
  'PHX': 'Phoenix Suns',
  'POR': 'Portland Trail Blazers',
  'SAC': 'Sacramento Kings',
  'SAS': 'San Antonio Spurs',
  'TOR': 'Toronto Raptors',
  'UTA': 'Utah Jazz',
  'WAS': 'Washington Wizards',
};

export const nbaTeamNameToAbbreviation: Record<string, string> = Object.fromEntries(
  Object.entries(nbaTeamAbbreviationToName).map(([abbr, name]) => [name, abbr])
);

// Maps prop types from Tank01 to a simpler format
export const mapTank01MarketToApp = (propType: string): string | null => {
  const map: Record<string, string> = {
    'player_points_over_under': 'pts',
    'player_rebounds_over_under': 'reb',
    'player_assists_over_under': 'ast',
    'player_threes_over_under': '3pt',
    'player_blocks_over_under': 'blk',
    'player_steals_over_under': 'stl',
    'player_blocks_steals_over_under': 'blk+stl',
    'player_points_rebounds_assists_over_under': 'pts+reb+ast',
  };
  return map[propType.toLowerCase()] || null;
};

// Normalize ESPN's sometimes weird abbreviations to standard
export const normalizeESPNTeamAbbreviation = (abbr: string): string => {
  if (!abbr) return '';
  const map: Record<string, string> = {
    'GS': 'GSW',
    'SA': 'SAS',
    'NY': 'NYK',
    'WSH': 'WAS',
    'NO': 'NOP',
    'UTAH': 'UTA',
    'PHO': 'PHX',
    'CHO': 'CHA',
    'NOP': 'NOP', // Ensure mapping
  };
  return map[abbr.toUpperCase()] || abbr.toUpperCase();
};
