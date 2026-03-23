
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

if (!process.env.FIREBASE_PROJECT_ID) {
    console.error("Missing env vars");
    process.exit(1);
}

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkSac() {
    console.log("Checking SAC document...");
    const doc = await db.collection('nba_team_stats').doc('SAC').get();
    if (doc.exists) {
        console.log("Document SAC exists.");
        const data = doc.data();
        console.log("Injuries field:", JSON.stringify(data.injuries, null, 2));
    } else {
        console.log("Document SAC does not exist.");
    }
}

checkSac();
