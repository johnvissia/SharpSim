
import { db } from './lib/firebase.js';

async function run() {
    console.log("Checking Phoenix Docs...");
    const snapshot = await db.collection('nba_team_stats').get();
    snapshot.forEach(doc => {
        const data = doc.data();
        if (doc.id.includes('PH') || (data.teamName && data.teamName.includes('Phoenix'))) {
            console.log(`ID: ${doc.id}, Name: ${data.teamName}, Injuries: ${data.injuries?.length || 0}`);
        }
    });
    process.exit(0);
}

run();
