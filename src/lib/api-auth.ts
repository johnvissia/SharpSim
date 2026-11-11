import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';
import { ADMIN_UIDS } from './admin';

export async function verifyApiAuth(request: NextRequest): Promise<{ authorized: boolean; errorResponse?: NextResponse }> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('Authorization') || '';
  const searchParams = request.nextUrl.searchParams;
  const keyParam = searchParams.get('key');

  // 1. Validate against CRON_SECRET if provided
  if (cronSecret) {
    if (authHeader === `Bearer ${cronSecret}` || keyParam === cronSecret) {
      return { authorized: true };
    }
  }

  // 2. Validate Firebase Admin Auth ID token for Admins
  if (authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.substring(7);
    try {
      const decoded = await auth.verifyIdToken(idToken);
      if (decoded.admin === true || ADMIN_UIDS.includes(decoded.uid)) {
        return { authorized: true };
      }
    } catch {
      // Token not valid or not an admin
    }
  }

  // 3. In non-production environments with no CRON_SECRET configured, permit access
  if (process.env.NODE_ENV !== 'production' && !cronSecret) {
    return { authorized: true };
  }

  return {
    authorized: false,
    errorResponse: NextResponse.json(
      { success: false, error: 'Unauthorized: A valid CRON_SECRET or Admin authorization token is required.' },
      { status: 401 }
    )
  };
}
