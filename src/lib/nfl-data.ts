/**
 * NFL Team Data, Stadium Context, and Statistical Baseline Mappings
 * Used by SharpSim NFL Predictive Simulation Model
 */

export interface NFLTeamInfo {
  id: string; // ESPN ID
  abbreviation: string;
  name: string; // Full Display Name (e.g. "Detroit Lions")
  city: string;
  mascot: string;
  conference: 'AFC' | 'NFC';
  division: 'North' | 'South' | 'East' | 'West';
  stadium: {
    name: string;
    city: string;
    state: string;
    isDome: boolean; // Dome or retractable roof
    surface: 'grass' | 'turf';
    elevationMeters: number; // e.g. Denver = 1609m
    latitude: number;
    longitude: number;
    timezone: string; // e.g. 'America/New_York'
  };
  startingQB: {
    name: string;
    tier: 1 | 2 | 3 | 4;
    rating: number; // Value in points above replacement (Tier 1: 6.5 - 7.5)
  };
  backupQB: {
    name: string;
    rating: number; // Baseline rating
  };
  qbDowngradePenalty: number; // Point spread downgrade if starting QB is out
  baseEPA: {
    passOffEPA: number; // Rolling opponent-adjusted EPA/pass
    rushOffEPA: number; // Rolling opponent-adjusted EPA/rush
    passDefEPA: number; // Opponent-adjusted EPA/pass allowed (negative is good)
    rushDefEPA: number; // Opponent-adjusted EPA/rush allowed (negative is good)
    successRate: number; // % of plays with positive EPA (0.40 - 0.52)
    neutralPassRate: number; // % pass in neutral game script
    paceSecondsPerPlay: number; // Neutral seconds per play
  };
}

export const NFL_TEAMS: Record<string, NFLTeamInfo> = {
  'ARI': {
    id: '22',
    abbreviation: 'ARI',
    name: 'Arizona Cardinals',
    city: 'Arizona',
    mascot: 'Cardinals',
    conference: 'NFC',
    division: 'West',
    stadium: {
      name: 'State Farm Stadium',
      city: 'Glendale',
      state: 'AZ',
      isDome: true,
      surface: 'grass',
      elevationMeters: 351,
      latitude: 33.5276,
      longitude: -112.2626,
      timezone: 'America/Phoenix'
    },
    startingQB: { name: 'Kyler Murray', tier: 3, rating: 3.8 },
    backupQB: { name: 'Clayton Tune', rating: 0.0 },
    qbDowngradePenalty: 3.8,
    baseEPA: {
      passOffEPA: 0.06,
      rushOffEPA: 0.04,
      passDefEPA: 0.09,
      rushDefEPA: 0.02,
      successRate: 0.442,
      neutralPassRate: 0.54,
      paceSecondsPerPlay: 27.2
    }
  },
  'ATL': {
    id: '1',
    abbreviation: 'ATL',
    name: 'Atlanta Falcons',
    city: 'Atlanta',
    mascot: 'Falcons',
    conference: 'NFC',
    division: 'South',
    stadium: {
      name: 'Mercedes-Benz Stadium',
      city: 'Atlanta',
      state: 'GA',
      isDome: true,
      surface: 'turf',
      elevationMeters: 320,
      latitude: 33.7554,
      longitude: -84.4008,
      timezone: 'America/New_York'
    },
    startingQB: { name: 'Kirk Cousins', tier: 3, rating: 3.9 },
    backupQB: { name: 'Michael Penix Jr.', rating: 0.8 },
    qbDowngradePenalty: 3.1,
    baseEPA: {
      passOffEPA: 0.09,
      rushOffEPA: -0.01,
      passDefEPA: 0.05,
      rushDefEPA: 0.01,
      successRate: 0.450,
      neutralPassRate: 0.57,
      paceSecondsPerPlay: 27.6
    }
  },
  'BAL': {
    id: '33',
    abbreviation: 'BAL',
    name: 'Baltimore Ravens',
    city: 'Baltimore',
    mascot: 'Ravens',
    conference: 'AFC',
    division: 'North',
    stadium: {
      name: 'M&T Bank Stadium',
      city: 'Baltimore',
      state: 'MD',
      isDome: false,
      surface: 'grass',
      elevationMeters: 10,
      latitude: 39.2780,
      longitude: -76.6227,
      timezone: 'America/New_York'
    },
    startingQB: { name: 'Lamar Jackson', tier: 1, rating: 7.2 },
    backupQB: { name: 'Josh Johnson', rating: 0.0 },
    qbDowngradePenalty: 7.2,
    baseEPA: {
      passOffEPA: 0.22,
      rushOffEPA: 0.14,
      passDefEPA: 0.04,
      rushDefEPA: -0.15,
      successRate: 0.505,
      neutralPassRate: 0.49,
      paceSecondsPerPlay: 28.5
    }
  },
  'BUF': {
    id: '2',
    abbreviation: 'BUF',
    name: 'Buffalo Bills',
    city: 'Buffalo',
    mascot: 'Bills',
    conference: 'AFC',
    division: 'East',
    stadium: {
      name: 'Highmark Stadium',
      city: 'Orchard Park',
      state: 'NY',
      isDome: false,
      surface: 'turf',
      elevationMeters: 250,
      latitude: 42.7738,
      longitude: -78.7870,
      timezone: 'America/New_York'
    },
    startingQB: { name: 'Josh Allen', tier: 1, rating: 7.4 },
    backupQB: { name: 'Mitchell Trubisky', rating: 0.2 },
    qbDowngradePenalty: 7.2,
    baseEPA: {
      passOffEPA: 0.20,
      rushOffEPA: 0.08,
      passDefEPA: -0.02,
      rushDefEPA: 0.01,
      successRate: 0.492,
      neutralPassRate: 0.55,
      paceSecondsPerPlay: 27.1
    }
  },
  'CAR': {
    id: '29',
    abbreviation: 'CAR',
    name: 'Carolina Panthers',
    city: 'Carolina',
    mascot: 'Panthers',
    conference: 'NFC',
    division: 'South',
    stadium: {
      name: 'Bank of America Stadium',
      city: 'Charlotte',
      state: 'NC',
      isDome: false,
      surface: 'turf',
      elevationMeters: 220,
      latitude: 35.2258,
      longitude: -80.8528,
      timezone: 'America/New_York'
    },
    startingQB: { name: 'Andy Dalton', tier: 4, rating: 2.2 },
    backupQB: { name: 'Bryce Young', rating: 0.4 },
    qbDowngradePenalty: 1.8,
    baseEPA: {
      passOffEPA: -0.12,
      rushOffEPA: -0.06,
      passDefEPA: 0.16,
      rushDefEPA: 0.11,
      successRate: 0.388,
      neutralPassRate: 0.58,
      paceSecondsPerPlay: 26.8
    }
  },
  'CHI': {
    id: '3',
    abbreviation: 'CHI',
    name: 'Chicago Bears',
    city: 'Chicago',
    mascot: 'Bears',
    conference: 'NFC',
    division: 'North',
    stadium: {
      name: 'Soldier Field',
      city: 'Chicago',
      state: 'IL',
      isDome: false,
      surface: 'grass',
      elevationMeters: 181,
      latitude: 41.8623,
      longitude: -87.6167,
      timezone: 'America/Chicago'
    },
    startingQB: { name: 'Caleb Williams', tier: 3, rating: 3.5 },
    backupQB: { name: 'Tyson Bagent', rating: 0.5 },
    qbDowngradePenalty: 3.0,
    baseEPA: {
      passOffEPA: 0.02,
      rushOffEPA: -0.04,
      passDefEPA: -0.09,
      rushDefEPA: -0.03,
      successRate: 0.435,
      neutralPassRate: 0.56,
      paceSecondsPerPlay: 27.0
    }
  },
  'CIN': {
    id: '4',
    abbreviation: 'CIN',
    name: 'Cincinnati Bengals',
    city: 'Cincinnati',
    mascot: 'Bengals',
    conference: 'AFC',
    division: 'North',
    stadium: {
      name: 'Paycor Stadium',
      city: 'Cincinnati',
      state: 'OH',
      isDome: false,
      surface: 'turf',
      elevationMeters: 152,
      latitude: 39.0955,
      longitude: -84.5161,
      timezone: 'America/New_York'
    },
    startingQB: { name: 'Joe Burrow', tier: 1, rating: 6.8 },
    backupQB: { name: 'Jake Browning', rating: 1.2 },
    qbDowngradePenalty: 5.6,
    baseEPA: {
      passOffEPA: 0.18,
      rushOffEPA: 0.01,
      passDefEPA: 0.08,
      rushDefEPA: 0.04,
      successRate: 0.478,
      neutralPassRate: 0.62,
      paceSecondsPerPlay: 26.4
    }
  },
  'CLE': {
    id: '5',
    abbreviation: 'CLE',
    name: 'Cleveland Browns',
    city: 'Cleveland',
    mascot: 'Browns',
    conference: 'AFC',
    division: 'North',
    stadium: {
      name: 'Huntington Bank Field',
      city: 'Cleveland',
      state: 'OH',
      isDome: false,
      surface: 'grass',
      elevationMeters: 189,
      latitude: 41.5061,
      longitude: -81.6995,
      timezone: 'America/New_York'
    },
    startingQB: { name: 'Deshaun Watson', tier: 4, rating: 2.1 },
    backupQB: { name: 'Jameis Winston', rating: 1.8 },
    qbDowngradePenalty: 0.5,
    baseEPA: {
      passOffEPA: -0.16,
      rushOffEPA: -0.08,
      passDefEPA: 0.02,
      rushDefEPA: -0.04,
      successRate: 0.392,
      neutralPassRate: 0.59,
      paceSecondsPerPlay: 26.2
    }
  },
  'DAL': {
    id: '6',
    abbreviation: 'DAL',
    name: 'Dallas Cowboys',
    city: 'Dallas',
    mascot: 'Cowboys',
    conference: 'NFC',
    division: 'East',
    stadium: {
      name: 'AT&T Stadium',
      city: 'Arlington',
      state: 'TX',
      isDome: true,
      surface: 'turf',
      elevationMeters: 180,
      latitude: 32.7473,
      longitude: -97.0945,
      timezone: 'America/Chicago'
    },
    startingQB: { name: 'Dak Prescott', tier: 2, rating: 5.4 },
    backupQB: { name: 'Cooper Rush', rating: 1.0 },
    qbDowngradePenalty: 4.4,
    baseEPA: {
      passOffEPA: 0.08,
      rushOffEPA: -0.09,
      passDefEPA: 0.06,
      rushDefEPA: 0.08,
      successRate: 0.440,
      neutralPassRate: 0.63,
      paceSecondsPerPlay: 25.8
    }
  },
  'DEN': {
    id: '7',
    abbreviation: 'DEN',
    name: 'Denver Broncos',
    city: 'Denver',
    mascot: 'Broncos',
    conference: 'AFC',
    division: 'West',
    stadium: {
      name: 'Empower Field at Mile High',
      city: 'Denver',
      state: 'CO',
      isDome: false,
      surface: 'grass',
      elevationMeters: 1609,
      latitude: 39.7439,
      longitude: -105.0201,
      timezone: 'America/Denver'
    },
    startingQB: { name: 'Bo Nix', tier: 4, rating: 2.6 },
    backupQB: { name: 'Jarrett Stidham', rating: 0.8 },
    qbDowngradePenalty: 1.8,
    baseEPA: {
      passOffEPA: -0.04,
      rushOffEPA: -0.02,
      passDefEPA: -0.12,
      rushDefEPA: -0.06,
      successRate: 0.428,
      neutralPassRate: 0.55,
      paceSecondsPerPlay: 27.5
    }
  },
  'DET': {
    id: '8',
    abbreviation: 'DET',
    name: 'Detroit Lions',
    city: 'Detroit',
    mascot: 'Lions',
    conference: 'NFC',
    division: 'North',
    stadium: {
      name: 'Ford Field',
      city: 'Detroit',
      state: 'MI',
      isDome: true,
      surface: 'turf',
      elevationMeters: 183,
      latitude: 42.3400,
      longitude: -83.0456,
      timezone: 'America/New_York'
    },
    startingQB: { name: 'Jared Goff', tier: 2, rating: 5.8 },
    backupQB: { name: 'Hendon Hooker', rating: 0.4 },
    qbDowngradePenalty: 5.4,
    baseEPA: {
      passOffEPA: 0.24,
      rushOffEPA: 0.12,
      passDefEPA: -0.04,
      rushDefEPA: -0.10,
      successRate: 0.518,
      neutralPassRate: 0.51,
      paceSecondsPerPlay: 27.9
    }
  },
  'GB': {
    id: '9',
    abbreviation: 'GB',
    name: 'Green Bay Packers',
    city: 'Green Bay',
    mascot: 'Packers',
    conference: 'NFC',
    division: 'North',
    stadium: {
      name: 'Lambeau Field',
      city: 'Green Bay',
      state: 'WI',
      isDome: false,
      surface: 'grass',
      elevationMeters: 195,
      latitude: 44.5013,
      longitude: -88.0622,
      timezone: 'America/Chicago'
    },
    startingQB: { name: 'Jordan Love', tier: 2, rating: 5.2 },
    backupQB: { name: 'Malik Willis', rating: 1.5 },
    qbDowngradePenalty: 3.7,
    baseEPA: {
      passOffEPA: 0.16,
      rushOffEPA: 0.08,
      passDefEPA: 0.00,
      rushDefEPA: -0.02,
      successRate: 0.475,
      neutralPassRate: 0.53,
      paceSecondsPerPlay: 27.3
    }
  },
  'HOU': {
    id: '34',
    abbreviation: 'HOU',
    name: 'Houston Texans',
    city: 'Houston',
    mascot: 'Texans',
    conference: 'AFC',
    division: 'South',
    stadium: {
      name: 'NRG Stadium',
      city: 'Houston',
      state: 'TX',
      isDome: true,
      surface: 'turf',
      elevationMeters: 16,
      latitude: 29.6847,
      longitude: -95.4107,
      timezone: 'America/Chicago'
    },
    startingQB: { name: 'C.J. Stroud', tier: 2, rating: 5.7 },
    backupQB: { name: 'Davis Mills', rating: 1.0 },
    qbDowngradePenalty: 4.7,
    baseEPA: {
      passOffEPA: 0.14,
      rushOffEPA: -0.02,
      passDefEPA: -0.08,
      rushDefEPA: -0.05,
      successRate: 0.468,
      neutralPassRate: 0.58,
      paceSecondsPerPlay: 27.0
    }
  },
  'IND': {
    id: '11',
    abbreviation: 'IND',
    name: 'Indianapolis Colts',
    city: 'Indianapolis',
    mascot: 'Colts',
    conference: 'AFC',
    division: 'South',
    stadium: {
      name: 'Lucas Oil Stadium',
      city: 'Indianapolis',
      state: 'IN',
      isDome: true,
      surface: 'turf',
      elevationMeters: 216,
      latitude: 39.7601,
      longitude: -86.1639,
      timezone: 'America/New_York'
    },
    startingQB: { name: 'Anthony Richardson', tier: 3, rating: 3.6 },
    backupQB: { name: 'Joe Flacco', rating: 2.8 },
    qbDowngradePenalty: 0.8,
    baseEPA: {
      passOffEPA: 0.04,
      rushOffEPA: 0.06,
      passDefEPA: 0.07,
      rushDefEPA: 0.05,
      successRate: 0.445,
      neutralPassRate: 0.52,
      paceSecondsPerPlay: 25.5
    }
  },
  'JAX': {
    id: '30',
    abbreviation: 'JAX',
    name: 'Jacksonville Jaguars',
    city: 'Jacksonville',
    mascot: 'Jaguars',
    conference: 'AFC',
    division: 'South',
    stadium: {
      name: 'EverBank Stadium',
      city: 'Jacksonville',
      state: 'FL',
      isDome: false,
      surface: 'grass',
      elevationMeters: 3,
      latitude: 30.3239,
      longitude: -81.6373,
      timezone: 'America/New_York'
    },
    startingQB: { name: 'Trevor Lawrence', tier: 3, rating: 4.2 },
    backupQB: { name: 'Mac Jones', rating: 1.2 },
    qbDowngradePenalty: 3.0,
    baseEPA: {
      passOffEPA: 0.05,
      rushOffEPA: 0.01,
      passDefEPA: 0.14,
      rushDefEPA: 0.02,
      successRate: 0.440,
      neutralPassRate: 0.59,
      paceSecondsPerPlay: 26.5
    }
  },
  'KC': {
    id: '12',
    abbreviation: 'KC',
    name: 'Kansas City Chiefs',
    city: 'Kansas City',
    mascot: 'Chiefs',
    conference: 'AFC',
    division: 'West',
    stadium: {
      name: 'GEHA Field at Arrowhead Stadium',
      city: 'Kansas City',
      state: 'MO',
      isDome: false,
      surface: 'grass',
      elevationMeters: 264,
      latitude: 39.0489,
      longitude: -94.4839,
      timezone: 'America/Chicago'
    },
    startingQB: { name: 'Patrick Mahomes', tier: 1, rating: 7.5 },
    backupQB: { name: 'Carson Wentz', rating: 1.0 },
    qbDowngradePenalty: 6.5,
    baseEPA: {
      passOffEPA: 0.19,
      rushOffEPA: 0.03,
      passDefEPA: -0.10,
      rushDefEPA: -0.11,
      successRate: 0.498,
      neutralPassRate: 0.60,
      paceSecondsPerPlay: 28.0
    }
  },
  'LV': {
    id: '13',
    abbreviation: 'LV',
    name: 'Las Vegas Raiders',
    city: 'Las Vegas',
    mascot: 'Raiders',
    conference: 'AFC',
    division: 'West',
    stadium: {
      name: 'Allegiant Stadium',
      city: 'Las Vegas',
      state: 'NV',
      isDome: true,
      surface: 'grass',
      elevationMeters: 610,
      latitude: 36.0909,
      longitude: -115.1833,
      timezone: 'America/Los_Angeles'
    },
    startingQB: { name: 'Aidan O’Connell', tier: 4, rating: 2.2 },
    backupQB: { name: 'Gardner Minshew', rating: 2.0 },
    qbDowngradePenalty: 0.5,
    baseEPA: {
      passOffEPA: -0.08,
      rushOffEPA: -0.11,
      passDefEPA: 0.05,
      rushDefEPA: 0.03,
      successRate: 0.410,
      neutralPassRate: 0.59,
      paceSecondsPerPlay: 27.4
    }
  },
  'LAC': {
    id: '24',
    abbreviation: 'LAC',
    name: 'Los Angeles Chargers',
    city: 'Los Angeles',
    mascot: 'Chargers',
    conference: 'AFC',
    division: 'West',
    stadium: {
      name: 'SoFi Stadium',
      city: 'Inglewood',
      state: 'CA',
      isDome: true,
      surface: 'turf',
      elevationMeters: 38,
      latitude: 33.9535,
      longitude: -118.3392,
      timezone: 'America/Los_Angeles'
    },
    startingQB: { name: 'Justin Herbert', tier: 2, rating: 5.6 },
    backupQB: { name: 'Easton Stick', rating: 0.2 },
    qbDowngradePenalty: 5.4,
    baseEPA: {
      passOffEPA: 0.06,
      rushOffEPA: 0.04,
      passDefEPA: -0.11,
      rushDefEPA: -0.07,
      successRate: 0.448,
      neutralPassRate: 0.48,
      paceSecondsPerPlay: 29.1
    }
  },
  'LAR': {
    id: '14',
    abbreviation: 'LAR',
    name: 'Los Angeles Rams',
    city: 'Los Angeles',
    mascot: 'Rams',
    conference: 'NFC',
    division: 'West',
    stadium: {
      name: 'SoFi Stadium',
      city: 'Inglewood',
      state: 'CA',
      isDome: true,
      surface: 'turf',
      elevationMeters: 38,
      latitude: 33.9535,
      longitude: -118.3392,
      timezone: 'America/Los_Angeles'
    },
    startingQB: { name: 'Matthew Stafford', tier: 2, rating: 4.8 },
    backupQB: { name: 'Jimmy Garoppolo', rating: 2.0 },
    qbDowngradePenalty: 2.8,
    baseEPA: {
      passOffEPA: 0.09,
      rushOffEPA: 0.02,
      passDefEPA: 0.12,
      rushDefEPA: 0.06,
      successRate: 0.455,
      neutralPassRate: 0.57,
      paceSecondsPerPlay: 27.2
    }
  },
  'MIA': {
    id: '15',
    abbreviation: 'MIA',
    name: 'Miami Dolphins',
    city: 'Miami',
    mascot: 'Dolphins',
    conference: 'AFC',
    division: 'East',
    stadium: {
      name: 'Hard Rock Stadium',
      city: 'Miami Gardens',
      state: 'FL',
      isDome: false,
      surface: 'grass',
      elevationMeters: 3,
      latitude: 25.9580,
      longitude: -80.2389,
      timezone: 'America/New_York'
    },
    startingQB: { name: 'Tua Tagovailoa', tier: 2, rating: 4.9 },
    backupQB: { name: 'Tyler Huntley', rating: 1.5 },
    qbDowngradePenalty: 3.4,
    baseEPA: {
      passOffEPA: 0.02,
      rushOffEPA: 0.01,
      passDefEPA: -0.03,
      rushDefEPA: 0.02,
      successRate: 0.432,
      neutralPassRate: 0.58,
      paceSecondsPerPlay: 27.0
    }
  },
  'MIN': {
    id: '16',
    abbreviation: 'MIN',
    name: 'Minnesota Vikings',
    city: 'Minnesota',
    mascot: 'Vikings',
    conference: 'NFC',
    division: 'North',
    stadium: {
      name: 'U.S. Bank Stadium',
      city: 'Minneapolis',
      state: 'MN',
      isDome: true,
      surface: 'turf',
      elevationMeters: 255,
      latitude: 44.9737,
      longitude: -93.2575,
      timezone: 'America/Chicago'
    },
    startingQB: { name: 'Sam Darnold', tier: 3, rating: 4.2 },
    backupQB: { name: 'Nick Mullens', rating: 1.8 },
    qbDowngradePenalty: 2.4,
    baseEPA: {
      passOffEPA: 0.15,
      rushOffEPA: 0.03,
      passDefEPA: -0.15,
      rushDefEPA: -0.08,
      successRate: 0.480,
      neutralPassRate: 0.54,
      paceSecondsPerPlay: 27.8
    }
  },
  'NE': {
    id: '17',
    abbreviation: 'NE',
    name: 'New England Patriots',
    city: 'New England',
    mascot: 'Patriots',
    conference: 'AFC',
    division: 'East',
    stadium: {
      name: 'Gillette Stadium',
      city: 'Foxborough',
      state: 'MA',
      isDome: false,
      surface: 'turf',
      elevationMeters: 80,
      latitude: 42.0909,
      longitude: -71.2643,
      timezone: 'America/New_York'
    },
    startingQB: { name: 'Drake Maye', tier: 4, rating: 2.5 },
    backupQB: { name: 'Jacoby Brissett', rating: 1.8 },
    qbDowngradePenalty: 0.7,
    baseEPA: {
      passOffEPA: -0.11,
      rushOffEPA: -0.04,
      passDefEPA: 0.04,
      rushDefEPA: 0.03,
      successRate: 0.402,
      neutralPassRate: 0.53,
      paceSecondsPerPlay: 28.2
    }
  },
  'NO': {
    id: '18',
    abbreviation: 'NO',
    name: 'New Orleans Saints',
    city: 'New Orleans',
    mascot: 'Saints',
    conference: 'NFC',
    division: 'South',
    stadium: {
      name: 'Caesars Superdome',
      city: 'New Orleans',
      state: 'LA',
      isDome: true,
      surface: 'turf',
      elevationMeters: 1,
      latitude: 29.9511,
      longitude: -90.0812,
      timezone: 'America/Chicago'
    },
    startingQB: { name: 'Derek Carr', tier: 3, rating: 3.7 },
    backupQB: { name: 'Spencer Rattler', rating: 1.0 },
    qbDowngradePenalty: 2.7,
    baseEPA: {
      passOffEPA: 0.08,
      rushOffEPA: 0.03,
      passDefEPA: 0.06,
      rushDefEPA: 0.04,
      successRate: 0.446,
      neutralPassRate: 0.53,
      paceSecondsPerPlay: 27.4
    }
  },
  'NYG': {
    id: '19',
    abbreviation: 'NYG',
    name: 'New York Giants',
    city: 'New York',
    mascot: 'Giants',
    conference: 'NFC',
    division: 'East',
    stadium: {
      name: 'MetLife Stadium',
      city: 'East Rutherford',
      state: 'NJ',
      isDome: false,
      surface: 'turf',
      elevationMeters: 2,
      latitude: 40.8128,
      longitude: -74.0742,
      timezone: 'America/New_York'
    },
    startingQB: { name: 'Daniel Jones', tier: 4, rating: 2.8 },
    backupQB: { name: 'Drew Lock', rating: 1.2 },
    qbDowngradePenalty: 1.6,
    baseEPA: {
      passOffEPA: -0.06,
      rushOffEPA: -0.05,
      passDefEPA: 0.02,
      rushDefEPA: 0.01,
      successRate: 0.418,
      neutralPassRate: 0.60,
      paceSecondsPerPlay: 26.6
    }
  },
  'NYJ': {
    id: '20',
    abbreviation: 'NYJ',
    name: 'New York Jets',
    city: 'New York',
    mascot: 'Jets',
    conference: 'AFC',
    division: 'East',
    stadium: {
      name: 'MetLife Stadium',
      city: 'East Rutherford',
      state: 'NJ',
      isDome: false,
      surface: 'turf',
      elevationMeters: 2,
      latitude: 40.8128,
      longitude: -74.0742,
      timezone: 'America/New_York'
    },
    startingQB: { name: 'Aaron Rodgers', tier: 2, rating: 4.8 },
    backupQB: { name: 'Tyrod Taylor', rating: 1.8 },
    qbDowngradePenalty: 3.0,
    baseEPA: {
      passOffEPA: 0.08,
      rushOffEPA: -0.04,
      passDefEPA: -0.09,
      rushDefEPA: 0.00,
      successRate: 0.452,
      neutralPassRate: 0.61,
      paceSecondsPerPlay: 27.1
    }
  },
  'PHI': {
    id: '21',
    abbreviation: 'PHI',
    name: 'Philadelphia Eagles',
    city: 'Philadelphia',
    mascot: 'Eagles',
    conference: 'NFC',
    division: 'East',
    stadium: {
      name: 'Lincoln Financial Field',
      city: 'Philadelphia',
      state: 'PA',
      isDome: false,
      surface: 'grass',
      elevationMeters: 6,
      latitude: 39.9008,
      longitude: -75.1675,
      timezone: 'America/New_York'
    },
    startingQB: { name: 'Jalen Hurts', tier: 2, rating: 5.5 },
    backupQB: { name: 'Kenny Pickett', rating: 1.0 },
    qbDowngradePenalty: 4.5,
    baseEPA: {
      passOffEPA: 0.12,
      rushOffEPA: 0.10,
      passDefEPA: 0.01,
      rushDefEPA: -0.04,
      successRate: 0.485,
      neutralPassRate: 0.51,
      paceSecondsPerPlay: 28.1
    }
  },
  'PIT': {
    id: '23',
    abbreviation: 'PIT',
    name: 'Pittsburgh Steelers',
    city: 'Pittsburgh',
    mascot: 'Steelers',
    conference: 'AFC',
    division: 'North',
    stadium: {
      name: 'Acrisure Stadium',
      city: 'Pittsburgh',
      state: 'PA',
      isDome: false,
      surface: 'grass',
      elevationMeters: 220,
      latitude: 40.4468,
      longitude: -80.0158,
      timezone: 'America/New_York'
    },
    startingQB: { name: 'Russell Wilson', tier: 3, rating: 3.5 },
    backupQB: { name: 'Justin Fields', rating: 3.2 },
    qbDowngradePenalty: 0.6,
    baseEPA: {
      passOffEPA: 0.01,
      rushOffEPA: 0.03,
      passDefEPA: -0.10,
      rushDefEPA: -0.08,
      successRate: 0.438,
      neutralPassRate: 0.49,
      paceSecondsPerPlay: 28.7
    }
  },
  'SF': {
    id: '25',
    abbreviation: 'SF',
    name: 'San Francisco 49ers',
    city: 'San Francisco',
    mascot: '49ers',
    conference: 'NFC',
    division: 'West',
    stadium: {
      name: "Levi's Stadium",
      city: 'Santa Clara',
      state: 'CA',
      isDome: false,
      surface: 'grass',
      elevationMeters: 14,
      latitude: 37.4033,
      longitude: -121.9694,
      timezone: 'America/Los_Angeles'
    },
    startingQB: { name: 'Brock Purdy', tier: 2, rating: 5.6 },
    backupQB: { name: 'Brandon Allen', rating: 0.5 },
    qbDowngradePenalty: 5.1,
    baseEPA: {
      passOffEPA: 0.21,
      rushOffEPA: 0.09,
      passDefEPA: 0.02,
      rushDefEPA: -0.03,
      successRate: 0.496,
      neutralPassRate: 0.53,
      paceSecondsPerPlay: 28.4
    }
  },
  'SEA': {
    id: '26',
    abbreviation: 'SEA',
    name: 'Seattle Seahawks',
    city: 'Seattle',
    mascot: 'Seahawks',
    conference: 'NFC',
    division: 'West',
    stadium: {
      name: 'Lumen Field',
      city: 'Seattle',
      state: 'WA',
      isDome: false,
      surface: 'turf',
      elevationMeters: 6,
      latitude: 47.5952,
      longitude: -122.3316,
      timezone: 'America/Los_Angeles'
    },
    startingQB: { name: 'Geno Smith', tier: 3, rating: 4.4 },
    backupQB: { name: 'Sam Howell', rating: 1.5 },
    qbDowngradePenalty: 2.9,
    baseEPA: {
      passOffEPA: 0.11,
      rushOffEPA: -0.03,
      passDefEPA: 0.03,
      rushDefEPA: 0.04,
      successRate: 0.452,
      neutralPassRate: 0.64,
      paceSecondsPerPlay: 25.9
    }
  },
  'TB': {
    id: '27',
    abbreviation: 'TB',
    name: 'Tampa Bay Buccaneers',
    city: 'Tampa Bay',
    mascot: 'Buccaneers',
    conference: 'NFC',
    division: 'South',
    stadium: {
      name: 'Raymond James Stadium',
      city: 'Tampa',
      state: 'FL',
      isDome: false,
      surface: 'grass',
      elevationMeters: 6,
      latitude: 27.9759,
      longitude: -82.5033,
      timezone: 'America/New_York'
    },
    startingQB: { name: 'Baker Mayfield', tier: 3, rating: 4.5 },
    backupQB: { name: 'Kyle Trask', rating: 0.5 },
    qbDowngradePenalty: 4.0,
    baseEPA: {
      passOffEPA: 0.16,
      rushOffEPA: 0.05,
      passDefEPA: 0.07,
      rushDefEPA: -0.01,
      successRate: 0.472,
      neutralPassRate: 0.57,
      paceSecondsPerPlay: 26.9
    }
  },
  'TEN': {
    id: '10',
    abbreviation: 'TEN',
    name: 'Tennessee Titans',
    city: 'Tennessee',
    mascot: 'Titans',
    conference: 'AFC',
    division: 'South',
    stadium: {
      name: 'Nissan Stadium',
      city: 'Nashville',
      state: 'TN',
      isDome: false,
      surface: 'turf',
      elevationMeters: 135,
      latitude: 36.1665,
      longitude: -86.7713,
      timezone: 'America/Chicago'
    },
    startingQB: { name: 'Will Levis', tier: 4, rating: 2.3 },
    backupQB: { name: 'Mason Rudolph', rating: 1.8 },
    qbDowngradePenalty: 0.5,
    baseEPA: {
      passOffEPA: -0.10,
      rushOffEPA: 0.02,
      passDefEPA: -0.04,
      rushDefEPA: -0.05,
      successRate: 0.420,
      neutralPassRate: 0.54,
      paceSecondsPerPlay: 27.8
    }
  },
  'WAS': {
    id: '28',
    abbreviation: 'WAS',
    name: 'Washington Commanders',
    city: 'Washington',
    mascot: 'Commanders',
    conference: 'NFC',
    division: 'East',
    stadium: {
      name: 'Northwest Stadium',
      city: 'Landover',
      state: 'MD',
      isDome: false,
      surface: 'grass',
      elevationMeters: 60,
      latitude: 38.9076,
      longitude: -76.8645,
      timezone: 'America/New_York'
    },
    startingQB: { name: 'Jayden Daniels', tier: 2, rating: 5.4 },
    backupQB: { name: 'Marcus Mariota', rating: 1.5 },
    qbDowngradePenalty: 3.9,
    baseEPA: {
      passOffEPA: 0.22,
      rushOffEPA: 0.11,
      passDefEPA: 0.08,
      rushDefEPA: 0.05,
      successRate: 0.508,
      neutralPassRate: 0.52,
      paceSecondsPerPlay: 27.0
    }
  }
};

export const nflTeamAbbreviationToName: Record<string, string> = Object.fromEntries(
  Object.values(NFL_TEAMS).map(t => [t.abbreviation, t.name])
);

export const nflTeamNameToAbbreviation: Record<string, string> = Object.fromEntries(
  Object.values(NFL_TEAMS).map(t => [t.name, t.abbreviation])
);

// Map common variations and ESPN abbreviations to canonical abbreviation
export const normalizeNFLTeamAbbreviation = (raw: string): string => {
  if (!raw) return '';
  const clean = raw.trim().toUpperCase();
  const aliasMap: Record<string, string> = {
    'ARIZONA': 'ARI',
    'ATLANTA': 'ATL',
    'BALTIMORE': 'BAL',
    'BUFFALO': 'BUF',
    'CAROLINA': 'CAR',
    'CHICAGO': 'CHI',
    'CINCINNATI': 'CIN',
    'CLEVELAND': 'CLE',
    'DALLAS': 'DAL',
    'DENVER': 'DEN',
    'DETROIT': 'DET',
    'GREEN BAY': 'GB',
    'HOUSTON': 'HOU',
    'INDIANAPOLIS': 'IND',
    'JACKSONVILLE': 'JAX',
    'KANSAS CITY': 'KC',
    'LAS VEGAS': 'LV',
    'LA CHARGERS': 'LAC',
    'LOS ANGELES CHARGERS': 'LAC',
    'LA RAMS': 'LAR',
    'LOS ANGELES RAMS': 'LAR',
    'MIAMI': 'MIA',
    'MINNESOTA': 'MIN',
    'NEW ENGLAND': 'NE',
    'NEW ORLEANS': 'NO',
    'NY GIANTS': 'NYG',
    'NEW YORK GIANTS': 'NYG',
    'NY JETS': 'NYJ',
    'NEW YORK JETS': 'NYJ',
    'PHILADELPHIA': 'PHI',
    'PITTSBURGH': 'PIT',
    'SAN FRANCISCO': 'SF',
    'SEATTLE': 'SEA',
    'TAMPA BAY': 'TB',
    'TENNESSEE': 'TEN',
    'WASHINGTON': 'WAS',
    'WSH': 'WAS'
  };
  return aliasMap[clean] || (NFL_TEAMS[clean] ? clean : '');
};
