import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/lib/firebase';
import { FieldValue } from 'firebase-admin/firestore';

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
      const decoded = await auth.verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token.' }, { status: 401 });
    }

    // 1. Delete all bets
    const betsRef = db.collection('users').doc(uid).collection('bets');
    const betsSnap = await betsRef.get();
    const batch = db.batch();

    betsSnap.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 2. Delete all activity
    const activityRef = db.collection('users').doc(uid).collection('activity');
    const activitySnap = await activityRef.get();
    activitySnap.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 3. Reset preferences & starting balance
    const userRef = db.collection('users').doc(uid);
    batch.update(userRef, {
      balance: 100,
      preferences: {
        sports: {},
        betTypes: {},
        teams: {},
        players: {},
        conferences: {},
        performance: { wins: 0, losses: 0, pushes: 0 }
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: 'Your betting history and performance stats have been successfully reset.',
    });

  } catch (error: any) {
    console.error('[reset-history] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
