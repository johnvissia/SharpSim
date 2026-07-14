async function run() {
    console.log("Triggering local /api/sync-player-logs endpoint...");
    try {
        const start = Date.now();
        const res = await fetch('http://localhost:9002/api/sync-player-logs', {
            method: 'GET'
        });
        const duration = ((Date.now() - start) / 1000).toFixed(2);
        console.log(`Response Status: ${res.status} (took ${duration}s)`);
        const data = await res.json();
        console.log("Response JSON:", data);
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

run();
