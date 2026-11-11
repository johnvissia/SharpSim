import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env.local if present (useful in local dev)
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (privateKey) {
        // Strip surrounding quotes if present
        if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
            privateKey = privateKey.substring(1, privateKey.length - 1);
        }
        privateKey = privateKey.replace(/\\n/g, '\n');
    }

    if (projectId && clientEmail && privateKey) {
        try {
            admin.initializeApp({
                credential: admin.credential.cert({
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
        // Fallback to Application Default Credentials for Cloud Run / App Hosting environments
        try {
            admin.initializeApp();
        } catch (adcError: any) {
            const missing = [];
            if (!projectId) missing.push('FIREBASE_PROJECT_ID');
            if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
            if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');
            console.warn(`[Firebase Admin] Missing variables (${missing.join(', ')}). ADC fallback failed: ${adcError.message}`);
        }
    }
}

export const db = admin.firestore();
