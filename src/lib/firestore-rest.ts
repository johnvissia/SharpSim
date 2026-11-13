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

export async function getRestDoc<T = any>(collectionName: string, docId: string): Promise<T | null> {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}/${encodeURIComponent(docId)}?key=${API_KEY}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) {
        throw new Error(`getRestDoc failed: ${res.statusText}`);
    }
    const d = await res.json();
    const obj: any = { id: docId };
    for (const [k, v] of Object.entries(d.fields || {})) {
        obj[k] = parseFirestoreValue(v);
    }
    return obj as T;
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

export async function batchSetRestDocs(
    collectionName: string,
    docs: Array<{ id: string; data: Record<string, any> }>
): Promise<void> {
    if (!docs || docs.length === 0) return;
    const token = await getFirebaseAuthToken();
    const CHUNK_SIZE = 400;

    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        const writes = chunk.map(({ id, data }) => {
            const fields: Record<string, any> = {};
            for (const [k, v] of Object.entries(data)) {
                if (v !== undefined) {
                    fields[k] = toFirestoreValue(v);
                }
            }
            return {
                update: {
                    name: `projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}/${encodeURIComponent(id)}`,
                    fields
                }
            };
        });

        const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ writes })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`batchSetRestDocs error on ${collectionName}: ${res.status} ${errText}`);
        }
    }
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

export async function deleteRestDoc(collectionName: string, docId: string): Promise<boolean> {
    const token = await getFirebaseAuthToken();
    const docPath = `projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}/${encodeURIComponent(docId)}`;
    const url = `https://firestore.googleapis.com/v1/${docPath}?key=${API_KEY}`;

    const res = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!res.ok && res.status !== 404) {
        const err = await res.text();
        throw new Error(`deleteRestDoc error on ${docId}: ${res.status} ${err}`);
    }
    return true;
}

/**
 * Resilient helper to fetch a single document: tries Admin SDK first, falls back to REST
 */
export async function resilientGetDoc<T = any>(collectionName: string, docId: string): Promise<T | null> {
    try {
        const doc = await db.collection(collectionName).doc(docId).get();
        if (doc.exists) return { id: doc.id, ...doc.data() } as T;
        return null;
    } catch (err: any) {
        console.warn(`[firestore-rest] Admin SDK failed on ${collectionName}/${docId}, falling back to REST:`, err.message);
        return await getRestDoc<T>(collectionName, docId);
    }
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

/**
 * Resilient helper to delete a document: tries Admin SDK first, falls back to REST
 */
export async function resilientDeleteDoc(collectionName: string, docId: string): Promise<void> {
    try {
        await db.collection(collectionName).doc(docId).delete();
    } catch (err: any) {
        console.warn(`[firestore-rest] Admin SDK delete failed on ${docId}, falling back to REST:`, err.message);
        await deleteRestDoc(collectionName, docId);
    }
}
