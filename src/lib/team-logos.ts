import * as React from 'react';
import type { SportName } from './types';
import type { LucideProps } from 'lucide-react';
import { Trophy } from 'lucide-react';

const BaseballIcon = (props: LucideProps) => (
    React.createElement('svg', {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props
    },
      React.createElement('circle', { cx: "12", cy: "12", r: "10" }),
      React.createElement('path', { d: "M12 2a7.5 7.5 0 0 0-7.5 7.5c0 1.15.26 2.24.73 3.22" }),
      React.createElement('path', { d: "M12 2a7.5 7.5 0 0 1 7.5 7.5c0 1.15-.26 2.24-.73 3.22" }),
      React.createElement('path', { d: "M2.5 9.56A7.5 7.5 0 0 1 12 22a7.5 7.5 0 0 1 9.5-12.44" })
    )
  );

const BasketballIcon = (props: LucideProps) => (
    React.createElement('svg', {
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        ...props
    },
        React.createElement('circle', { cx: '12', cy: '12', r: '10' }),
        React.createElement('path', { d: 'M4.22 14c-1.22-2.8-1.03-6.6.93-8.8' }),
        React.createElement('path', { d: 'M19.78 10c1.22 2.8 1.03 6.6-.93 8.8' }),
        React.createElement('path', { d: 'M10 4.22c2.8 1.22 6.6 1.03 8.8-.93' }),
        React.createElement('path', { d: 'M14 19.78c-2.8-1.22-6.6-1.03-8.8.93' }),
        React.createElement('path', { d: 'M2 10h20' }),
        React.createElement('path', { d: 'M12 2v20' })
    )
);

const FootballIcon = (props: LucideProps) => (
    React.createElement('svg', {
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        ...props
    },
      React.createElement('path', { d: "M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" }),
      React.createElement('path', { d: "M8.5 7a5.1 5.1 0 0 1 7 0" }),
      React.createElement('path', { d: "M12 22a7.8 7.8 0 0 1-4-1.5" }),
      ReactcreateElement('path', { d: "M12 22a7.8 7.8 0 0 0 4-1.5" })
    )
);

const FutbolIcon = (props: LucideProps) => (
    React.createElement('svg', {
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        ...props
    },
      React.createElement('path', { d: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" }),
      React.createElement('path', { d: "M15.5 6.5L12 12l3.5 5.5" }),
      React.createElement('path', { d: "M8.5 6.5L12 12l-3.5 5.5" }),
      React.createElement('path', { d: "M6.5 15.5l5.5-3.5 5.5 3.5" }),
      React.createElement('path', { d: "M6.5 8.5l5.5 3.5 5.5-3.5" })
    )
);

const IceSkate = (props: LucideProps) => (
    React.createElement('svg', {
        xmlns: "http://www.w3.org/2000/svg",
        width: "24",
        height: "24",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        ...props
    },
      React.createElement('path', { d: "M2 16h20" }),
      React.createElement('path', { d: "M2 20h20" }),
      React.createElement('path', { d: "M6 16l-2.5 4" }),
      React.createElement('path', { d: "M18 16l2.5 4" }),
      React.createElement('path', { d: "M12 16V9a2 2 0 0 0-2-2H8" }),
      React.createElement('path', { d: "M18.5 6c-2 0-3.5-2-3.5-4" }),
      React.createElement('path', { d: "M6 2h10a2 2 0 0 1 2 2v10H4V4a2 2 0 0 1 2-2z" })
    )
);


const teamLogoSlugs: { [key: string]: string } = {
    // NFL
    'Arizona Cardinals': 'ari', 'Atlanta Falcons': 'atl', 'Baltimore Ravens': 'bal', 'Buffalo Bills': 'buf',
    'Carolina Panthers': 'car', 'Chicago Bears': 'chi', 'Cincinnati Bengals': 'cin', 'Cleveland Browns': 'cle',
    'Dallas Cowboys': 'dal', 'Denver Broncos': 'den', 'Detroit Lions': 'det', 'Green Bay Packers': 'gb',
    'Houston Texans': 'hou', 'Indianapolis Colts': 'ind', 'Jacksonville Jaguars': 'jax', 'Kansas City Chiefs': 'kc',
    'Las Vegas Raiders': 'lv', 'Los Angeles Chargers': 'lac', 'Los Angeles Rams': 'lar', 'Miami Dolphins': 'mia',
    'Minnesota Vikings': 'min', 'New England Patriots': 'ne', 'New Orleans Saints': 'no', 'New York Giants': 'nyg',
    'New York Jets': 'nyj', 'Philadelphia Eagles': 'phi', 'Pittsburgh Steelers': 'pit', 'San Francisco 49ers': 'sf',
    'Seattle Seahawks': 'sea', 'Tampa Bay Buccaneers': 'tb', 'Tennessee Titans': 'ten', 'Washington Commanders': 'wsh',

    // NBA
    'Atlanta Hawks': 'atl', 'Boston Celtics': 'bos', 'Brooklyn Nets': 'bkn', 'Charlotte Hornets': 'cha',
    'Chicago Bulls': 'chi', 'Cleveland Cavaliers': 'cle', 'Dallas Mavericks': 'dal', 'Denver Nuggets': 'den',
    'Detroit Pistons': 'det', 'Golden State Warriors': 'gs', 'Houston Rockets': 'hou', 'Indiana Pacers': 'ind',
    'LA Clippers': 'lac', 'Los Angeles Lakers': 'lal', 'Memphis Grizzlies': 'mem', 'Miami Heat': 'mia',
    'Milwaukee Bucks': 'mil', 'Minnesota Timberwolves': 'min', 'New Orleans Pelicans': 'no', 'New York Knicks': 'nyk',
    'Oklahoma City Thunder': 'okc', 'Orlando Magic': 'orl', 'Philadelphia 76ers': 'phi', 'Phoenix Suns': 'phx',
    'Portland Trail Blazers': 'por', 'Sacramento Kings': 'sac', 'San Antonio Spurs': 'sa', 'Toronto Raptors': 'tor',
    'Utah Jazz': 'utah', 'Washington Wizards': 'wsh',

    // NHL
    'Anaheim Ducks': 'ana', 'Arizona Coyotes': 'ari', 'Boston Bruins': 'bos', 'Buffalo Sabres': 'buf',
    'Calgary Flames': 'cgy', 'Carolina Hurricanes': 'car', 'Chicago Blackhawks': 'chi', 'Colorado Avalanche': 'col',
    'Columbus Blue Jackets': 'cbj', 'Dallas Stars': 'dal', 'Detroit Red Wings': 'det', 'Edmonton Oilers': 'edm',
    'Florida Panthers': 'fla', 'Los Angeles Kings': 'la', 'Minnesota Wild': 'min', 'Montreal Canadiens': 'mtl',
    'Nashville Predators': 'nsh', 'New Jersey Devils': 'nj', 'New York Islanders': 'nyi', 'New York Rangers': 'nyr',
    'Ottawa Senators': 'ott', 'Philadelphia Flyers': 'phi', 'Pittsburgh Penguins': 'pit', 'San Jose Sharks': 'sj',
    'Seattle Kraken': 'sea', 'St. Louis Blues': 'stl', 'Tampa Bay Lightning': 'tb', 'Toronto Maple Leafs': 'tor',
    'Vancouver Canucks': 'van', 'Vegas Golden Knights': 'vgk', 'Washington Capitals': 'wsh', 'Winnipeg Jets': 'wpg',

    // MLB
    'Arizona Diamondbacks': 'ari', 'Atlanta Braves': 'atl', 'Baltimore Orioles': 'bal', 'Boston Red Sox': 'bos',
    'Chicago White Sox': 'chw', 'Chicago Cubs': 'chc', 'Cincinnati Reds': 'cin', 'Cleveland Guardians': 'cle',
    'Colorado Rockies': 'col', 'Detroit Tigers': 'det', 'Houston Astros': 'hou', 'Kansas City Royals': 'kc',
    'Los Angeles Angels': 'ana', 'Los Angeles Dodgers': 'lad', 'Miami Marlins': 'mia', 'Milwaukee Brewers': 'mil',
    'Minnesota Twins': 'min', 'New York Mets': 'nym', 'New York Yankees': 'nyy', 'Oakland Athletics': 'oak',
    'Philadelphia Phillies': 'phi', 'Pittsburgh Steelers': 'pit', 'San Diego Padres': 'sd', 'San Francisco Giants': 'sf',
    'Seattle Mariners': 'sea', 'St. Louis Cardinals': 'stl', 'Tampa Bay Rays': 'tb', 'Texas Rangers': 'tex',
    'Toronto Blue Jays': 'tor', 'Washington Nationals': 'wsh',
};

const sportLeagueMap: { [key in SportName]?: string } = {
    'NFL': 'nfl', 'NBA': 'nba', 'NHL': 'nhl', 'MLB': 'mlb', 'WNBA': 'wnba', 'NCAAF': 'ncaaf', 'NCAAM': 'ncaab'
};

export function getTeamLogoUrl(teamName: string, sport: SportName): string {
    const league = sportLeagueMap[sport];
    const slug = teamLogoSlugs[teamName];

    if (sport === 'NCAAF' || sport === 'NCAAM') {
        if (teamName.includes('Alabama')) return `https://a.espncdn.com/i/teamlogos/ncaa/500/333.png`;
        if (teamName.includes('Georgia')) return `https://a.espncdn.com/i/teamlogos/ncaa/500/61.png`;
        // Add more NCAA mappings as needed
    }

    if (league && slug) {
        return `https://a.espncdn.com/i/teamlogos/${league}/500/${slug}.png`;
    }

    return ''; // Return empty string to signal fallback
}

export const sportIconMap: { [key: string]: React.ElementType<LucideProps> } = {
    'NBA': BasketballIcon,
    'WNBA': BasketballIcon,
    'NCAAM': BasketballIcon,
    'NCAAW': BasketballIcon,
    'NFL': FootballIcon,
    'NCAAF': FootballIcon,
    'NHL': IceSkate,
    'Soccer': FutbolIcon,
    'MLB': BaseballIcon,
    'Default': Trophy,
};
