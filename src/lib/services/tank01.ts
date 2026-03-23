import { db } from '@/lib/firebase';
import { nbaTeamAbbreviationToName } from '@/lib/nba-data';

interface Tank01Player {
    longName: string;
    injuryStatus: string | null;
    injury?: {
        injReturnDate?: string;
        description?: string;
        injDate?: string;
        designation?: string;
    } | any; // Tank01 sometimes returns array or object
    teamAbv: string;
}

interface PlayerInjury {
    name: string;
    status: string;
    description: string;
    returnDate: string;
    source: 'Tank01';
    updatedAt: string;
}

const TANK01_HOST = process.env.RAPIDAPI_HOST;
const TANK01_KEY = process.env.RAPIDAPI_KEY;

export async function getTeamRoster(teamAbv: string): Promise<Tank01Player[]> {
    if (!TANK01_HOST || !TANK01_KEY) {
        console.error('Missing Tank01 API credentials');
        return [];
    }

    const url = `https://${TANK01_HOST}/getNBATeamRoster?teamAbv=${teamAbv}&getStats=true`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-rapidapi-key': TANK01_KEY,
                'x-rapidapi-host': TANK01_HOST
            },
            next: { revalidate: 0 } // Disable caching to get fresh data
        });

        const data = await response.json();

        if (data.statusCode === 200 && data.body && data.body.roster) {
            return data.body.roster;
        } else {
            console.error(`Error fetching roster for ${teamAbv}:`, data);
            return [];
        }
    } catch (error) {
        console.error(`Exception fetching roster for ${teamAbv}:`, error);
        return [];
    }
}

export async function updateAllTeamInjuries() {
    console.log('🔄 Starting full injury update from Tank01...');

    // Get all NBA teams from our helper or Firestore
    // Using mapping from nba-data.ts
    const teamAbvs = Object.keys(nbaTeamAbbreviationToName);

    let updatedCount = 0;
    const batch = db.batch();

    // Process in chunks or sequentially to avoid rate limits if necessary
    // Tank01 allows concurrent requests but let's be safe with 5 at a time
    const chunk = (arr: string[], size: number) =>
        Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
            arr.slice(i * size, i * size + size)
        );

    const chunks = chunk(teamAbvs, 5);

    for (const group of chunks) {
        await Promise.all(group.map(async (abv) => {
            const roster = await getTeamRoster(abv);
            const teamInjuries: PlayerInjury[] = [];

            roster.forEach(player => {
                // Check if player has injury data
                // Structure varies: sometimes player.injury is object, sometimes array, sometimes just injuryStatus string

                let isInjured = false;
                let status = 'Active';
                let description = '';
                let returnDate = '';

                // Case 1: injuryStatus property is populated
                if (player.injuryStatus && player.injuryStatus !== 'Active' && player.injuryStatus !== 'Healthy') {
                    isInjured = true;
                    status = player.injuryStatus;
                }

                // Case 2: injury object/array exists
                if (player.injury) {
                    if (Array.isArray(player.injury) && player.injury.length > 0) {
                        isInjured = true;
                        status = player.injury[0].designation || status;
                        description = player.injury[0].description || '';
                        returnDate = player.injury[0].injReturnDate || '';
                    } else if (typeof player.injury === 'object' && player.injury.designation) {
                        isInjured = true;
                        status = player.injury.designation || status;
                        description = player.injury.description || '';
                        returnDate = player.injury.injReturnDate || '';
                    }
                }

                if (isInjured) {
                    teamInjuries.push({
                        name: player.longName,
                        status: status,
                        description: description,
                        returnDate: returnDate,
                        source: 'Tank01',
                        updatedAt: new Date().toISOString()
                    });
                }
            });

            // Update Firestore
            const teamRef = db.collection('nba_team_stats').doc(abv);
            batch.update(teamRef, {
                injuries: teamInjuries,
                lastInjuryUpdate: new Date().toISOString()
            });

            console.log(`✅ Updated ${abv}: ${teamInjuries.length} injuries found`);
            updatedCount++;
        }));
    }

    await batch.commit();
    console.log(`🎉 Completed injury update for ${updatedCount} teams.`);
    return updatedCount;
}
