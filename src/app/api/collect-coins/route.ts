import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/lib/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { resilientGetDoc, setRestDoc } from '@/lib/firestore-rest';

export const dynamic = 'force-dynamic';

const DAILY_REWARD_COINS = 50;
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCsZFIQYt7yAUpRKM1-KZB0dg36_0WBSQE';

async function verifyToken(idToken: string): Promise<string | null> {
  // 1. Try Firebase Admin SDK verification
  try {
    const decoded = await auth.verifyIdToken(idToken);
    if (decoded?.uid) return decoded.uid;
  } catch (err: any) {
    // Admin SDK failed, fall back to Identity Toolkit REST
  }

  // 2. Resilient fallback: Google Identity Toolkit REST verification
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.users && data.users[0]?.localId) {
        return data.users[0].localId;
      }
    }
  } catch (err: any) {
    console.error('[collect-coins] Identity Toolkit verification error:', err.message);
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Missing auth token.' }, { status: 401 });
    }

    const idToken = authHeader.substring(7);
    const uid = await verifyToken(idToken);

    if (!uid) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token or expired session.' }, { status: 401 });
    }

    // Resiliently fetch user profile (Admin SDK with REST fallback)
    const userData = await resilientGetDoc<any>('users', uid);

    if (!userData) {
      return NextResponse.json({ success: false, error: 'User profile not found.' }, { status: 404 });
    }

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

    const newTimestamp = new Date(now).toISOString();
    const currentBalance = Number(userData.balance) || 0;
    const newBalance = currentBalance + DAILY_REWARD_COINS;

    // Try Admin SDK update first
    let updated = false;
    try {
      const userRef = db.collection('users').doc(uid);
      await userRef.update({
        balance: FieldValue.increment(DAILY_REWARD_COINS),
        lastCoinCollection: newTimestamp,
        updatedAt: FieldValue.serverTimestamp(),
      });
      updated = true;
    } catch (adminErr: any) {
      console.warn('[collect-coins] Admin SDK update failed, using resilient REST patch:', adminErr.message);
    }

    // Fallback to REST patch if Admin SDK failed
    if (!updated) {
      await setRestDoc('users', uid, {
        balance: newBalance,
        lastCoinCollection: newTimestamp,
        updatedAt: newTimestamp,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully collected ${DAILY_REWARD_COINS} coins!`,
      reward: DAILY_REWARD_COINS,
      newBalance,
      lastCoinCollection: newTimestamp,
    });

  } catch (error: any) {
    console.error('[collect-coins] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
