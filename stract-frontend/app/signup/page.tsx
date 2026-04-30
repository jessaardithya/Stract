'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, LockKeyhole, Mail, MailCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AuthCard from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const FORCE_WORKSPACE_HOME_KEY = 'forceWorkspaceHome';
const POST_AUTH_REDIRECT_KEY = 'postAuthRedirect';

const friendlyError = (msg: string) => {
  if (msg.includes('Invalid login credentials')) return 'Incorrect email or password';
  if (msg.includes('Email not confirmed')) return 'Please confirm your email before signing in';
  if (msg.includes('User already registered')) return 'An account with this email already exists';
  if (msg.includes('Too many requests')) return 'Too many attempts. Please wait a bit and try again.';
  return msg || 'Something went wrong. Please try again.';
};

function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function Signup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const redirectTarget = searchParams.get('next') || '/home';

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTarget)}`,
      },
    });

    if (error) {
      setError(friendlyError(error.message));
    } else if (data.session) {
      window.sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, redirectTarget);
      if (redirectTarget === '/home') {
        window.sessionStorage.setItem(FORCE_WORKSPACE_HOME_KEY, '1');
      } else {
        window.sessionStorage.removeItem(FORCE_WORKSPACE_HOME_KEY);
      }
      router.replace(redirectTarget);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setOauthLoading(true);
    window.sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, redirectTarget);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTarget)}`,
      },
    });
    setOauthLoading(false);
  };

  if (success) {
    return (
      <AuthCard
        eyebrow="Check your inbox"
        title="Confirm your email"
        subtitle={
          <>
            We sent an activation link to <strong>{email}</strong>. Open it to finish setting up your account.
          </>
        }
        asideTitle="Your workspace access is almost ready."
        asideDescription="Once you confirm the email, Stract can route you into your workspace and keep your invitations and project access in sync."
        asidePoints={[
          'Activation keeps invitations tied to the right account',
          'You only need to confirm once for future sign-ins',
          'After confirmation, you can enter workspaces immediately',
        ]}
        footer={
          <Link href="/login" className="font-semibold text-violet-600 transition-colors hover:text-violet-700">
            Back to sign in
          </Link>
        }
        mode="signup"
      >
        <div className="space-y-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-violet-600">
            <MailCheck size={26} />
          </div>
          <p className="max-w-[38ch] text-sm leading-6 text-[#706b64]">
            If the message does not appear in a few minutes, check spam or try signing up again with the same email.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow="Create account"
      title="Start your workspace access"
      subtitle="Create your account to join workspaces, accept invitations, and keep boards, timelines, and reports connected."
      asideTitle="One account for every workspace you operate."
      asideDescription="Use Stract to move from planning to execution with fewer handoffs, clearer ownership, and reporting that stays live as work changes."
      asidePoints={[
        'Join invited workspaces from the home screen',
        'Move between projects, reports, timeline, and calendar cleanly',
        'Keep members, tasks, and delivery updates in one system',
      ]}
      footer={
        <>
          Already have an account?{' '}
          <Link
            href={`/login${redirectTarget !== '/home' ? `?next=${encodeURIComponent(redirectTarget)}` : ''}`}
            className="font-semibold text-violet-600 transition-colors hover:text-violet-700"
          >
            Sign in
          </Link>
        </>
      }
      mode="signup"
    >
      <div className="space-y-6">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-[50ms] fill-mode-both">
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-xl w-full justify-center border-black/10 bg-white shadow-sm transition-all hover:bg-zinc-50 hover:border-black/20 text-zinc-800 font-medium text-[14px]"
            onClick={handleGoogleSignIn}
            disabled={oauthLoading}
          >
          {oauthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleMark />}
          Continue with Google
        </Button>
        </div>

        <div className="flex items-center gap-3 animate-in fade-in duration-500 delay-[100ms] fill-mode-both">
          <div className="h-px flex-1 bg-black/[0.06]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a8a85]">or sign up with email</span>
          <div className="h-px flex-1 bg-black/[0.06]" />
        </div>

        <form onSubmit={handleEmailSignUp} className="space-y-5">
          <div className="space-y-2 group animate-in fade-in slide-in-from-bottom-4 duration-500 delay-[150ms] fill-mode-both">
            <Label htmlFor="email" className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400 transition-colors group-focus-within:text-violet-600">
              Email
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-violet-600" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="h-12 rounded-xl text-[14px] border border-transparent bg-zinc-50/80 pl-11 shadow-none transition-all hover:bg-zinc-100 hover:border-black/5 focus-visible:bg-white focus-visible:border-violet-400 focus-visible:ring-[4px] focus-visible:ring-violet-500/10 placeholder:text-zinc-400"
              />
            </div>
          </div>

          <div className="space-y-2 group animate-in fade-in slide-in-from-bottom-4 duration-500 delay-[200ms] fill-mode-both">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="password" className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400 transition-colors group-focus-within:text-violet-600">
                Password
              </Label>
              <span className="text-xs text-zinc-400">At least 8 characters</span>
            </div>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-violet-600" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl text-[14px] border border-transparent bg-zinc-50/80 pl-11 shadow-none transition-all hover:bg-zinc-100 hover:border-black/5 focus-visible:bg-white focus-visible:border-violet-400 focus-visible:ring-[4px] focus-visible:ring-violet-500/10"
              />
            </div>
          </div>

          {error && (
            <div className="border border-red-200/50 bg-red-50/50 rounded-xl px-4 py-3 text-sm text-red-600 animate-in fade-in duration-300">
              {error}
            </div>
          )}

          <div className="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-[250ms] fill-mode-both">
            <Button
              type="submit"
              className="h-12 w-full rounded-xl justify-center bg-gradient-to-b from-indigo-500 to-violet-600 text-white shadow-[0_8px_20px_-8px_rgba(99,102,241,0.5)] active:scale-[0.98] transition-all hover:shadow-[0_12px_24px_-10px_rgba(99,102,241,0.6)] hover:from-indigo-600 hover:to-violet-700 font-medium text-[14px]"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </div>
        </form>
      </div>
    </AuthCard>
  );
}
