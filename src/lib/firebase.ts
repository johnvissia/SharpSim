import { Buffer } from 'buffer';

// Polyfill SlowBuffer for Node 22+ / Webpack serverless environments
if (typeof (Buffer as any).SlowBuffer === 'undefined') {
    (Buffer as any).SlowBuffer = Buffer;
}
if (typeof globalThis !== 'undefined' && (globalThis as any).Buffer && typeof (globalThis as any).Buffer.SlowBuffer === 'undefined') {
    (globalThis as any).Buffer.SlowBuffer = (globalThis as any).Buffer;
}

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env.local if present (useful in local dev)
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

function initAdmin() {
    if (getApps().length > 0) {
        return getApps()[0];
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (privateKey) {
        // Strip surrounding quotes if present
        if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
            privateKey = privateKey.substring(1, privateKey.length - 1);
        }
        privateKey = privateKey.replace(/\\n/g, '\n');
    }

    if (projectId && clientEmail && privateKey) {
        try {
            return initializeApp({
                credential: cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
            });
        } catch (e: any) {
            console.error('Failed to initialize Firebase Admin with service account:', e.message);
            throw e;
        }
    } else {
        try {
            return initializeApp();
        } catch (adcError: any) {
            console.warn(`[Firebase Admin] Fallback failed: ${adcError.message}`);
            return initializeApp();
        }
    }
}

const adminApp = initAdmin();

export const db = getFirestore(adminApp);
export const auth = getAuth(adminApp);
export default adminApp;
