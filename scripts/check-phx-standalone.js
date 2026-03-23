
const admin = require('firebase-admin');

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkSuns() {
    console.log('Checking PHX in Firestore...');
    const doc = await db.collection('nba_team_stats').doc('PHX').get();
    if (doc.exists) {
        console.log('PHX Found:', JSON.stringify(doc.data().injuries, null, 2));
    } else {
        console.log('PHX Not Found');
    }
}

checkSuns();
