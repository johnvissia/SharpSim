
import { updateAllTeamInjuries } from '../src/lib/services/nba-injuries';

async function debugSync() {
    console.log('Starting debug sync...');
    try {
        await updateAllTeamInjuries();
        console.log('Sync completed.');
    } catch (err) {
        console.error('Sync failed:', err);
    }
    process.exit(0);
}

debugSync();
