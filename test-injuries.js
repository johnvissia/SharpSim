const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function check() {
  const teams = ['BOS', 'HOU', 'DEN'];
  
  for (const abv of teams) {
    const doc = await db.collection('nba_team_stats').doc(abv).get();
    const data = doc.data();
    console.log(`\n--- ${abv} ---`);
    if (data && data.injuries) {
       console.log(`Injuries count: ${data.injuries.length}`);
       data.injuries.forEach(inj => {
           console.log(`- ${inj.name}: ${inj.status}`);
       });
       console.log(`Power Ratings injuryAdjustment: ${data.powerRatings?.injuryAdjustment}`);
    } else {
       console.log('No injuries array found.');
    }
  }
}
check();
