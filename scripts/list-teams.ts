
import { db } from '@/lib/firebase';

async function listTeamIds() {
    console.log('Fetching team IDs...');
    try {
        const snapshot = await db.collection('nba_team_stats').get();
        const ids = snapshot.docs.map((doc: any) => doc.id);
        console.log('Team IDs:', ids.sort().join(', '));
    } catch (err) {
        console.error('Error:', err);
    }
    process.exit(0);
}

listTeamIds();
