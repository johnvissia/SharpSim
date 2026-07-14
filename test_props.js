const admin = require('firebase-admin');

// Ensure we initialize with the default project ID
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'sharpsim-db', // Or another appropriate project ID if needed
  });
}

const db = admin.firestore();

async function run() {
  const propsSnapshot = await db.collection('player_props').get();
  const allProps = propsSnapshot.docs.map(doc => doc.data());

  console.log(`Total props: ${allProps.length}`);
  if (allProps.length > 0) {
      console.log('Sample commenceTime:', allProps[0].commenceTime);
      console.log('Parsed time:', new Date(allProps[0].commenceTime).getTime());
      console.log('Now:', new Date().getTime());
  }

  const now = new Date().getTime();
  const activeProps = allProps.filter(prop => {
      if (!prop.commenceTime) return true; 
      return new Date(prop.commenceTime).getTime() > now;
  });

  console.log(`Active props after filter: ${activeProps.length}`);
}

run().catch(console.error);
