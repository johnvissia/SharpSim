export const teamNameMap: Record<string, string> = {
    // NHL
    'Montréal Canadiens': 'Montreal Canadiens',
    'St Louis Blues': 'St. Louis Blues',
    'Vegas Golden Knights': 'Vegas Golden Knights',

    // NBA
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

    // NCAAM Mappings
    'Miami': 'Miami (FL)',
    'Miami (FL)': 'Miami (FL)',
    'Miami Hurricanes': 'Miami (FL)',
    'Miami Florida': 'Miami (FL)',
    'Miami (OH)': 'Miami (OH)',
    'Miami Ohio': 'Miami (OH)',

    'Florida St': 'Florida State',
    'Floridia St': 'Florida State',
    'Florida St.': 'Florida State',
    'Florida State': 'Florida State',
    'Fla State': 'Florida State',

    'Mississippi St': 'Mississippi State',
    'Mississippi St.': 'Mississippi State',
    'MS State': 'Mississippi State',

    'App State': 'Appalachian State',
    'Appalachian St': 'Appalachian State',

    'NC State': 'NC State',
    'North Carolina St': 'NC State',
    'North Carolina State': 'NC State',

    'Kansas St': 'Kansas State',
    'Kansas St.': 'Kansas State',
    'K-State': 'Kansas State',

    'Arizona St': 'Arizona State',
    'Arizona St.': 'Arizona State',
    'ASU': 'Arizona State',

    'Oregon St': 'Oregon State',
    'Oregon St.': 'Oregon State',

    'Oklahoma St': 'Oklahoma State',
    'Oklahoma St.': 'Oklahoma State',

    'Michigan St': 'Michigan State',
    'Michigan St.': 'Michigan State',
    'MSU': 'Michigan State',

    'Penn St': 'Penn State',
    'Penn St.': 'Penn State',

    'Ohio St': 'Ohio State',
    'Ohio St.': 'Ohio State',
    'OSU': 'Ohio State',

    'Virginia Tech': 'Virginia Tech',
    'VA Tech': 'Virginia Tech',
    'Va Tech': 'Virginia Tech',
    'VPI': 'Virginia Tech',

    'Georgia Tech': 'Georgia Tech',
    'GA Tech': 'Georgia Tech',
    'Ga Tech': 'Georgia Tech',

    'Cal': 'California',
    'Cal Berkeley': 'California',
    'UC Berkeley': 'California',

    'Ole Miss': 'Ole Miss',
    'Mississippi': 'Ole Miss',

    'UConn': 'UConn',
    'Connecticut': 'UConn',

    'UMass': 'UMass',
    'Massachusetts': 'UMass',

    'USC': 'USC',
    'Southern California': 'USC',
    'Southern Cal': 'USC',

    'LSU': 'LSU',
    'Louisiana State': 'LSU',

    'SMU': 'SMU',
    'Southern Methodist': 'SMU',

    'TCU': 'TCU',
    'Texas Christian': 'TCU',

    'UCF': 'UCF',
    'Central Florida': 'UCF',

    'BYU': 'BYU',
    'Brigham Young': 'BYU',

    'UAB': 'UAB',
    'Alabama Birmingham': 'UAB',

    'UTEP': 'UTEP',
    'Texas El Paso': 'UTEP',

    'UTSA': 'UTSA',
    'Texas San Antonio': 'UTSA',

    'VCU': 'VCU',
    'Virginia Commonwealth': 'VCU',

    'UNLV': 'UNLV',
    'Nevada Las Vegas': 'UNLV',

    'Texas A&M': 'Texas A&M',
    'A&M': 'Texas A&M',
    'Texas AM': 'Texas A&M',
    'TAMU': 'Texas A&M',

    'UNC': 'North Carolina',
    'Pitt': 'Pittsburgh',
    'Wash St': 'Washington State',
    'Wash State': 'Washington State',
    'Wazzu': 'Washington State',

    // MLB Mappings (Fast path full names + overrides)
    'Oakland Athletics': 'Oakland Athletics',
    'Chicago White Sox': 'Chicago White Sox',
    'Boston Red Sox': 'Boston Red Sox',
    'Toronto Blue Jays': 'Toronto Blue Jays',
    'New York Mets': 'New York Mets',
    'New York Yankees': 'New York Yankees',
    'Los Angeles Dodgers': 'Los Angeles Dodgers',
    'Los Angeles Angels': 'Los Angeles Angels',
    'Chicago Cubs': 'Chicago Cubs',
    'Philadelphia Phillies': 'Philadelphia Phillies',
    'Miami Marlins': 'Miami Marlins',
    'Arizona Diamondbacks': 'Arizona Diamondbacks',
    'Atlanta Braves': 'Atlanta Braves',
    'Washington Nationals': 'Washington Nationals',
    'Baltimore Orioles': 'Baltimore Orioles',
    'Cleveland Guardians': 'Cleveland Guardians',
    'Cincinnati Reds': 'Cincinnati Reds',
    'Colorado Rockies': 'Colorado Rockies',
    'Detroit Tigers': 'Detroit Tigers',
    'Houston Astros': 'Houston Astros',
    'Kansas City Royals': 'Kansas City Royals',
    'Minnesota Twins': 'Minnesota Twins',
    'Milwaukee Brewers': 'Milwaukee Brewers',
    'Pittsburgh Pirates': 'Pittsburgh Pirates',
    'San Diego Padres': 'San Diego Padres',
    'San Francisco Giants': 'San Francisco Giants',
    'Seattle Mariners': 'Seattle Mariners',
    'St. Louis Cardinals': 'St. Louis Cardinals',
    'Tampa Bay Rays': 'Tampa Bay Rays',
    'Texas Rangers': 'Texas Rangers',

    'Athletics': 'Oakland Athletics',
    'Oakland': 'Oakland Athletics',
    'White Sox': 'Chicago White Sox',
    'Red Sox': 'Boston Red Sox',
    'Blue Jays': 'Toronto Blue Jays',
    'Mets': 'New York Mets',
    'Yankees': 'New York Yankees',
    'Dodgers': 'Los Angeles Dodgers',
    'Angels': 'Los Angeles Angels',
    'Cubs': 'Chicago Cubs',
    'Phillies': 'Philadelphia Phillies',
    'Marlins': 'Miami Marlins',
    'Diamondbacks': 'Arizona Diamondbacks',
    'Braves': 'Atlanta Braves',
    'Nationals': 'Washington Nationals',
    'Orioles': 'Baltimore Orioles',
    'Guardians': 'Cleveland Guardians',
    'Reds': 'Cincinnati Reds',
    'Rockies': 'Colorado Rockies',
    'Tigers': 'Detroit Tigers',
    'Astros': 'Houston Astros',
    'Royals': 'Kansas City Royals',
    'Twins': 'Minnesota Twins',
    'Brewers': 'Milwaukee Brewers',
    'Pirates': 'Pittsburgh Pirates',
    'Padres': 'San Diego Padres',
    'Giants': 'San Francisco Giants',
    'Mariners': 'Seattle Mariners',
    'Cardinals': 'St. Louis Cardinals',
    'Rays': 'Tampa Bay Rays',
    'Rangers': 'Texas Rangers',
};

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
    'Kraken', 'Oilers', 'Flames', 'Canucks', 'Jets', 'Maple Leafs', 'Senators', 'Canadiens',
    'Diamondbacks', 'Braves', 'Orioles', 'Red Sox', 'White Sox', 'Cubs', 'Reds', 'Guardians',
    'Rockies', 'Tigers', 'Astros', 'Royals', 'Angels', 'Dodgers', 'Marlins', 'Brewers',
    'Twins', 'Mets', 'Yankees', 'Athletics', 'Phillies', 'Pirates', 'Padres', 'Giants',
    'Mariners', 'Cardinals', 'Rays', 'Blue Jays', 'Nationals'
];

export function normalizeTeamName(name: string): string {
    if (!name) return '';
    let processed = name.trim();

    // 0. Early Override Check (Fast Path)
    if (teamNameMap[processed]) return teamNameMap[processed];

    // 1. Standardize "St." vs "St" vs "Saint" and remove apostrophes
    processed = processed.replace(/'s\b/g, '').replace(/'/g, '');

    // Handle "St" or "St." at the START -> "St." (e.g., St. Louis)
    if (/^St\.?\s/i.test(processed) || /^Saint\s/i.test(processed)) {
        processed = processed.replace(/^(St\.?|Saint)\s/i, 'St. ');
    }
    // Handle "St" or "St." at the END -> "State" (e.g., Arizona St)
    if (/\s(St\.?|State)$/i.test(processed)) {
        processed = processed.replace(/\s(St\.?|State)$/i, ' State');
    }

    // 1.5 Special check for common abbreviations before further processing
    if (teamNameMap[processed]) return teamNameMap[processed];

    // 2. Remove known mascots from the end
    // Loop twice to handle multi-word mascots or "State Mascots"
    for (let i = 0; i < 2; i++) {
        for (const mascot of mascots) {
            const regex = new RegExp(`\\s+${mascot}$`, 'i');
            if (regex.test(processed)) {
                processed = processed.replace(regex, '').trim();
            }
        }
    }

    // 2.5 Check map again after mascot removal
    if (teamNameMap[processed]) return teamNameMap[processed];

    // 3. Expand common abbreviations
    processed = processed
        .replace(/\bMiss\b\.?/g, 'Mississippi')
        .replace(/\bInt'l\b/g, 'International')
        .replace(/\bUniv\b\.?/g, 'University')
        .replace(/\bTenn\b\.?/g, 'Tennessee')
        .replace(/\bMich\b\.?/g, 'Michigan')
        .replace(/\bWisc\b\.?/g, 'Wisconsin')
        .replace(/\bIll\b\.?/g, 'Illinois')
        .replace(/\bPenn\b\.?/g, 'Pennsylvania');

    // 4. Final check against override map with the "cleaned" name
    if (teamNameMap[processed]) return teamNameMap[processed];

    // 5. Special Fix for "St. Louis" vs "St Louis" consistency if map failed
    if (processed === 'St Louis') return 'St. Louis Blues';
    if (processed === 'St. Louis') return 'St. Louis Blues';

    return processed;
}
