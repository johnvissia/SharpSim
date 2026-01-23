
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    const rapidApiHost = process.env.RAPIDAPI_HOST;

    if (!rapidApiKey || !rapidApiHost) {
        console.error("RapidAPI key or host is not configured on the server.");
        return NextResponse.json({ message: "API credentials are not configured on the server." }, { status: 500 });
    }

    const gameDate = "20260123";
    const market = "player_points";
    console.log(`[DEBUG] Fetching props from getNBABettingProps for date: ${gameDate} and market: ${market}`);

    const url = `https://tank01-fantasy-stats.p.rapidapi.com/getNBABettingProps?gameDate=${gameDate}&market=${market}`;
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': rapidApiHost,
        }
    };

    try {
        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            console.error("[DEBUG] Failed to fetch player props from Tank01 API:", response.status, data);
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);

    } catch (error) {
        console.error("[DEBUG] An error occurred during the debug API call:", error);
        if (error instanceof Error) {
            return NextResponse.json({ message: error.message }, { status: 500 });
        }
        return NextResponse.json({ message: 'An unknown error occurred' }, { status: 500 });
    }
}
