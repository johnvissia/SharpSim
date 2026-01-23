import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
    try {
        // Use application default credentials in a GCP environment.
        // This is the recommended way for server-side code.
        admin.initializeApp();
    } catch (e) {
        console.error('Firebase admin initialization error', e);
    }
}

// Export the admin firestore instance for use in server-side API routes
export const db = admin.firestore();
