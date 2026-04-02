'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

const FORCE_WORKSPACE_HOME_KEY = 'forceWorkspaceHome';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.sessionStorage.setItem(FORCE_WORKSPACE_HOME_KEY, '1');
        router.replace('/home');
      } else {
        router.replace('/login');
      }
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-[#fafaf8] flex items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
        Signing you in...
      </div>
    </div>
  );
}
