
require('dotenv').config({ path: '.env.local' });
const { updateAllTeamInjuries } = require('./src/lib/services/nba-injuries');

async function debug() {
    console.log('Starting sync...');
    try {
        const count = await updateAllTeamInjuries();
        console.log(`Sync complete. Updated ${count} teams.`);
    } catch (err) {
        console.error('Sync failed:', err);
    }
}

debug();
