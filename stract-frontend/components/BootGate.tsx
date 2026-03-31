'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Navbar';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';

const COLUMN_SKELETONS = 3;

function FullPageSkeleton() {
  return (
    <div className="min-h-screen bg-[#fafaf8] flex">
      <div className="fixed top-0 left-0 h-screen w-[220px] bg-white border-r border-[#e4e4e0] flex flex-col animate-pulse">
        <div className="h-14 border-b border-[#e4e4e0] flex items-center px-4 gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#e4e4e0]" />
          <div className="h-4 bg-[#e4e4e0] rounded-md flex-1" />
        </div>
        <div className="p-3 flex-1 space-y-2">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-8 bg-[#f4f4f2] rounded-lg" />
          ))}
        </div>
      </div>

      <div className="ml-[220px] flex gap-5 p-6">
        {Array.from({ length: COLUMN_SKELETONS }).map((_, index) => (
          <div
            key={index}
            className="w-[300px] min-w-[300px] h-60 rounded-xl bg-[#f4f4f2] border border-[#e4e4e0] animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

interface BootGateProps {
  children: React.ReactNode;
}

export default function BootGate({ children }: BootGateProps) {
  const { bootState } = useApp();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/auth/callback';
  const isWorkspaceHome = pathname === '/home';

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !isAuthPage) {
        router.replace('/login');
        return;
      }

      if (session && isAuthPage) {
        window.location.href = '/home';
      }
    });

    return () => subscription.unsubscribe();
  }, [isAuthPage, router]);

  useEffect(() => {
    if (bootState === 'unauthenticated' && !isAuthPage) {
      router.replace('/login');
      return;
    }

    if (
      (bootState === 'workspace-selection' || bootState === 'no-workspace') &&
      !isAuthPage &&
      !isWorkspaceHome
    ) {
      router.replace('/home');
    }
  }, [bootState, isAuthPage, isWorkspaceHome, router]);

  if (bootState === 'loading') {
    return <FullPageSkeleton />;
  }

  if (bootState === 'unauthenticated') {
    if (isAuthPage) {
      return children;
    }
    return <FullPageSkeleton />;
  }

  if (isAuthPage) {
    return <FullPageSkeleton />;
  }

  if (isWorkspaceHome) {
    return <div className="min-h-screen bg-[#fafaf8]">{children}</div>;
  }

  if (bootState === 'workspace-selection' || bootState === 'no-workspace') {
    return <FullPageSkeleton />;
  }

  return (
    <div className="flex w-full min-h-screen">
      <Sidebar />
      <div className="flex-1 w-0 flex flex-col min-h-screen bg-[#fafaf8]">
        {children}
      </div>
    </div>
  );
}
