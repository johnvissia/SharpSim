const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function check() {
  const t = await db.collection('nba_team_stats').get();
  console.log('Total teams:', t.size);
  t.forEach(doc => {
    const d = doc.data();
    if (d.abbreviation === 'BOS' || d.abbreviation === 'DET') {
      console.log(d.abbreviation, 'TPR:', d.powerRatings?.baselineTPR, 'SRS:', d.powerRatings?.srsRating, 'Recency:', d.powerRatings?.recencyRating);
    }
  });
}
check();
