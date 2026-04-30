'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, LockKeyhole, Mail, Loader2 } from 'lucide-react';
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

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const redirectTarget = searchParams.get('next') || '/home';

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(friendlyError(error.message));
    } else {
      window.sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, redirectTarget);
      if (redirectTarget === '/home') {
        window.sessionStorage.setItem(FORCE_WORKSPACE_HOME_KEY, '1');
      } else {
        window.sessionStorage.removeItem(FORCE_WORKSPACE_HOME_KEY);
      }
      router.replace(redirectTarget);
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

  return (
    <AuthCard
      eyebrow="Sign in"
      title="Access your workspace"
      subtitle="Pick up where your team left off. Use Google for the fastest entry or sign in with your email."
      asideTitle="Keep delivery moving without losing context."
      asideDescription="Stract keeps project planning, execution, and reporting inside one shared system, so the work stays readable as teams grow."
      asidePoints={[
        'See every workspace, report, board, and calendar from one account',
        'Jump back into active projects without rebuilding context',
        'Stay synced across members, tasks, and delivery updates',
      ]}
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link
            href={`/signup${redirectTarget !== '/home' ? `?next=${encodeURIComponent(redirectTarget)}` : ''}`}
            className="font-semibold text-violet-600 transition-colors hover:text-violet-700"
          >
            Create one
          </Link>
        </>
      }
      mode="login"
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
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a8a85]">or use email</span>
          <div className="h-px flex-1 bg-black/[0.06]" />
        </div>

        <form onSubmit={handleEmailSignIn} className="space-y-5">
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
              <span className="text-xs text-zinc-400">Minimum 8 characters</span>
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

          {/* Forgot password */}
          {!forgotMode ? (
            <button
              type="button"
              onClick={() => { setForgotMode(true); setForgotEmail(email); }}
              className="text-[12px] text-violet-600 hover:text-violet-700 transition-colors text-left"
            >
              Forgot password?
            </button>
          ) : (
            <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 space-y-3">
              <div>
                <p className="text-[13px] font-semibold text-gray-900">Reset your password</p>
                <p className="text-[12px] text-gray-500 mt-0.5">Enter your email and we&apos;ll send you a reset link.</p>
              </div>
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="email@example.com"
                className="h-10 w-full rounded-lg border border-violet-200 bg-white px-3 text-[13px] outline-none focus:border-violet-400 placeholder:text-gray-400"
              />
              {forgotMsg && <p className="text-[12px] text-green-600">{forgotMsg}</p>}
              {forgotError && <p className="text-[12px] text-red-500">{forgotError}</p>}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setForgotError(null);
                    setForgotLoading(true);
                    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    if (error) setForgotError(error.message);
                    else setForgotMsg('Check your email for a reset link.');
                    setForgotLoading(false);
                  }}
                  disabled={forgotLoading || !forgotEmail}
                  className="h-8 px-3 rounded-lg bg-violet-600 text-white text-[12px] font-medium hover:bg-violet-700 transition-colors disabled:opacity-50"
                >
                  {forgotLoading ? 'Sending…' : 'Send reset link'}
                </button>
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setForgotMsg(null); setForgotError(null); }}
                  className="text-[12px] text-gray-500 hover:text-gray-700"
                >
                  ← Back to sign in
                </button>
              </div>
            </div>
          )}

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
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </div>
        </form>
      </div>
    </AuthCard>
  );
}
