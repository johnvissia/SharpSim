from nba_api.stats.endpoints import playergamelogs
import json

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

print("Initializing PlayerGameLogs with headers...", flush=True)
try:
    logs = playergamelogs.PlayerGameLogs(season_nullable='2024-25', headers=custom_headers, timeout=15)
    data = json.loads(logs.get_json())
    result_set = data['resultSets'][0]
    print("Headers (columns):")
    print(result_set['headers'])
    print("Sample row:")
    if len(result_set['rowSet']) > 0:
        print(result_set['rowSet'][0])
    else:
        print("No rows found")
except Exception as e:
    print(f"Error: {e}", flush=True)
