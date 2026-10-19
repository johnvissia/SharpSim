import { db } from '@/lib/firebase';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'studio-5044041186-4b498';
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCsZFIQYt7yAUpRKM1-KZB0dg36_0WBSQE';

export function parseFirestoreValue(val: any): any {
    if (!val) return null;
    if ('stringValue' in val) return val.stringValue;
    if ('integerValue' in val) return parseInt(val.integerValue, 10);
    if ('doubleValue' in val) return parseFloat(val.doubleValue);
    if ('booleanValue' in val) return val.booleanValue;
    if ('nullValue' in val) return null;
    if ('timestampValue' in val) return val.timestampValue;
    if ('mapValue' in val) {
        const res: Record<string, any> = {};
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

export function toFirestoreValue(val: any): any {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (typeof val === 'number') {
        if (Number.isInteger(val)) return { integerValue: val.toString() };
        return { doubleValue: val };
    }
    if (Array.isArray(val)) {
        return { arrayValue: { values: val.map(toFirestoreValue) } };
    }
    if (typeof val === 'object') {
        const fields: Record<string, any> = {};
        for (const [k, v] of Object.entries(val)) {
            if (v !== undefined) fields[k] = toFirestoreValue(v);
        }
        return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
}

let cachedAuthToken: string | null = null;
let authTokenExpiresAt = 0;

export async function getFirebaseAuthToken(): Promise<string> {
    if (cachedAuthToken && Date.now() < authTokenExpiresAt - 60000) {
        return cachedAuthToken;
    }
    try {
        const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ returnSecureToken: true })
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Auth sign-up failed: ${res.status} ${errText}`);
        }
        const data = await res.json();
        cachedAuthToken = data.idToken;
        authTokenExpiresAt = Date.now() + parseInt(data.expiresIn || '3600', 10) * 1000;
        return cachedAuthToken!;
    } catch (e: any) {
        console.error('[firestore-rest] getFirebaseAuthToken error:', e.message);
        throw e;
    }
}

export async function getRestCollectionDocs<T = any>(collectionName: string, pageSize = 300): Promise<T[]> {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}?key=${API_KEY}&pageSize=${pageSize}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`getRestCollectionDocs failed: ${res.statusText}`);
    }
    const data = await res.json();
    const docs = data.documents || [];
    return docs.map((d: any) => {
        const id = d.name.split('/').pop();
        const obj: any = { id };
        for (const [k, v] of Object.entries(d.fields || {})) {
            obj[k] = parseFirestoreValue(v);
        }
        return obj as T;
    });
}

export async function updateRestDoc(collectionName: string, docId: string, data: Record<string, any>): Promise<any> {
    const token = await getFirebaseAuthToken();
    const fields: Record<string, any> = {};
    const fieldPaths: string[] = [];

    for (const [k, v] of Object.entries(data)) {
        fields[k] = toFirestoreValue(v);
        fieldPaths.push(`updateMask.fieldPaths=${encodeURIComponent(k)}`);
    }

    const docPath = `projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}/${encodeURIComponent(docId)}`;
    const url = `https://firestore.googleapis.com/v1/${docPath}?${fieldPaths.join('&')}`;

    const res = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ fields })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`updateRestDoc error on ${docId}: ${res.status} ${err}`);
    }
    return await res.json();
}

export async function setRestDoc(collectionName: string, docId: string, data: Record<string, any>): Promise<any> {
    const token = await getFirebaseAuthToken();
    const fields: Record<string, any> = {};

    for (const [k, v] of Object.entries(data)) {
        fields[k] = toFirestoreValue(v);
    }

    const docPath = `projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}/${encodeURIComponent(docId)}`;
    const url = `https://firestore.googleapis.com/v1/${docPath}`;

    const res = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ fields })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`setRestDoc error on ${docId}: ${res.status} ${err}`);
    }
    return await res.json();
}

/**
 * Resilient helper to fetch a collection: tries Admin SDK first, falls back to REST
 */
export async function resilientGetCollection<T = any>(collectionName: string, limit = 500): Promise<T[]> {
    try {
        const snap = await db.collection(collectionName).limit(limit).get();
        return snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as T[];
    } catch (err: any) {
        console.warn(`[firestore-rest] Admin SDK failed on ${collectionName}, falling back to REST:`, err.message);
        return await getRestCollectionDocs<T>(collectionName, limit);
    }
}

/**
 * Resilient helper to update a document: tries Admin SDK first, falls back to REST
 */
export async function resilientUpdateDoc(collectionName: string, docId: string, data: Record<string, any>): Promise<void> {
    try {
        await db.collection(collectionName).doc(docId).update(data);
    } catch (err: any) {
        console.warn(`[firestore-rest] Admin SDK update failed on ${docId}, falling back to REST:`, err.message);
        await updateRestDoc(collectionName, docId, data);
    }
}

/**
 * Resilient helper to set a document: tries Admin SDK first, falls back to REST
 */
export async function resilientSetDoc(collectionName: string, docId: string, data: Record<string, any>): Promise<void> {
    try {
        await db.collection(collectionName).doc(docId).set(data);
    } catch (err: any) {
        console.warn(`[firestore-rest] Admin SDK set failed on ${docId}, falling back to REST:`, err.message);
        await setRestDoc(collectionName, docId, data);
    }
}
