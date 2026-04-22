'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It throws any received error to be caught by Next.js's global-error.tsx.
 */
export function FirebaseErrorListener() {
  // Use the specific error type for the state for type safety.
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    // The callback now expects a strongly-typed error, matching the event payload.
    const handleError = (error: FirestorePermissionError) => {
      // Set error in state to trigger a re-render.
      setError(error);
    };

    // The typed emitter will enforce that the callback for 'permission-error'
    // matches the expected payload type (FirestorePermissionError).
    errorEmitter.on('permission-error', handleError);

    // Unsubscribe on unmount to prevent memory leaks.
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  // On re-render, if an error exists in state, render an overlay instead of throwing.
  if (error) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[999999999] bg-red-600 text-white p-8 text-2xl font-bold border-b-8 border-red-900 flex flex-col justify-center items-center">
        <p>🚨 FIREBASE PATH ERROR 🚨</p>
        <p className="text-yellow-300 bg-black p-4 mt-4 rounded-xl text-3xl font-mono break-all">
          Operation: {error.operation} | Path: {error.path}
        </p>
        <button onClick={() => setError(null)} className="mt-6 bg-white text-black px-6 py-2 rounded-full text-xl hover:bg-gray-200">
          Dismiss
        </button>
      </div>
    );
  }

  // This component renders nothing when there is no error.
  return null;
}
