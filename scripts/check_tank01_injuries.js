
// Check Tank01 Roster for Injuries
require('dotenv').config({ path: '.env.local' });

async function checkTank01Roster() {
    console.log('Fetching Tank01 Roster data...');
    const key = process.env.RAPIDAPI_KEY;
    const host = process.env.RAPIDAPI_HOST;

    const teams = ['SAC', 'CHI'];

    for (const team of teams) {
        const url = `https://${host}/getNBATeamRoster?teamAbv=${team}&getStats=true`;
        console.log(`Calling ${url}...`);

        const options = {
            method: 'GET',
            headers: {
                'x-rapidapi-key': key,
                'x-rapidapi-host': host
            }
        };

        try {
            const response = await fetch(url, options);
            const data = await response.json();

            if (data.statusCode === 200 && data.body && data.body.roster) {
                const roster = data.body.roster;
                console.log(`\n${team} Roster (${roster.length} players):`);

                // Check for injury status in roster
                roster.forEach(p => {
                    // specific check for the players mentioned by user
                    const relevantPlayers = ['Sabonis', 'Murray', 'Monk', 'Lavine', 'LaVine'];
                    const isRelevant = relevantPlayers.some(name => p.longName.includes(name));

                    if (isRelevant || p.injuryStatus || (p.injury && p.injury.length > 0)) {
                        console.log(`- ${p.longName}: Injury: ${JSON.stringify(p.injury || p.injuryStatus || 'None')}`);
                    }
                });
            } else {
                console.log('Error or unexpected format:', JSON.stringify(data, null, 2).substring(0, 500));
            }

        } catch (error) {
            console.error('Error fetching Tank01 roster:', error);
        }
    }
}

checkTank01Roster();
