async function getMLB() {
  const d = new Date();
  // Fetch games from next week or whenever Opening day/Spring training is to ensure we get some games
  const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=20240328');
  const data = await res.json();
  if (!data.events || data.events.length === 0) {
     console.log("No events found. Trying a regular season date from 2024.");
     const res2 = await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=20240815');
     const data2 = await res2.json();
     if(data2.events) {
       console.log(JSON.stringify(data2.events[0].competitions[0].competitors[0], null, 2));
     }
  } else {
     console.log(JSON.stringify(data.events[0].competitions[0].competitors[0], null, 2));
  }
}
getMLB();
