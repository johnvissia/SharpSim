import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { db } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Missing or invalid token.' }, { status: 401 });
    }

    const idToken = authHeader.substring(7);
    let uid: string;

    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (e: any) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token.' }, { status: 401 });
    }

    const body = await request.json();
    const { action, paymentMethod, promoCode } = body;

    const userRef = db.collection('users').doc(uid);

    if (action === 'cancel') {
      await userRef.update({
        isPro: false,
        membershipTier: 'Free Tier',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, message: 'Membership canceled successfully.' });
    }

    if (action === 'upgrade') {
      if (paymentMethod === 'card') {
        // Card payment processing
        await userRef.update({
          isPro: true,
          membershipTier: 'Sharp Elite',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return NextResponse.json({ success: true, message: 'Upgraded to Sharp Elite successfully.' });
      }

      if (paymentMethod === 'code') {
        const code = (promoCode || '').trim().toUpperCase();
        if (!code) {
          return NextResponse.json({ success: false, error: 'Please enter a promo code.' }, { status: 400 });
        }

        // Hardcoded VIP promo codes
        if (code === 'JOHN' || code === 'SHARPPRO') {
          await userRef.update({
            isPro: true,
            membershipTier: 'Sharp Elite',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          return NextResponse.json({ success: true, message: 'Promo code applied! Welcome to Sharp Elite.' });
        }

        // Check Firestore promoCodes collection
        const promoSnap = await db.collection('promoCodes')
          .where('code', '==', code)
          .where('active', '==', true)
          .limit(1)
          .get();

        if (promoSnap.empty) {
          return NextResponse.json({ success: false, error: 'Invalid or inactive promo code.' }, { status: 400 });
        }

        const promoDoc = promoSnap.docs[0];
        const promoData = promoDoc.data();

        if (typeof promoData.usesRemaining === 'number') {
          if (promoData.usesRemaining <= 0) {
            return NextResponse.json({ success: false, error: 'This promo code has reached its usage limit.' }, { status: 400 });
          }
          await promoDoc.ref.update({
            usesRemaining: admin.firestore.FieldValue.increment(-1),
          });
        }

        await userRef.update({
          isPro: true,
          membershipTier: 'Sharp Elite',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ success: true, message: 'Promo code applied! Welcome to Sharp Elite.' });
      }

      return NextResponse.json({ success: false, error: 'Invalid payment method.' }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: 'Invalid action.' }, { status: 400 });

  } catch (error: any) {
    console.error('[redeem-promo] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
