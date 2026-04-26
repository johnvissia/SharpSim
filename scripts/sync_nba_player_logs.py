import os
import json
import logging
from dotenv import load_dotenv

import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from nba_api.stats.endpoints import playergamelogs
import pandas as pd

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    # Load env vars from .env.local
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local')
    load_dotenv(dotenv_path=env_path)

    project_id = os.environ.get('FIREBASE_PROJECT_ID')
    client_email = os.environ.get('FIREBASE_CLIENT_EMAIL')
    private_key = os.environ.get('FIREBASE_PRIVATE_KEY')

    if not all([project_id, client_email, private_key]):
        logger.error("Missing Firebase environment variables in .env.local")
        return

    # Fix private key escaping if needed
    if private_key.startswith('"') and private_key.endswith('"'):
        private_key = private_key[1:-1]
    private_key = private_key.replace('\\n', '\n')

    cred = credentials.Certificate({
        "type": "service_account",
        "project_id": project_id,
        "private_key_id": "api-sync",
        "private_key": private_key,
        "client_email": client_email,
        "client_id": "api-sync",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{client_email.replace('@', '%40')}"
    })
    
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    
    logger.info("Fetching Player Game Logs using nba_api...")
    logs = playergamelogs.PlayerGameLogs(season_nullable='2024-25')
    df = logs.get_data_frames()[0]
    
    if df.empty:
        logger.warning("No game logs found for the current season.")
        return
        
    logger.info(f"Fetched {len(df)} game log records.")
    
    # Process and write to Firestore
    batch = db.batch()
    batch_count = 0
    total_written = 0
    
    for idx, row in df.iterrows():
        player_name = str(row['PLAYER_NAME'])
        game_id = str(row['GAME_ID'])
        pts = int(row['PTS'])
        
        game_date_raw = str(row['GAME_DATE'])
        game_date = game_date_raw.split('T')[0] if 'T' in game_date_raw else game_date_raw
        
        safe_player_name = player_name.replace(' ', '_').replace('/', '_')
        doc_id = f"{safe_player_name}_{game_id}"
        
        doc_ref = db.collection('completed_player_stats').document(doc_id)
        batch.set(doc_ref, {
            'playerName': player_name,
            'gameDate': game_date,
            'stats': {
                'points': pts
            },
            'sys_updated': firestore.SERVER_TIMESTAMP
        }, merge=True)
        
        batch_count += 1
        total_written += 1
        
        if batch_count >= 450:
            batch.commit()
            logger.info(f"Committed {total_written} records so far...")
            batch = db.batch()
            batch_count = 0
            
    if batch_count > 0:
        batch.commit()
        
    logger.info(f"Successfully synced {total_written} player game logs to Firestore.")

if __name__ == '__main__':
    main()
