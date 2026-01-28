export const teamNameMap: Record<string, string> = {
    // NHL
    'Montréal Canadiens': 'Montreal Canadiens',
    'St Louis Blues': 'St. Louis Blues',
    'Vegas Golden Knights': 'Vegas Golden Knights',

    // NCAAM Mappings (Targeting School Name only for canonical key)
    'Michigan St': 'Michigan State',
    'Michigan St.': 'Michigan State',

    'Ole Miss': 'Mississippi',
    'Ole Miss Rebels': 'Mississippi',

    'NC State': 'North Carolina State',
    'NC State Wolfpack': 'North Carolina State',
    'North Carolina St': 'North Carolina State',

    'UConn': 'Connecticut',
    'UConn Huskies': 'Connecticut',

    'UMass': 'Massachusetts',
    'UMass Minutemen': 'Massachusetts',

    'USC': 'Southern California',
    'USC Trojans': 'Southern California',

    'LSU': 'Louisiana State',
    'LSU Tigers': 'Louisiana State',

    'UCF': 'Central Florida',
    'UCF Knights': 'Central Florida',

    'BYU': 'Brigham Young',
    'BYU Cougars': 'Brigham Young',

    'SMU': 'Southern Methodist',
    'SMU Mustangs': 'Southern Methodist',

    'TCU': 'Texas Christian',
    'TCU Horned Frogs': 'Texas Christian',

    'UAB': 'Alabama Birmingham',
    'UAB Blazers': 'Alabama Birmingham',

    'UTEP': 'Texas El Paso',
    'UTEP Miners': 'Texas El Paso',

    'UTSA': 'Texas San Antonio',
    'UTSA Roadrunners': 'Texas San Antonio',

    'VCU': 'Virginia Commonwealth',
    'VCU Rams': 'Virginia Commonwealth',

    'UNLV': 'Nevada Las Vegas',
    'UNLV Rebels': 'Nevada Las Vegas',

    'Miami': 'Miami',
    'Miami (FL)': 'Miami',
    'Miami Hurricanes': 'Miami',

    'Pittsburgh': 'Pittsburgh',
    'Pitt': 'Pittsburgh',

    'Wake Forest': 'Wake Forest',

    'North Carolina': 'North Carolina',
    'UNC': 'North Carolina',

    'Duke': 'Duke',

    'Kentucky': 'Kentucky',
    'Kansas': 'Kansas',
    'Arizona': 'Arizona',

    'Arizona St': 'Arizona State',
    'Arizona St Sun Devils': 'Arizona State',

    'Purdue': 'Purdue',
    'Houston': 'Houston',
    'Tennessee': 'Tennessee',
    'Marquette': 'Marquette',
    'Iowa State': 'Iowa State',
    'Creighton': 'Creighton',
    'Baylor': 'Baylor',
    'Gonzaga': 'Gonzaga',
    'Auburn': 'Auburn',
    'Illinois': 'Illinois',
    'Alabama': 'Alabama',
    'South Carolina': 'South Carolina',
    'Florida': 'Florida',
    'Wisconsin': 'Wisconsin',
    'Texas': 'Texas',
    'Texas Tech': 'Texas Tech',
    'San Diego State': 'San Diego State',
    'Utah State': 'Utah State',
    'Nevada': 'Nevada',
    'Boise State': 'Boise State',
    'Colorado State': 'Colorado State',
    'New Mexico': 'New Mexico',
    'Washington State': 'Washington State',

    'Syracuse': 'Syracuse',
    'Syracuse Orange': 'Syracuse',

    'Virginia': 'Virginia',
    'Virginia Cavaliers': 'Virginia',

    'Clemson': 'Clemson',
    'Florida State': 'Florida State',
    'Boston College': 'Boston College',
    'Georgia Tech': 'Georgia Tech',
    'Louisville': 'Louisville',
    'Notre Dame': 'Notre Dame',
    'West Virginia': 'West Virginia',
    'Kansas State': 'Kansas State',
    'Kansas St': 'Kansas State',
    'Missouri': 'Missouri',


    // Add generic "St" expander in function if key not found
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
    'Buffaloes', 'Gophers'
];

export function normalizeTeamName(name: string): string {
    if (!name) return '';
    let processed = name.trim();

    // 1. Direct Overrides
    if (teamNameMap[processed]) return teamNameMap[processed];

    // 2. Expand abbreviations
    processed = processed
        .replace(/\bSt\b\.?/g, 'State')
        .replace(/\bMiss\b\.?/g, 'Mississippi')
        .replace(/\bInt'l\b/g, 'International');

    // 3. Remove known mascots from the end
    for (const mascot of mascots) {
        // Match mascot only if it's the last word or followed by non-letters
        const regex = new RegExp(`\\s+${mascot}\\s*$`, 'i');
        if (regex.test(processed)) {
            processed = processed.replace(regex, '').trim();
            break;
        }
    }

    // 4. Handle "St." specifically again in case it was part of a mascot sequence (rare)

    // 5. Final check against override map with the "cleaned" name
    if (teamNameMap[processed]) return teamNameMap[processed];

    return processed;
}
