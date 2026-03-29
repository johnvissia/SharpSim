require('dotenv').config({ path: '.env.local' });

async function getOdds() {
  const url = `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?apiKey=${process.env.NEXT_PUBLIC_ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
  console.log("Fetching MLB odds from:", url);
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.length > 0) {
      console.log("Found", data.length, "games.");
      console.log("Sample Game:", JSON.stringify(data[0], null, 2));
    } else {
      console.log("No odds found or error:", data);
    }
  } catch (e) {
    console.error(e);
  }
}

getOdds();
