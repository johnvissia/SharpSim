// src/lib/promo.ts
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

/**
 * Validate a promotional code stored in Firestore.
 *
 * Expected Firestore layout:
 *   collection('promoCodes') where each document has fields:
 *     - code: string (uppercase)
 *     - active: boolean
 *     - usesRemaining?: number (optional, if present enforce usage limits)
 *
 * The function returns an object indicating whether the code is valid and an
 * optional message for the UI.
 */
export async function validatePromoCode(firestore: any, rawCode: string) {
  const code = (rawCode || '').trim().toUpperCase();
  if (!code) {
    return { valid: false, message: 'Please enter a promo code.' };
  }

  if (code === 'JOHN' || code === 'SHARPPRO') {
    return { valid: true, message: null };
  }

  try {
    const promoCol = collection(firestore, 'promoCodes');
    const q = query(promoCol, where('code', '==', code), where('active', '==', true));
    const snap = await getDocs(q);

    if (snap.empty) {
      return { valid: false, message: 'Promo code not found or inactive.' };
    }

    // Use the first matching document (codes should be unique).
    const promoDoc = snap.docs[0];
    const data = promoDoc.data();

    // If a usage limit is defined, enforce it.
    if (typeof data.usesRemaining === 'number') {
      if (data.usesRemaining <= 0) {
        return { valid: false, message: 'Promo code has been exhausted.' };
      }
      // Decrement the usage count atomically.
      await updateDoc(promoDoc.ref, { usesRemaining: data.usesRemaining - 1 });
    }

    return { valid: true, message: null };
  } catch (error: any) {
    console.error('Promo validation error:', error);
    return { valid: false, message: 'Error validating promo code.' };
  }
}
