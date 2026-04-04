'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, LogIn, MailPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';
import { acceptInvitation } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const POST_AUTH_REDIRECT_KEY = 'postAuthRedirect';

export default function JoinInvitationPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { setActiveWorkspace } = useApp();
  const token = useMemo(() => String(params?.token || ''), [params]);

  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) {
        return;
      }

      setHasSession(Boolean(session));
      setCheckingSession(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const redirectTarget = `/join/${token}`;

  const handleAccept = async () => {
    if (!token || accepting) {
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      const result = await acceptInvitation(token);
      await setActiveWorkspace(result.data);
      window.sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);
      router.replace('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not accept invitation';
      setError(message);
    } finally {
      setAccepting(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-[#fafaf8] flex items-center justify-center px-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin text-violet-600" />
          Preparing invitation...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fafaf8] px-6 py-10">
      <div className="mx-auto max-w-md rounded-2xl border border-[#e4e4e0] bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-violet-600 text-white">
            <MailPlus size={20} />
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-950">Workspace invitation</p>
            <p className="text-sm text-gray-500">Join a shared workspace in Stract</p>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <p className="text-sm text-gray-600">
            This invite link will add you to the workspace after you confirm it.
          </p>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {hasSession ? (
            <Button
              type="button"
              className="w-full bg-violet-600 text-white hover:bg-violet-700"
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 size={16} />}
              Accept invitation
            </Button>
          ) : (
            <div className="space-y-3">
              <Button
                asChild
                type="button"
                className="w-full bg-violet-600 text-white hover:bg-violet-700"
                onClick={() => window.sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, redirectTarget)}
              >
                <Link href={`/login?next=${encodeURIComponent(redirectTarget)}`}>
                  <LogIn size={16} />
                  Sign in to accept
                </Link>
              </Button>
              <Button
                asChild
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => window.sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, redirectTarget)}
              >
                <Link href={`/signup?next=${encodeURIComponent(redirectTarget)}`}>
                  Create account
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
