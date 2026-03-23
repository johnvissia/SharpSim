import { spawn } from 'child_process';
import path from 'path';
import { db } from '@/lib/firebase';
import { nbaTeamAbbreviationToName } from '@/lib/nba-data';

// Create reverse mapping for team names
const teamNameToAbv: Record<string, string> = Object.entries(nbaTeamAbbreviationToName).reduce((acc, [abv, name]) => {
    acc[name] = abv;
    return acc;
}, {} as Record<string, string>);

function normalizeTeamName(name: string): string | null {
    if (!name) return null;
    const clean = name.trim();
    if (teamNameToAbv[clean]) return clean;

    // Check for partial matches (e.g. "Boston" matching "Boston Celtics")
    const entry = Object.entries(nbaTeamAbbreviationToName).find(([_, fullName]) =>
        fullName.toLowerCase().includes(clean.toLowerCase()) ||
        clean.toLowerCase().includes(fullName.toLowerCase())
    );

    return entry ? entry[1] : null;
}

export async function updateAllTeamInjuries(): Promise<number> {
    console.log('🔄 Starting full injury update from nbainjuries (local python script)...');

    try {
        const injuriesByTeam = await fetchInjuriesFromPython();
        const batch = db.batch();
        let updatedCount = 0;

        // Iterate over all known teams to ensure we update even if they have 0 injuries (though fetchInjuries might only return injured players)
        // Actually, we should clear injuries for teams that are not in the report?
        // nba-injuries.ts returns only players with injuries.
        // If a team is missing from the report, it likely has no injuries reported?
        // Or we should iterate over all potential teams (from nbaTeamAbbreviationToName) and update them.

        const allTeamAbvs = Object.keys(nbaTeamAbbreviationToName);

        for (const abv of allTeamAbvs) {
            const teamName = nbaTeamAbbreviationToName[abv];
            const injuries = injuriesByTeam[teamName] || [];

            if (abv === 'PHX' || injuries.length > 0) {
                console.log(`[InjurySync] Processing ${teamName} (${abv}). Found in report: ${injuries.length} injuries.`);
                if (abv === 'PHX' && injuries.length === 0) {
                    console.log(`[InjurySync] DEBUG: No injuries found in report for "Phoenix Suns". Available keys: ${Object.keys(injuriesByTeam).filter(k => k.includes('Suns') || k.includes('Phoenix'))}`);
                }
            }

            const teamInjuries = injuries.map(inj => ({
                ...inj,
                source: 'nbainjuries' as const
            }));

            const teamRef = db.collection('nba_team_stats').doc(abv);
            try {
                await teamRef.update({
                    injuries: teamInjuries,
                    lastInjuryUpdate: new Date().toISOString()
                });
                updatedCount++;
            } catch (err: any) {
                if (err.code === 5 || err.message?.includes('NOT_FOUND')) {
                    console.warn(`[InjurySync] Document NOT FOUND for ${abv}. Creating it instead.`);
                    await teamRef.set({
                        teamName,
                        abbreviation: abv,
                        injuries: teamInjuries,
                        lastInjuryUpdate: new Date().toISOString()
                    }, { merge: true });
                    updatedCount++;
                } else {
                    console.error(`[InjurySync] Failed to update ${abv}:`, err.message);
                }
            }
        }

        await batch.commit();
        console.log(`🎉 Completed injury update for ${updatedCount} teams via nbainjuries.`);
        return updatedCount;

    } catch (error) {
        console.error('Error updating injuries:', error);
        throw error;
    }
}


export interface PlayerInjury {
    name: string;
    status: string;
    description: string;
    returnDate: string;
    source: 'nbainjuries';
    updatedAt: string;
}

interface RawInjury {
    name: string;
    team: string;
    status: string;
    description: string;
    updated_at: string;
}

export async function fetchInjuriesFromPython(): Promise<Record<string, PlayerInjury[]>> {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(process.cwd(), 'scripts', 'fetch_injuries.py');
        const pythonProcess = spawn('python3', [scriptPath]);

        let dataString = '';
        let errorString = '';

        pythonProcess.stdout.on('data', (data) => {
            dataString += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorString += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`Python script exited with code ${code}`);
                console.error(`Error output: ${errorString}`);
                reject(new Error(`Python script failed: ${errorString}`));
                return;
            }

            try {
                // Extract just the JSON array from the output, avoiding 's' flag for ES compatibility
                const startIndex = dataString.indexOf('[');
                const endIndex = dataString.lastIndexOf(']');
                if (startIndex === -1 || endIndex === -1) {
                    throw new Error('No JSON array found in python output');
                }
                const jsonStr = dataString.substring(startIndex, endIndex + 1);
                const rawInjuries: RawInjury[] = JSON.parse(jsonStr);
                const injuriesByTeam: Record<string, PlayerInjury[]> = {};

                rawInjuries.forEach(injury => {
                    const team = normalizeTeamName(injury.team);
                    if (!team) {
                        console.warn(`[InjurySync] Could not normalize team name: "${injury.team}" for player ${injury.name}`);
                        return;
                    }

                    if (!injuriesByTeam[team]) {
                        injuriesByTeam[team] = [];
                    }

                    injuriesByTeam[team].push({
                        name: injury.name,
                        status: injury.status,
                        description: injury.description,
                        returnDate: '', // nbainjuries might not provide a specific return date field easily
                        source: 'nbainjuries',
                        updatedAt: new Date().toISOString()
                    });
                });

                resolve(injuriesByTeam);

            } catch (error) {
                console.error('Failed to parse Python script output:', error);
                reject(new Error('Failed to parse Python script output'));
            }
        });
    });
}
