import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const now = new Date();
    // Format: YYYYMMDD (e.g., 20260123)
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
    
    // THE FIX: Use 'getNBABettingOdds' with 'playerProps=true'
    const url = `https://${process.env.RAPIDAPI_HOST}/getNBABettingOdds?gameDate=${dateString}&playerProps=true`;
    
    console.log(`🔍 DEBUG: Calling ${url}`);

    const options = {
      method: 'GET',
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
        'x-rapidapi-host': process.env.RAPIDAPI_HOST!
      }
    };

    const response = await fetch(url, options);
    const data = await response.json();

    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    return NextResponse.json({ error: "Failed to run debug", details: String(error) }, { status: 500 });
  }
}
