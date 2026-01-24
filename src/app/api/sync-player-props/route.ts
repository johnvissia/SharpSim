import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log("🟢 ROOT X-RAY STARTED...");
    
    const dateString = "20260123"; 
    const url = `https://${process.env.RAPIDAPI_HOST}/getNBABettingOdds?gameDate=${dateString}&playerProps=true`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
        'x-rapidapi-host': process.env.RAPIDAPI_HOST!
      }
    });

    const data = await response.json();

    console.log("\n📦 --- ROOT X-RAY RESULTS ---");
    console.log("What keys are at the very top?");
    const rootKeys = Object.keys(data);
    console.log(rootKeys);

    // Check if 'body' is a list or has hidden keys
    if (data.body) {
        console.log("Inside 'body', is it an array?", Array.isArray(data.body));
        if (!Array.isArray(data.body)) {
             console.log("Body keys:", Object.keys(data.body));
        }
    }
    console.log("------------------------------\n");

    return NextResponse.json({ 
        message: "Check your Terminal for the ROOT KEYS", 
        rootKeys: rootKeys 
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}