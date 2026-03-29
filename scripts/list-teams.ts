import { db } from '../src/lib/firebase';

async function main() {
  const snapshot = await db.collection('nba_team_stats').get();
  const ids = snapshot.docs.map(doc => doc.id).sort();
  console.log('Total teams:', ids.length);
  console.log('Teams:', ids.join(', '));
  process.exit(0);
}
main();
