'use server';

import type { Tank01Game, Tank01Player, Tank01PlayerProp } from "@/lib/types";
import { nbaTeamAbbreviationToName, mapTank01MarketToApp } from "@/lib/nba-data";

export async function getPlayerProps(): Promise<Tank01Game[]> {
    const rapidApiKey = process.env.NEXT_PUBLIC_RAPIDAPI_KEY;
    const rapidApiHost = process.env.NEXT_PUBLIC_RAPIDAPI_HOST;

    if (!rapidApiKey || !rapidApiHost) {
        console.error("RapidAPI key or host is not configured.");
        throw new Error("API credentials are not configured on the server.");
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    const gameDate = `${year}${month}${day}`;

    const url = `https://tank01-fantasy-stats.p.rapidapi.com/getNBABettingOdds?gameDate=${gameDate}&itemFormat=json`;
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': rapidApiHost,
        },
        // Revalidate every hour
        next: { revalidate: 3600 }
    };

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Failed to fetch player props from Tank01 API:", response.status, errorText);
            throw new Error(`Tank01 API Error: ${response.statusText}`);
        }
        
        const propsData = await response.json();
        const apiGames = propsData.body?.game;

        if (!apiGames || apiGames.length === 0) {
            console.log("No player props available from Tank01 for today.");
            return [];
        }

        const formattedGames: Tank01Game[] = apiGames.map((apiGame: any) => {
            const playersMap = new Map<string, Tank01Player>();

            if (apiGame.PlayerProps) {
                apiGame.PlayerProps.forEach((prop: any) => {
                    const market = mapTank01MarketToApp(prop.PropType);
                    if (!market) return; // Skip unknown prop types

                    const playerId = prop.PlayerID.toString();

                    if (!playersMap.has(playerId)) {
                        playersMap.set(playerId, {
                            playerId: playerId,
                            playerName: prop.PlayerName,
                            props: [],
                        });
                    }

                    const player = playersMap.get(playerId)!;
                    player.props.push({
                        propId: `${apiGame.gameID}-${playerId}-${market}`,
                        market: market,
                        line: prop.StatValue,
                        overOdds: prop.OverPrice,
                        underOdds: prop.UnderPrice,
                    });
                });
            }
            
            const homeFullName = nbaTeamAbbreviationToName[apiGame.HomeTeam] || apiGame.HomeTeam;
            const awayFullName = nbaTeamAbbreviationToName[apiGame.AwayTeam] || apiGame.AwayTeam;

            return {
                gameId: apiGame.gameID,
                homeTeam: homeFullName,
                awayTeam: awayFullName,
                matchup: `${awayFullName} @ ${homeFullName}`,
                gameTime: apiGame.gameTime,
                players: Array.from(playersMap.values()),
            };
        });

        return formattedGames;

    } catch (error) {
        console.error("An error occurred during the player prop fetching process:", error);
        throw new Error("Failed to fetch data from the props API.");
    }
}
