export function getAuthErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred. Please try again.';

  const code = error.code || '';
  const message = error.message || '';

  switch (code) {
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please verify your credentials and try again.';
    case 'auth/user-not-found':
      return 'No account found with this email address. Please sign up or check for typos.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again or use "Forgot password?" to reset it.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email address. Please log in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This user account has been disabled. Please contact support for assistance.';
    case 'auth/too-many-requests':
      return 'Access to this account has been temporarily disabled due to many failed login attempts. Please wait a few minutes or reset your password.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled before completing.';
    case 'auth/cancelled-popup-request':
      return 'Only one popup request is allowed at a time.';
    case 'auth/network-request-failed':
      return 'Network connection error. Please check your internet connection and try again.';
    case 'auth/operation-not-allowed':
      return 'This sign-in provider is not enabled in the Firebase console.';
    case 'auth/requires-recent-login':
      return 'This action requires recent authentication. Please log in again to continue.';
    case 'auth/quota-exceeded':
      return 'Authentication quota exceeded. Please try again later.';
    default:
      // Strip any Firebase error wrappers like "Firebase: Error (auth/...)."
      if (typeof message === 'string') {
        const cleaned = message.replace(/^Firebase:\s*Error\s*\([^)]+\):?\s*/i, '').trim();
        if (cleaned) return cleaned;
      }
      return 'Authentication failed. Please try again.';
  }
}
