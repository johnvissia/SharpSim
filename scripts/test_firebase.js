const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const admin = require('firebase-admin');

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey) {
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
}

try {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey
        })
    });

    const db = admin.firestore();
    db.collection('model_predictions').limit(3).get().then(snap => {
        console.log('SUCCESS! Found predictions count:', snap.size);
        snap.forEach(doc => console.log('Doc:', doc.id, doc.data().sport, doc.data().homeTeam, 'vs', doc.data().awayTeam));
        process.exit(0);
    }).catch(err => {
        console.error('Firestore Error:', err.message);
        process.exit(1);
    });
} catch (err) {
    console.error('Init Error:', err.message);
    process.exit(1);
}
