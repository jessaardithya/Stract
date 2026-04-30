'use client';

import { useApp } from '@/context/AppContext';
import { AssetsPage } from '@/components/assets/AssetsPage';
import { useRouter } from 'next/navigation';

export default function AssetsRoute() {
  const { activeWorkspace, activeProject, bootState } = useApp();
  const router = useRouter();

  if (bootState === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-[#fafaf8]">
        <div className="h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!activeWorkspace || !activeProject) {
    router.replace('/');
    return null;
  }

  return (
    <AssetsPage
      workspaceId={activeWorkspace.id}
      projectId={activeProject.id}
      projectName={activeProject.name}
    />
  );
}
