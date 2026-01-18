/**
 * A mapping of NCAA team names to their respective conferences, focusing on the Power 4.
 * This provides a comprehensive data source for conference filtering.
 * Note: Team names from the Odds API can vary slightly. This map
 * attempts to cover common variations.
 */
export const ncaaConferenceMap: Record<string, string> = {
  // --- ACC (Atlantic Coast Conference) ---
  "Boston College Eagles": "ACC",
  "Boston College": "ACC",
  "California Golden Bears": "ACC",
  "California": "ACC",
  "Clemson Tigers": "ACC",
  "Clemson": "ACC",
  "Duke Blue Devils": "ACC",
  "Duke": "ACC",
  "Florida State Seminoles": "ACC",
  "Florida State": "ACC",
  "Georgia Tech Yellow Jackets": "ACC",
  "Georgia Tech": "ACC",
  "Louisville Cardinals": "ACC",
  "Louisville": "ACC",
  "Miami Hurricanes": "ACC",
  "Miami (FL)": "ACC",
  "Miami": "ACC",
  "NC State Wolfpack": "ACC",
  "NC State": "ACC",
  "North Carolina Tar Heels": "ACC",
  "North Carolina": "ACC",
  "Notre Dame Fighting Irish": "ACC",
  "Notre Dame": "ACC",
  "Pittsburgh Panthers": "ACC",
  "Pittsburgh": "ACC",
  "SMU Mustangs": "ACC",
  "SMU": "ACC",
  "Stanford Cardinal": "ACC",
  "Stanford": "ACC",
  "Syracuse Orange": "ACC",
  "Syracuse": "ACC",
  "Virginia Cavaliers": "ACC",
  "Virginia": "ACC",
  "Virginia Tech Hokies": "ACC",
  "Virginia Tech": "ACC",
  "Wake Forest Demon Deacons": "ACC",
  "Wake Forest": "ACC",

  // --- Big Ten Conference ---
  "Illinois Fighting Illini": "Big 10",
  "Illinois": "Big 10",
  "Indiana Hoosiers": "Big 10",
  "Indiana": "Big 10",
  "Iowa Hawkeyes": "Big 10",
  "Iowa": "Big 10",
  "Maryland Terrapins": "Big 10",
  "Maryland": "Big 10",
  "Michigan Wolverines": "Big 10",
  "Michigan": "Big 10",
  "Michigan State Spartans": "Big 10",
  "Michigan State": "Big 10",
  "Minnesota Golden Gophers": "Big 10",
  "Minnesota": "Big 10",
  "Nebraska Cornhuskers": "Big 10",
  "Nebraska": "Big 10",
  "Northwestern Wildcats": "Big 10",
  "Northwestern": "Big 10",
  "Ohio State Buckeyes": "Big 10",
  "Ohio State": "Big 10",
  "Oregon Ducks": "Big 10",
  "Oregon": "Big 10",
  "Penn State Nittany Lions": "Big 10",
  "Penn State": "Big 10",
  "Purdue Boilermakers": "Big 10",
  "Purdue": "Big 10",
  "Rutgers Scarlet Knights": "Big 10",
  "Rutgers": "Big 10",
  "UCLA Bruins": "Big 10",
  "UCLA": "Big 10",
  "USC Trojans": "Big 10",
  "USC": "Big 10",
  "Washington Huskies": "Big 10",
  "Washington": "Big 10",
  "Wisconsin Badgers": "Big 10",
  "Wisconsin": "Big 10",

  // --- Big 12 Conference ---
  "Arizona Wildcats": "Big 12",
  "Arizona": "Big 12",
  "Arizona State Sun Devils": "Big 12",
  "Arizona State": "Big 12",
  "Baylor Bears": "Big 12",
  "Baylor": "Big 12",
  "BYU Cougars": "Big 12",
  "BYU": "Big 12",
  "Cincinnati Bearcats": "Big 12",
  "Cincinnati": "Big 12",
  "Colorado Buffaloes": "Big 12",
  "Colorado": "Big 12",
  "Houston Cougars": "Big 12",
  "Houston": "Big 12",
  "Iowa State Cyclones": "Big 12",
  "Iowa State": "Big 12",
  "Kansas Jayhawks": "Big 12",
  "Kansas": "Big 12",
  "Kansas State Wildcats": "Big 12",
  "Kansas State": "Big 12",
  "Oklahoma State Cowboys": "Big 12",
  "Oklahoma State": "Big 12",
  "TCU Horned Frogs": "Big 12",
  "TCU": "Big 12",
  "Texas Tech Red Raiders": "Big 12",
  "Texas Tech": "Big 12",
  "UCF Knights": "Big 12",
  "UCF": "Big 12",
  "Utah Utes": "Big 12",
  "Utah": "Big 12",
  "West Virginia Mountaineers": "Big 12",
  "West Virginia": "Big 12",

  // --- SEC (Southeastern Conference) ---
  "Alabama Crimson Tide": "SEC",
  "Alabama": "SEC",
  "Arkansas Razorbacks": "SEC",
  "Arkansas": "SEC",
  "Auburn Tigers": "SEC",
  "Auburn": "SEC",
  "Florida Gators": "SEC",
  "Florida": "SEC",
  "Georgia Bulldogs": "SEC",
  "Georgia": "SEC",
  "Kentucky Wildcats": "SEC",
  "Kentucky": "SEC",
  "LSU Tigers": "SEC",
  "LSU": "SEC",
  "Mississippi State Bulldogs": "SEC",
  "Mississippi State": "SEC",
  "Missouri Tigers": "SEC",
  "Missouri": "SEC",
  "Oklahoma Sooners": "SEC",
  "Oklahoma": "SEC",
  "Ole Miss Rebels": "SEC",
  "Ole Miss": "SEC",
  "South Carolina Gamecocks": "SEC",
  "South Carolina": "SEC",
  "Tennessee Volunteers": "SEC",
  "Tennessee": "SEC",
  "Texas Longhorns": "SEC",
  "Texas": "SEC",
  "Texas A&M Aggies": "SEC",
  "Texas A&M": "SEC",
  "Vanderbilt Commodores": "SEC",
  "Vanderbilt": "SEC"
};

/**
 * Finds the conference for a given team name using a comprehensive map.
 * This function is designed to be resilient to variations in team names from the API.
 * @param teamName The name of the team from the API.
 * @returns The conference name as a string, or undefined if not found.
 */
export function getConference(teamName: string): string | undefined {
    const normalizedTeamName = teamName.toLowerCase().trim();

    // Create a normalized version of the map for consistent lookups
    const normalizedConferenceMap: Record<string, string> = {};
    for (const key in ncaaConferenceMap) {
        normalizedConferenceMap[key.toLowerCase().trim()] = ncaaConferenceMap[key];
    }
    
    // Strategy 1: Direct case-insensitive match
    const directMatch = normalizedConferenceMap[normalizedTeamName];
    if (directMatch) {
      return directMatch;
    }
  
    // Strategy 2: Partial match (check if API name contains a known key)
    // Sort keys by length descending to match longer, more specific names first 
    // (e.g., "Michigan State" before "Michigan").
    const sortedKeys = Object.keys(normalizedConferenceMap).sort((a, b) => b.length - a.length);

    for (const key of sortedKeys) {
        // If the team name from the API contains one of our known team names...
        if (normalizedTeamName.includes(key)) {
            return normalizedConferenceMap[key];
        }
    }
    
    return undefined;
}
