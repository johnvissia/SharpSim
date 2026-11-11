import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { auth } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

const DAILY_REWARD_COINS = 50;
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Missing auth token.' }, { status: 401 });
    }

    const idToken = authHeader.substring(7);
    let uid: string;

    try {
      const decoded = await auth.verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token.' }, { status: 401 });
    }

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ success: false, error: 'User profile not found.' }, { status: 404 });
    }

    const userData = userDoc.data() || {};
    const now = Date.now();
    const lastCollected = userData.lastCoinCollection ? new Date(userData.lastCoinCollection).getTime() : 0;
    const timeSinceLast = now - lastCollected;

    if (timeSinceLast < COOLDOWN_MS) {
      const remainingMs = COOLDOWN_MS - timeSinceLast;
      const hoursRemaining = Math.ceil(remainingMs / (1000 * 60 * 60));
      return NextResponse.json({
        success: false,
        error: `Daily reward is on cooldown. Please check back in ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}.`,
        nextAvailable: new Date(lastCollected + COOLDOWN_MS).toISOString(),
      }, { status: 429 });
    }

    // Award coins and record collection timestamp
    const newTimestamp = new Date(now).toISOString();
    await userRef.update({
      balance: FieldValue.increment(DAILY_REWARD_COINS),
      lastCoinCollection: newTimestamp,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const currentBalance = (userData.balance || 0) + DAILY_REWARD_COINS;

    return NextResponse.json({
      success: true,
      message: `Successfully collected ${DAILY_REWARD_COINS} coins!`,
      reward: DAILY_REWARD_COINS,
      newBalance: currentBalance,
      lastCoinCollection: newTimestamp,
    });

  } catch (error: any) {
    console.error('[collect-coins] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
