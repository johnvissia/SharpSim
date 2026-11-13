import { Buffer } from 'buffer';

// Polyfill SlowBuffer for Node 22+ / Webpack serverless environments
if (typeof (Buffer as any).SlowBuffer === 'undefined') {
    (Buffer as any).SlowBuffer = Buffer;
}
if (typeof globalThis !== 'undefined' && (globalThis as any).Buffer && typeof (globalThis as any).Buffer.SlowBuffer === 'undefined') {
    (globalThis as any).Buffer.SlowBuffer = (globalThis as any).Buffer;
}

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
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

let _adminApp: any = null;
function getAdminApp() {
    if (!_adminApp) {
        _adminApp = initAdmin();
    }
    return _adminApp;
}

let _db: any = null;
function getDbInstance() {
    if (!_db) {
        try {
            const app = getAdminApp();
            _db = getFirestore(app);
        } catch (e: any) {
            console.warn('[firebase-admin] getFirestore deferred error:', e.message);
        }
    }
    return _db;
}

let _auth: any = null;
function getAuthInstance() {
    if (!_auth) {
        try {
            const app = getAdminApp();
            _auth = getAuth(app);
        } catch (e: any) {
            console.warn('[firebase-admin] getAuth deferred error:', e.message);
        }
    }
    return _auth;
}

export const db: Firestore = new Proxy({}, {
    get(target, prop) {
        const instance = getDbInstance();
        if (!instance) return undefined;
        const val = (instance as any)[prop];
        return typeof val === 'function' ? val.bind(instance) : val;
    }
}) as unknown as Firestore;

export const auth: Auth = new Proxy({}, {
    get(target, prop) {
        const instance = getAuthInstance();
        if (!instance) return undefined;
        const val = (instance as any)[prop];
        return typeof val === 'function' ? val.bind(instance) : val;
    }
}) as unknown as Auth;

export default getAdminApp;
