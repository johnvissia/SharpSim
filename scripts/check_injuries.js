
// No require needed for Node 18+ (Node 24 is used)

async function checkInjuries() {
    console.log('Fetching ESPN injury data...');
    try {
        const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?enable=injuries');
        const data = await response.json();

        const teamsOfInterest = ['Sacramento Kings'];

        if (data.sports && data.sports[0] && data.sports[0].leagues && data.sports[0].leagues[0] && data.sports[0].leagues[0].teams) {
            data.sports[0].leagues[0].teams.forEach((teamData) => {
                const team = teamData.team;
                if (teamsOfInterest.includes(team.displayName)) {
                    console.log(`\nRaw data for ${team.displayName}:`);
                    console.log(JSON.stringify(team, null, 2));
                }
            });
        }

    } catch (error) {
        console.error('Error fetching injuries:', error);
    }
}

checkInjuries();
