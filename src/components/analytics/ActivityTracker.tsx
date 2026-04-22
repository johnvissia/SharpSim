'use client';

import { useEffect, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase/provider';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

function ActivityTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const firestore = useFirestore();

  // Helper to log events to Firestore
  const logEvent = useCallback(
    async (eventType: string, eventData: Record<string, any>) => {
      if (!user || !firestore) return;

      try {
        const activityRef = collection(firestore, 'users', user.uid, 'activity');
        await addDoc(activityRef, {
          type: eventType,
          data: eventData,
          url: window.location.href,
          pathname: window.location.pathname,
          timestamp: serverTimestamp(),
          userAgent: window.navigator.userAgent,
        });
      } catch (error) {
        console.error('Failed to log activity event:', error);
      }
    },
    [user, firestore]
  );

  // Track page views when pathname or searchParams change
  useEffect(() => {
    if (pathname) {
      logEvent('page_view', {
        pathname,
        searchParams: searchParams?.toString() || '',
      });
    }
  }, [pathname, searchParams, logEvent]);

  // Track clicks globally
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Find the closest actionable element (button or link)
      const actionableElement = target.closest('button, a, [role="button"]');
      if (!actionableElement) return;

      // Extract details about what was clicked
      const tagName = actionableElement.tagName.toLowerCase();
      const text = actionableElement.textContent?.trim().slice(0, 50) || '';
      const id = actionableElement.id || '';
      const href = actionableElement.getAttribute('href') || '';
      const ariaLabel = actionableElement.getAttribute('aria-label') || '';

      logEvent('click', {
        element: tagName,
        text,
        id,
        href,
        ariaLabel,
      });
    };

    document.addEventListener('click', handleClick, { capture: true });

    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
    };
  }, [logEvent]);

  return null; // This component doesn't render anything
}

import { Suspense } from 'react';

export function ActivityTracker() {
  return (
    <Suspense fallback={null}>
      <ActivityTrackerInner />
    </Suspense>
  );
}
