'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth, useUser } from '@/firebase';
import { signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { LogIn, Loader2 } from 'lucide-react';
import { GoogleIcon } from '@/components/auth/google-icon';
import { getAuthErrorMessage } from '@/lib/auth-errors';

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  // If already authenticated with permanent account, redirect to dashboard
  useEffect(() => {
    if (!isUserLoading && user && !user.isAnonymous) {
      router.replace('/dashboard');
    }
  }, [user, isUserLoading, router]);

  // Handle redirect result if user signed in via redirect
  useEffect(() => {
    let isMounted = true;
    getRedirectResult(auth)
      .then((result) => {
        if (!isMounted) return;
        if (result?.user) {
          toast({
            title: 'Login Successful',
            description: `Welcome back, ${result.user.displayName || 'Sharp User'}!`,
          });
          router.replace('/dashboard');
        }
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error('Google redirect sign-in error:', error);
        if (error.code === 'auth/popup-closed-by-user') return;
        toast({
          variant: 'destructive',
          title: 'Google Sign-In Failed',
          description: getAuthErrorMessage(error),
        });
      });

    return () => {
      isMounted = false;
    };
  }, [auth, router, toast]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({
        title: 'Login Successful',
        description: 'Welcome back!',
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: getAuthErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn(forceRedirect = false) {
    if (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1') {
      toast({
        title: 'Switching to localhost',
        description: 'Firebase OAuth requires localhost. Redirecting you now...',
      });
      window.location.replace(window.location.href.replace('://127.0.0.1', '://localhost'));
      return;
    }

    setGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    if (forceRedirect) {
      try {
        await signInWithRedirect(auth, provider);
        return;
      } catch (redirectError: any) {
        console.error('Google redirect sign-in error:', redirectError);
        toast({
          variant: 'destructive',
          title: 'Google Sign-In Failed',
          description: getAuthErrorMessage(redirectError),
        });
        setGoogleLoading(false);
        return;
      }
    }

    try {
      await signInWithPopup(auth, provider);
      toast({
        title: 'Login Successful',
        description: 'Welcome back!',
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      // If popup was blocked by browser or cross-origin headers, auto-fallback to redirect
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
        try {
          toast({
            title: 'Redirecting to Google...',
            description: 'Popup was blocked by your browser. Redirecting directly...',
          });
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError: any) {
          console.error('Google sign-in fallback error:', redirectError);
        }
      }

      toast({
        variant: 'destructive',
        title: 'Google Sign-In Failed',
        description: getAuthErrorMessage(error),
      });
    } finally {
      setGoogleLoading(false);
    }
  }

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
          <p className="text-sm text-slate-400">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-8">
      <Card className="w-full max-w-md border-slate-800 bg-slate-950/90 shadow-2xl backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
            <LogIn className="h-6 w-6 text-brand-400" />
            Login
          </CardTitle>
          <CardDescription className="text-slate-400">
            Enter your credentials to access your SharpSim account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 font-medium border-slate-700 bg-slate-900/60 hover:bg-slate-800 hover:text-white"
            onClick={() => handleGoogleSignIn(false)}
            disabled={loading || googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <GoogleIcon className="mr-2 h-5 w-5" />
            )}
            {googleLoading ? 'Connecting with Google...' : 'Sign in with Google'}
          </Button>

          <div className="flex justify-center mt-2.5">
            <button
              type="button"
              onClick={() => handleGoogleSignIn(true)}
              disabled={loading || googleLoading}
              className="text-[12px] text-slate-400 hover:text-brand-400 transition-colors underline underline-offset-2"
            >
              Having trouble with popups? Sign in via redirect
            </button>
          </div>

          <div className="relative my-6">
            <span className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-800" />
            </span>
            <span className="relative flex justify-center text-xs uppercase text-slate-500">
              <span className="bg-slate-950 px-2">or continue with email</span>
            </span>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="name@example.com"
                        className="bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-brand-500"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-rose-400" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-slate-300">Password</FormLabel>
                      <Link
                        href="/forgot-password"
                        className="text-xs text-brand-400 hover:text-brand-300 hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-brand-500"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-rose-400" />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-11 bg-brand-500 hover:bg-brand-400 text-white font-semibold shadow-lg shadow-brand-500/20"
                disabled={loading || googleLoading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  'Login'
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm text-slate-400">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-semibold text-brand-400 hover:underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
