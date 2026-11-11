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
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, updateProfile } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2 } from 'lucide-react';
import { GoogleIcon } from '@/components/auth/google-icon';
import { getAuthErrorMessage } from '@/lib/auth-errors';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }).optional().or(z.literal('')),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

export default function SignUpPage() {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (!isUserLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, values.email, values.password);
      if (values.name && values.name.trim()) {
        try {
          await updateProfile(userCred.user, { displayName: values.name.trim() });
        } catch (profileErr) {
          console.warn('Could not set displayName on signup:', profileErr);
        }
      }
      toast({
        title: 'Account Created',
        description: 'Welcome to SharpSim! Your profile is ready.',
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Sign up error:', error);
      toast({
        variant: 'destructive',
        title: 'Sign Up Failed',
        description: getAuthErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      toast({
        title: 'Account Created',
        description: 'Welcome to SharpSim! Your profile is ready.',
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Google sign-up error:', error);
      if (error.code === 'auth/popup-closed-by-user') return;
      toast({
        variant: 'destructive',
        title: 'Google Sign-Up Failed',
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
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-8">
      <Card className="w-full max-w-md border-slate-800 bg-slate-950/90 shadow-2xl backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
            <UserPlus className="h-6 w-6 text-brand-400" />
            Sign Up
          </CardTitle>
          <CardDescription className="text-slate-400">
            Create a new SharpSim account to simulate, test strategies, and track your bets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 font-medium border-slate-700 bg-slate-900/60 hover:bg-slate-800 hover:text-white"
            onClick={handleGoogleSignUp}
            disabled={loading || googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <GoogleIcon className="mr-2 h-5 w-5" />
            )}
            {googleLoading ? 'Connecting with Google...' : 'Sign up with Google'}
          </Button>

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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">Display Name (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John Doe"
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
                    <FormLabel className="text-slate-300">Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="At least 6 characters"
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
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-brand-400 hover:underline">
              Login
            </Link>
          </div>

          <p className="mt-4 text-center text-[11px] text-slate-500 leading-normal">
            By signing up, you agree to our{' '}
            <Link href="/terms" className="text-slate-400 hover:text-white underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-slate-400 hover:text-white underline">
              Privacy Policy
            </Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
