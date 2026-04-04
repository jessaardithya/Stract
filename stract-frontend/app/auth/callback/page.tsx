'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

const FORCE_WORKSPACE_HOME_KEY = 'forceWorkspaceHome';
const POST_AUTH_REDIRECT_KEY = 'postAuthRedirect';

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const redirectTarget =
      searchParams.get('next') ||
      window.sessionStorage.getItem(POST_AUTH_REDIRECT_KEY) ||
      '/home';

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, redirectTarget);
        if (redirectTarget === '/home') {
          window.sessionStorage.setItem(FORCE_WORKSPACE_HOME_KEY, '1');
        } else {
          window.sessionStorage.removeItem(FORCE_WORKSPACE_HOME_KEY);
        }
        router.replace(redirectTarget);
      } else {
        router.replace('/login');
      }
    });
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#fafaf8] flex items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
        Signing you in...
      </div>
    </div>
  );
}
