import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { db } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.substring(7);
    let uid: string;

    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token.' }, { status: 401 });
    }

    // 1. Delete all subcollections (bets and activity)
    const betsRef = db.collection('users').doc(uid).collection('bets');
    const betsSnap = await betsRef.get();
    const batch = db.batch();

    betsSnap.forEach(doc => {
      batch.delete(doc.ref);
    });

    const activityRef = db.collection('users').doc(uid).collection('activity');
    const activitySnap = await activityRef.get();
    activitySnap.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 2. Delete user profile document
    const userRef = db.collection('users').doc(uid);
    batch.delete(userRef);

    await batch.commit();

    // 3. Delete user from Firebase Auth
    await admin.auth().deleteUser(uid);

    return NextResponse.json({
      success: true,
      message: 'Account and all associated personal data have been permanently deleted.',
    });

  } catch (error: any) {
    console.error('[delete-account] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
