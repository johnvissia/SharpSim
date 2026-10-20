import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

function parseFirestoreValue(val: any): any {
    if (!val) return null;
    if ('stringValue' in val) return val.stringValue;
    if ('integerValue' in val) return parseInt(val.integerValue, 10);
    if ('doubleValue' in val) return parseFloat(val.doubleValue);
    if ('booleanValue' in val) return val.booleanValue;
    if ('nullValue' in val) return null;
    if ('mapValue' in val) {
        const res: any = {};
        for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
            res[k] = parseFirestoreValue(v);
        }
        return res;
    }
    if ('arrayValue' in val) {
        return (val.arrayValue.values || []).map(parseFirestoreValue);
    }
    return null;
}

async function fetchFromRestApi(limit: number): Promise<any[]> {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'studio-5044041186-4b498';
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCsZFIQYt7yAUpRKM1-KZB0dg36_0WBSQE';
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/model_predictions?key=${apiKey}&pageSize=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`REST API fetch failed: ${res.statusText}`);
    const data = await res.json();
    const docs = data.documents || [];
    return docs.map((d: any) => {
        const id = d.name.split('/').pop();
        const obj: any = { id };
        for (const [k, v] of Object.entries(d.fields || {})) {
            obj[k] = parseFirestoreValue(v);
        }
        return obj;
    });
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sportParam = searchParams.get('sport');
        const limitParam = parseInt(searchParams.get('limit') || '500', 10);

        let predictions: any[] = [];

        try {
            const snapshot = await db
                .collection('model_predictions')
                .orderBy('startTime', 'desc')
                .limit(limitParam)
                .get();

            predictions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (dbErr) {
            console.warn('[accuracy-data] Admin SDK query failed, using Firestore REST fallback:', dbErr);
            predictions = await fetchFromRestApi(limitParam);
            predictions.sort((a, b) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime());
        }

        if (sportParam && sportParam !== 'ALL') {
            predictions = predictions.filter((p: any) => p.sport?.toUpperCase() === sportParam.toUpperCase());
        }

        // Strictly filter out any pending predictions that are scheduled more than 36 hours away (too far out to predict/lock)
        const now = Date.now();
        predictions = predictions.filter((p: any) => {
            if (p.status === 'pending' && p.startTime) {
                const timeUntilStart = new Date(p.startTime).getTime() - now;
                if (timeUntilStart > 36 * 3600 * 1000) {
                    return false;
                }
            }
            return true;
        });

        return NextResponse.json({ predictions });
    } catch (error: any) {
        console.error('[accuracy-data] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
