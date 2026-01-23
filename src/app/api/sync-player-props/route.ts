
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { PlayerProp } from '@/lib/types';
import { nbaTeamAbbreviationToName, mapTank01MarketToApp } from '@/lib/nba-data';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
    try {
        // Use application default credentials in a GCP environment
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
    } catch (e) {
        console.error('Firebase admin initialization error', e);
    }
}

const db = admin.firestore();

export async function GET(request: Request) {
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    const rapidApiHost = process.env.RAPIDAPI_HOST;

    if (!rapidApiKey || !rapidApiHost) {
        console.error("RapidAPI key or host is not configured on the server.");
        return NextResponse.json({ message: "API credentials are not configured on the server." }, { status: 500 });
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = (tomorrow.getMonth() + 1).toString().padStart(2, '0');
    const day = tomorrow.getDate().toString().padStart(2, '0');
    const gameDate = `${year}${month}${day}`;

    console.log(`Fetching props for: ${gameDate}`);

    const url = `https://tank01-fantasy-stats.p.rapidapi.com/getNBABettingOdds?gameDate=${gameDate}&itemFormat=json`;
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': rapidApiHost,
        }
    };

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Failed to fetch player props from Tank01 API:", response.status, errorText);
            throw new Error(`Tank01 API Error: ${response.statusText}`);
        }
        
        const propsData = await response.json();

        if (propsData.message) {
            console.error("Tank01 API returned a message:", propsData.message);
            throw new Error(`Player Prop API Error: ${propsData.message}`);
        }

        const apiGames = propsData.body?.game;

        if (!apiGames || apiGames.length === 0) {
            return NextResponse.json({ message: `No player props available from Tank01 for ${gameDate}.` });
        }

        const batch = db.batch();
        const propsCollection = db.collection('player_props');
        let propCount = 0;

        apiGames.forEach((apiGame: any) => {
            const homeFullName = nbaTeamAbbreviationToName[apiGame.HomeTeam] || apiGame.HomeTeam;
            const awayFullName = nbaTeamAbbreviationToName[apiGame.AwayTeam] || apiGame.AwayTeam;
            const matchup = `${awayFullName} @ ${homeFullName}`;
            
            if (apiGame.PlayerProps) {
                apiGame.PlayerProps.forEach((prop: any) => {
                    const market = mapTank01MarketToApp(prop.PropType);
                    if (!market) return; // Skip unknown prop types

                    const teamName = nbaTeamAbbreviationToName[prop.Team] || prop.Team;
                    const docId = `${apiGame.gameID}-${prop.PlayerID}-${market}`;
                    const docRef = propsCollection.doc(docId);

                    const propDoc: Omit<PlayerProp, 'id'> = {
                        gameId: apiGame.gameID,
                        playerId: prop.PlayerID.toString(),
                        playerName: prop.PlayerName,
                        teamName: teamName,
                        matchup: matchup,
                        commenceTime: apiGame.gameTime,
                        market: market,
                        line: prop.StatValue,
                        overOdds: prop.OverPrice,
                        underOdds: prop.UnderPrice,
                    };

                    batch.set(docRef, { 
                        ...propDoc, 
                        status: "Pending",
                        fetchedAt: new Date(),
                    }, { merge: true });
                    propCount++;
                });
            }
        });
        
        await batch.commit();

        return NextResponse.json({ message: `Synced ${propCount} props successfully for ${gameDate}.` });

    } catch (error) {
        console.error("An error occurred during the player prop sync process:", error);
        if (error instanceof Error) {
            return NextResponse.json({ message: error.message }, { status: 500 });
        }
        return NextResponse.json({ message: 'An unknown error occurred' }, { status: 500 });
    }
}
