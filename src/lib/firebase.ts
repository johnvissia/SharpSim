import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Force load .env.local to ensure environment variables are available
const envPath = path.join(process.cwd(), '.env.local');
console.log(`[Firebase Debug] Current Working Directory: ${process.cwd()}`);
console.log(`[Firebase Debug] Looking for .env.local at: ${envPath}`);
console.log(`[Firebase Debug] .env.local exists: ${fs.existsSync(envPath)}`);

if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    console.log(`[Firebase Debug] dotenv.config result:`, result.error ? 'Error' : 'Success');
}

if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    console.log(`[Firebase Debug] FIREBASE_PROJECT_ID: ${projectId ? 'Set' : 'MISSING'}`);
    console.log(`[Firebase Debug] FIREBASE_CLIENT_EMAIL: ${clientEmail ? 'Set' : 'MISSING'}`);
    console.log(`[Firebase Debug] FIREBASE_PRIVATE_KEY: ${privateKey ? 'Set' : 'MISSING'}`);

    if (privateKey) {
        // Remove surrounding quotes if they exist
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
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
            console.error('Failed to initialize Firebase Admin:', e.message);
            throw e;
        }
    } else {
        const missing = [];
        if (!projectId) missing.push('FIREBASE_PROJECT_ID');
        if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
        if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');
        throw new Error(`Missing Firebase environment variables: ${missing.join(', ')}`);
    }
}

export const db = admin.firestore();
