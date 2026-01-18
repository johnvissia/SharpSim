'use client';

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
      React.createElement('ellipse', { cx: "12", cy: "12", rx: "10", ry: "7" }),
      React.createElement('path', { d: "M12 2a10 7 0 0 0-10 7c0 2.24 1.79 4.1 4 5.3" }),
      React.createElement('path', { d: "M12 2a10 7 0 0 1 10 7c0 2.24-1.79 4.1-4 5.3" }),
      React.createElement('path', { d: "M7 12h2" }),
      React.createElement('path', { d: "M15 12h2" }),
      React.createElement('path', { d: "M12 7v10" })
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
      React.createElement('circle', { cx: "12", cy: "12", r: "10" }),
      React.createElement('polygon', { points: "12 2 12 22 2 12 22 12" }),
      React.createElement('polygon', { points: "12 2 17 6.5 12 11 7 6.5" }),
      React.createElement('polygon', { points: "12 22 17 17.5 12 13 7 17.5" }),
      React.createElement('polygon', { points: "2 12 6.5 7 11 12 6.5 17" }),
      React.createElement('polygon', { points: "22 12 17.5 7 13 12 17.5 17" })
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
    
    // Soccer (EPL) - These are Team IDs, not slugs
    'Arsenal': '359', 'Manchester United': '360', 'Liverpool': '364', 'Manchester City': '382',
    'Chelsea': '363', 'Tottenham Hotspur': '367', 'Nottingham Forest': '393'
};

const sportLeagueMap: { [key in SportName]?: string } = {
    'NFL': 'nfl', 'NBA': 'nba', 'NHL': 'nhl', 'MLB': 'mlb', 'WNBA': 'wnba', 'NCAAF': 'ncaaf', 'NCAAM': 'ncaab', 'NCAAW': 'ncaaw', 'Soccer': 'soccer'
};

const ncaaTeamIdMap: Record<string, string> = {
    // SEC
    "Alabama": "333", "Arkansas": "8", "Auburn": "2", "Florida": "57",
    "Georgia": "61", "Kentucky": "96", "LSU": "99", "Ole Miss": "145",
    "Mississippi State": "344", "Missouri": "142", "Oklahoma": "201",
    "South Carolina": "2579", "Tennessee": "2633", "Texas": "251",
    "Texas A&M": "245", "Vanderbilt": "238",

    // Big Ten
    "Illinois": "356", "Indiana": "84", "Iowa": "2294", "Maryland": "120",
    "Michigan": "130", "Michigan State": "127", "Minnesota": "135",
    "Nebraska": "158", "Northwestern": "77", "Ohio State": "194",
    "Oregon": "2483", "Penn State": "213", "Purdue": "2509",
    "Rutgers": "164", "UCLA": "26", "USC": "30", "Washington": "264",
    "Wisconsin": "275",

    // ACC
    "Boston College": "103", "California": "25", "Clemson": "228",
    "Duke": "150", "Florida State": "52", "Georgia Tech": "59",
    "Louisville": "97", "Miami": "2390", "NC State": "152",
    "North Carolina": "153", "Notre Dame": "87", "Pittsburgh": "221",
    "SMU": "231", "Stanford": "24", "Syracuse": "155",
    "Virginia": "258", "Virginia Tech": "259", "Wake Forest": "154",

    // Big 12
    "Arizona": "12", "Arizona State": "9", "Baylor": "239", "BYU": "252",
    "Cincinnati": "2132", "Colorado": "38", "Houston": "248",
    "Iowa State": "66", "Kansas": "2305", "Kansas State": "2306",
    "Oklahoma State": "197", "TCU": "2628", "Texas Tech": "2641",
    "UCF": "2116", "Utah": "254", "West Virginia": "277",
};

const mascotRegex = new RegExp([
    'University of', 'Eagles', 'Golden Bears', 'Tigers', 'Blue Devils', 'Seminoles', 'Yellow Jackets',
    'Cardinals', 'Hurricanes', 'Wolfpack', 'Tar Heels', 'Fighting Irish', 'Panthers', 'Mustangs',
    'Cardinal', 'Orange', 'Cavaliers', 'Hokies', 'Demon Deacons', 'Fighting Illini', 'Hoosiers',
    'Hawkeyes', 'Terrapins', 'Wolverines', 'Spartans', 'Golden Gophers', 'Cornhuskers', 'Wildcats',
    'Buckeyes', 'Ducks', 'Nittany Lions', 'Boilermakers', 'Scarlet Knights', 'Bruins', 'Trojans',
    'Huskies', 'Badgers', 'Sun Devils', 'Bears', 'Cougars', 'Bearcats', 'Buffaloes', 'Cyclones',
    'Jayhawks', 'Cowboys', 'Horned Frogs', 'Red Raiders', 'Knights', 'Utes', 'Mountaineers',
    'Crimson Tide', 'Razorbacks', 'Gators', 'Bulldogs', 'Rebels', 'Gamecocks', 'Volunteers',
    'Longhorns', 'Aggies', 'Commodores'
].join('|'), 'gi');


export function getTeamLogoUrl(teamName: string, sport: SportName): string {
    const isNcaa = ['NCAAF', 'NCAAM', 'NCAAW'].includes(sport);
    const directionals = ["western", "eastern", "central", "northern", "southern"];
    
    if (isNcaa) {
        const normalizedName = teamName.trim();
        const cleanedName = normalizedName.replace(mascotRegex, '').replace(/(\(FL\)|&)/g, '').trim();

        const sortedNcaaKeys = Object.keys(ncaaTeamIdMap).sort((a, b) => b.length - a.length);
        const apiIsDirectional = directionals.some(dir => normalizedName.toLowerCase().startsWith(dir));

        // Strategy 1: Match cleaned name (e.g., "Minnesota Golden Gophers" -> "Minnesota")
        for (const key of sortedNcaaKeys) {
            if (key.toLowerCase().includes(cleanedName.toLowerCase())) {
                const keyIsDirectional = directionals.some(dir => key.toLowerCase().startsWith(dir));
                if (apiIsDirectional && !keyIsDirectional) {
                    continue;
                }

                // "State Check": if API name has "State" but the map key doesn't, it's a mismatch.
                const apiHasState = normalizedName.toLowerCase().includes("state");
                const keyHasState = key.toLowerCase().includes("state");
                if (apiHasState && !keyHasState) {
                    continue;
                }

                const teamId = ncaaTeamIdMap[key];
                return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/${teamId}.png`;
            }
        }
        
        // Strategy 2: Match original name (for cases where cleaning removes the whole name, e.g. "Duke")
        for (const key of sortedNcaaKeys) {
            if (key.toLowerCase().includes(normalizedName.toLowerCase())) {
                const keyIsDirectional = directionals.some(dir => key.toLowerCase().startsWith(dir));
                if (apiIsDirectional && !keyIsDirectional) {
                    continue;
                }

                const apiHasState = normalizedName.toLowerCase().includes("state");
                const keyHasState = key.toLowerCase().includes("state");
                if (apiHasState && !keyHasState) {
                    continue;
                }
                
                const teamId = ncaaTeamIdMap[key];
                return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/${teamId}.png`;
            }
        }
    }

    // --- Fallback to Professional Leagues & old logic ---
    const league = sportLeagueMap[sport];
    if (!league) {
        console.log(`[Logo Mapper Debug] No league mapping for sport: "${sport}"`);
        return '';
    }

    const normalizedApiName = teamName.toLowerCase().trim();
    
    const normalizedLogoSlugs: { [key: string]: string } = {};
    for (const key in teamLogoSlugs) {
        normalizedLogoSlugs[key.toLowerCase().trim()] = teamLogoSlugs[key];
    }

    let slug = normalizedLogoSlugs[normalizedApiName];
    if (slug) {
        return `https://a.espncdn.com/i/teamlogos/${league}/500/${slug}.png`;
    }

    const nameParts = normalizedApiName.split(' ');
    if (nameParts.length > 1) {
        const nameWithoutLastWord = nameParts.slice(0, -1).join(' ');
        slug = normalizedLogoSlugs[nameWithoutLastWord];
        if (slug) {
            return `https://a.espncdn.com/i/teamlogos/${league}/500/${slug}.png`;
        }
    }

    const sortedKeys = Object.keys(normalizedLogoSlugs).sort((a, b) => b.length - a.length);
    for (const mapKey of sortedKeys) {
        if (normalizedApiName.includes(mapKey)) {
            slug = normalizedLogoSlugs[mapKey];
            if (slug) {
                return `https://a.espncdn.com/i/teamlogos/${league}/500/${slug}.png`;
            }
        }
    }
    
    console.log(`[Logo Mapper Debug] No logo found for team: "${teamName}" in sport: "${sport}"`);
    return ''; // Return empty string to signal fallback to the sport icon.
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
