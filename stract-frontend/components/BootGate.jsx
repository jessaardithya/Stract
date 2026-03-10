'use client';

import { useApp } from '@/context/AppContext';
import CreateWorkspace from '@/components/onboarding/CreateWorkspace';
import Sidebar from '@/components/Navbar';

const COLUMN_SKELETONS = 3;

function FullPageSkeleton() {
  return (
    <div className="min-h-screen bg-[#fafaf8] flex">
      {/* Sidebar skeleton */}
      <div className="fixed top-0 left-0 h-screen w-[220px] bg-white border-r border-[#e4e4e0] flex flex-col animate-pulse">
        <div className="h-14 border-b border-[#e4e4e0] flex items-center px-4 gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#e4e4e0]" />
          <div className="h-4 bg-[#e4e4e0] rounded-md flex-1" />
        </div>
        <div className="p-3 flex-1 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-[#f4f4f2] rounded-lg" />
          ))}
        </div>
      </div>

      {/* Board skeleton */}
      <div className="ml-[220px] flex gap-5 p-6">
        {Array.from({ length: COLUMN_SKELETONS }).map((_, i) => (
          <div
            key={i}
            className="w-[300px] min-w-[300px] h-60 rounded-xl bg-[#f4f4f2] border border-[#e4e4e0] animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

export default function BootGate({ children }) {
  const { bootState } = useApp();

  if (bootState === 'loading') {
    return <FullPageSkeleton />;
  }

  if (bootState === 'no-workspace') {
    return <CreateWorkspace />;
  }

  // 'ready' — show sidebar + normal content
  return (
    <>
      <Sidebar />
      <div className="ml-[220px] min-h-screen">
        {children}
      </div>
    </>
  );
}
