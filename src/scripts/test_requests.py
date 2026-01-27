
import requests
import json
import sys

url = "https://stats.nba.com/stats/leaguegamefinder"
headers = {
    'Host': 'stats.nba.com',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://www.nba.com/',
    'Origin': 'https://www.nba.com',
    'x-nba-stats-origin': 'stats',
    'x-nba-stats-token': 'true',
}
params = {
    'PlayerOrTeam': 'T',
    'LeagueID': '00', # NBA
    'Season': '2024-25',
    'DateFrom': '',
    'DateTo': '',
    'Outcome': '',
    'SeasonType': 'Regular Season', # Or empty
    'TeamID': '1610612738' # Celtics
}

print(f"Fetching {url}...", flush=True)
try:
    resp = requests.get(url, headers=headers, params=params, timeout=10)
    print(f"Status: {resp.status_code}", flush=True)
    if resp.status_code == 200:
        data = resp.json()
        result_count = len(data['resultSets'][0]['rowSet'])
        print(f"Success! Got {result_count} rows.", flush=True)
        # print(json.dumps(data, indent=2))
    else:
        print(f"Failed: {resp.text[:200]}", flush=True)
except Exception as e:
    print(f"Error: {e}", flush=True)
