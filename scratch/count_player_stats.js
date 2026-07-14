const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env' });

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!serviceAccount.projectId) {
    console.error("Missing FIREBASE_PROJECT_ID in .env");
    process.exit(1);
}

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
    console.log("Counting documents in completed_player_stats...");
    try {
        const snapshot = await db.collection('completed_player_stats').count().get();
        console.log("Total completed_player_stats documents:", snapshot.data().count);
    } catch (e) {
        console.error("Error counting:", e);
    }
    process.exit(0);
}

run();
