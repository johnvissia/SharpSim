const url = 'https://stats.nba.com/stats/playergamelogs?Season=2024-25&SeasonType=Regular+Season&PlayerOrTeam=P&LeagueID=00&DateFrom=04/10/2025';
const headers = {
    'Host': 'stats.nba.com',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://www.nba.com/',
    'Origin': 'https://www.nba.com',
    'x-nba-stats-origin': 'stats',
    'x-nba-stats-token': 'true',
};

async function run() {
    console.log("Fetching player game logs filtered by DateFrom...");
    try {
        const res = await fetch(url, { headers });
        console.log("Status:", res.status);
        if (res.ok) {
            const data = await res.json();
            const resultSet = data.resultSets[0];
            console.log("Row count:", resultSet.rowSet.length);
            if (resultSet.rowSet.length > 0) {
                console.log("Sample row GAME_DATE:", resultSet.rowSet[0][resultSet.headers.indexOf('GAME_DATE')]);
                console.log("Min row GAME_DATE:", resultSet.rowSet[resultSet.rowSet.length - 1][resultSet.headers.indexOf('GAME_DATE')]);
            }
        } else {
            console.log("Failed to fetch:", await res.text());
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
