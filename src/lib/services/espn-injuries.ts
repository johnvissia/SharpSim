import { db } from '@/lib/firebase';
import { nbaTeamNameToAbbreviation } from '@/lib/nba-data';

const mlbTeamNameToAbbreviation: Record<string, string> = {
  'Arizona Diamondbacks': 'ARI',
  'Atlanta Braves': 'ATL',
  'Baltimore Orioles': 'BAL',
  'Boston Red Sox': 'BOS',
  'Chicago Cubs': 'CHC',
  'Chicago White Sox': 'CHW',
  'Cincinnati Reds': 'CIN',
  'Cleveland Guardians': 'CLE',
  'Colorado Rockies': 'COL',
  'Detroit Tigers': 'DET',
  'Houston Astros': 'HOU',
  'Kansas City Royals': 'KC',
  'Los Angeles Angels': 'LAA',
  'Los Angeles Dodgers': 'LAD',
  'Miami Marlins': 'MIA',
  'Milwaukee Brewers': 'MIL',
  'Minnesota Twins': 'MIN',
  'New York Mets': 'NYM',
  'New York Yankees': 'NYY',
  'Oakland Athletics': 'OAK',
  'Philadelphia Phillies': 'PHI',
  'Pittsburgh Pirates': 'PIT',
  'San Diego Padres': 'SD',
  'San Francisco Giants': 'SF',
  'Seattle Mariners': 'SEA',
  'St. Louis Cardinals': 'STL',
  'Tampa Bay Rays': 'TB',
  'Texas Rangers': 'TEX',
  'Toronto Blue Jays': 'TOR',
  'Washington Nationals': 'WSH',
};

export async function syncAllInjuriesFromESPN(): Promise<{ nbaCount: number, mlbCount: number }> {
  console.log('🔄 Fetching injuries from ESPN public APIs...');

  let nbaCount = 0;
  let mlbCount = 0;

  // ==================== 1. SYNC NBA INJURIES ====================
  try {
    const nbaUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries';
    const res = await fetch(nbaUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`ESPN NBA injuries returned status ${res.status}`);
    const data = await res.json();
    const teamInjuriesList = data.injuries || [];

    // Pre-populate empty injuries for all known NBA teams to clear healed injuries
    const nbaTeamsMap = new Map<string, any[]>();
    Object.keys(nbaTeamNameToAbbreviation).forEach(name => {
      const abv = nbaTeamNameToAbbreviation[name];
      if (abv) nbaTeamsMap.set(abv, []);
    });

    // Parse fetched NBA injuries
    teamInjuriesList.forEach((teamEntry: any) => {
      const displayName = teamEntry.displayName;
      const abv = nbaTeamNameToAbbreviation[displayName] || (displayName === 'LA Clippers' ? 'LAC' : undefined);
      if (!abv) {
        console.warn(`[NBA Injury Sync] Could not resolve abbreviation for team: ${displayName}`);
        return;
      }

      const injuries = (teamEntry.injuries || []).map((inj: any) => ({
        name: inj.athlete?.displayName || '',
        status: inj.status || 'Out',
        description: inj.shortComment || inj.longComment || '',
        returnDate: inj.status || '',
        source: 'ESPN',
        updatedAt: inj.date || new Date().toISOString()
      }));

      nbaTeamsMap.set(abv, injuries);
    });

    // Write to Firestore in batch
    const batch = db.batch();
    nbaTeamsMap.forEach((injuries, abv) => {
      const ref = db.collection('nba_team_stats').doc(abv);
      batch.set(ref, {
        injuries,
        lastInjuryUpdate: new Date().toISOString()
      }, { merge: true });
      nbaCount++;
    });
    await batch.commit();
    console.log(`✅ Synced NBA injuries for ${nbaCount} teams.`);

  } catch (error) {
    console.error('❌ Failed to sync NBA injuries from ESPN:', error);
  }

  // ==================== 2. SYNC MLB INJURIES ====================
  try {
    const mlbUrl = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/injuries';
    const res = await fetch(mlbUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`ESPN MLB injuries returned status ${res.status}`);
    const data = await res.json();
    const teamInjuriesList = data.injuries || [];

    // Pre-populate empty injuries for all known MLB teams to clear healed injuries
    const mlbTeamsMap = new Map<string, any[]>();
    Object.keys(mlbTeamNameToAbbreviation).forEach(name => {
      const abv = mlbTeamNameToAbbreviation[name];
      if (abv) mlbTeamsMap.set(abv, []);
    });

    // Parse fetched MLB injuries
    teamInjuriesList.forEach((teamEntry: any) => {
      const displayName = teamEntry.displayName;
      const abv = mlbTeamNameToAbbreviation[displayName] || (displayName === 'Athletics' ? 'OAK' : undefined);
      if (!abv) {
        console.warn(`[MLB Injury Sync] Could not resolve abbreviation for team: ${displayName}`);
        return;
      }

      const injuries = (teamEntry.injuries || []).map((inj: any) => ({
        name: inj.athlete?.displayName || '',
        status: inj.status || 'Out',
        description: inj.shortComment || inj.longComment || '',
        returnDate: inj.status || '',
        source: 'ESPN',
        updatedAt: inj.date || new Date().toISOString()
      }));

      mlbTeamsMap.set(abv, injuries);
    });

    // Write to Firestore in batch
    const batch = db.batch();
    mlbTeamsMap.forEach((injuries, abv) => {
      const ref = db.collection('mlb_team_stats').doc(abv);
      batch.set(ref, {
        injuries,
        lastInjuryUpdate: new Date().toISOString()
      }, { merge: true });
      mlbCount++;
    });
    await batch.commit();
    console.log(`✅ Synced MLB injuries for ${mlbCount} teams.`);

  } catch (error) {
    console.error('❌ Failed to sync MLB injuries from ESPN:', error);
  }

  return { nbaCount, mlbCount };
}
