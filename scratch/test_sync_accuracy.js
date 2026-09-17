async function testSync() {
  try {
    console.log('Triggering /api/sync-accuracy...');
    const res = await fetch('http://localhost:9002/api/sync-accuracy');
    const data = await res.json();
    console.log('Sync result:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}
testSync();
