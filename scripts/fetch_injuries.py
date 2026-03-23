
import json
import sys
import os
from datetime import datetime, timedelta
import pytz

# Add the scripts directory to sys.path so we can import from nbainjuries_custom
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from nbainjuries_custom import injury
    from nbainjuries_custom._exceptions import URLRetrievalError
except ImportError as e:
    print(json.dumps({"error": f"Failed to import nbainjuries_custom: {str(e)}"}), file=sys.stderr)
    sys.exit(1)

def get_latest_report():
    # NBA reports are usually at 13:30, 17:30, 20:30 ET
    et_tz = pytz.timezone('US/Eastern')
    now = datetime.now(et_tz)
    
    # Candidate times for today and yesterday
    candidate_times = []
    
    for day_offset in [0, 1]:
        d = now - timedelta(days=day_offset)
        # Times are roughly 01:30 PM, 05:30 PM, 08:30 PM
        # In 24h: 13:30, 17:30, 20:30
        for hour, minute in [(20, 30), (17, 30), (13, 30)]:
            candidate_dt = d.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if candidate_dt <= now:
                candidate_times.append(candidate_dt)
                
    # Try each candidate
    for dt in candidate_times:
        try:
            # print(f"Checking {dt}", file=sys.stderr)
            # The library expects timezone-naive object or handles it?
            # _gen_url uses strftime, so naive is safer or ensure it behaves well.
            # _util.py just does .date() and .time() so timezone info might be lost/ignored but date/time values preserved.
            # We should pass naive datetime representing ET time.
            dt_naive = dt.replace(tzinfo=None)
            
            if injury.check_reportvalid(dt_naive):
                # print(f"Found valid report at {dt_naive}", file=sys.stderr)
                return injury.get_reportdata(dt_naive, return_df=False)
        except Exception as e:
            print(f"Error fetching report for {dt}: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            continue
            
    raise Exception("No valid injury report found for recent times.")

def fetch_injuries():
    try:
        # Fetch active injuries
        injuries_json = get_latest_report()
        
        # injuries_json is a JSON string because return_df=False
        injuries = json.loads(injuries_json)
        
        formatted_injuries = []
        
        for item in injuries:
            # Map fields. valid columns: 'Game Date', 'Game Time', 'Matchup', 'Team', 'Player Name', 'Current Status', 'Reason'
            formatted_injury = {
                "name": item.get('Player Name', ''),
                "team": item.get('Team', ''), 
                "status": item.get('Current Status', 'Unknown'),
                "description": item.get('Reason', ''),
                "updated_at": item.get('Game Date', datetime.now().strftime("%Y-%m-%d"))
            }
            
            if formatted_injury['name']:
                formatted_injuries.append(formatted_injury)

        print(json.dumps(formatted_injuries))
            
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    fetch_injuries()
