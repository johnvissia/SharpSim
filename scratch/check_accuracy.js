const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const dotenv = require('dotenv');

dotenv.config();

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

async function check() {
  const snapshot = await db.collection('model_predictions').get();
  console.log('Total predictions in Firestore:', snapshot.size);
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`Doc ID: ${doc.id} | Sport: ${data.sport} | Matchup: ${data.awayTeam} @ ${data.homeTeam} | Status: ${data.status} | Signal: ${data.betSignal}`);
  });
}

check().catch(console.error);
