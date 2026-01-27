
from nba_api.stats.endpoints import leaguegamefinder
import sys

# Custom headers to mimic a browser
custom_headers = {
    'Host': 'stats.nba.com',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://www.nba.com/',
    'Origin': 'https://www.nba.com',
    'x-nba-stats-origin': 'stats',
    'x-nba-stats-token': 'true',
}

print("Initializing LeagueGameFinder with headers...", flush=True)
try:
    gamefinder = leaguegamefinder.LeagueGameFinder(player_or_team_abbreviation='BOS', headers=custom_headers, timeout=10)
    print("Initialized. Getting data...", flush=True)
    df = gamefinder.get_data_frames()[0]
    print(f"Got {len(df)} games", flush=True)
except Exception as e:
    print(f"Error: {e}", flush=True)
