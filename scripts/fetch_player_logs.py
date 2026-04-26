import json
import sys
from nba_api.stats.endpoints import playergamelogs
import pandas as pd

def fetch_logs():
    try:
        # season_nullable allows fetching current season automatically
        logs = playergamelogs.PlayerGameLogs(season_nullable='2023-24')
        df = logs.get_data_frames()[0]
        
        # Select important columns
        # Expected cols: PLAYER_ID, PLAYER_NAME, TEAM_ID, TEAM_ABBREVIATION, TEAM_NAME, GAME_ID, GAME_DATE, MATCHUP, WL, MIN, FGM, FGA, FG_PCT, FG3M, FG3A, FG3_PCT, FTM, FTA, FT_PCT, OREB, DREB, REB, AST, TOV, STL, BLK, BLKA, PF, PFD, PTS, PLUS_MINUS
        required_cols = ['PLAYER_NAME', 'GAME_DATE', 'PTS']
        
        if df.empty:
            print(json.dumps([]))
            return
            
        # We only really need to output this as JSON so Node can use it
        records = df[required_cols].to_dict(orient='records')
        print(json.dumps(records))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    fetch_logs()
