'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NotebookText, Loader2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { createMeeting } from '@/lib/api';
import { MeetingsList } from '@/components/meetings/MeetingsList';
import { MeetingEditor } from '@/components/meetings/MeetingEditor';

export default function MeetingsPage() {
  const router = useRouter();
  const { activeWorkspace, activeProject } = useApp();
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Must have workspace + project
  if (!activeWorkspace || !activeProject) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f5f2ee]">
          <NotebookText size={22} className="text-[#8a8a85]" />
        </div>
        <div>
          <p className="text-[14px] font-medium text-gray-700">No project selected</p>
          <p className="mt-1 text-[12px] text-[#8a8a85]">Select a project from the sidebar to view meetings</p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="text-[12px] text-violet-600 hover:underline"
        >
          Go to Board
        </button>
      </div>
    );
  }

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const res = await createMeeting(activeWorkspace.id, activeProject.id);
      setSelectedMeetingId(res.data.id);
    } catch (err) {
      console.error('[MeetingsPage] create error:', err);
    } finally {
      setIsCreating(false);
    }
  };

  if (selectedMeetingId) {
    return (
      <div className="h-full">
        <MeetingEditor
          workspaceId={activeWorkspace.id}
          projectId={activeProject.id}
          meetingId={selectedMeetingId}
          onBack={() => setSelectedMeetingId(null)}
        />
      </div>
    );
  }

  return (
    <div className="h-full">
      <MeetingsList
        workspaceId={activeWorkspace.id}
        projectId={activeProject.id}
        onSelect={setSelectedMeetingId}
        onCreate={handleCreate}
        isCreating={isCreating}
      />
    </div>
  );
}
