'use client';

import React, { useEffect, useState } from 'react';
import { Plus, NotebookText, Loader2 } from 'lucide-react';
import { getMeetings, deleteMeeting } from '@/lib/api';
import { MeetingCard } from './MeetingCard';
import type { MeetingListItem } from '@/types';

interface MeetingsListProps {
  workspaceId: string;
  projectId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  isCreating: boolean;
}

export function MeetingsList({ workspaceId, projectId, onSelect, onCreate, isCreating }: MeetingsListProps) {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getMeetings(workspaceId, projectId)
      .then((res) => {
        if (!cancelled) setMeetings(res.data || []);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [workspaceId, projectId]);

  const handleDelete = async (meetingId: string) => {
    await deleteMeeting(workspaceId, projectId, meetingId);
    setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#e7e1d8] px-8 py-5 bg-white">
        <div className="flex items-center gap-2.5">
          <NotebookText size={18} className="text-violet-500" />
          <h1 className="text-[16px] font-semibold text-gray-900">Minutes of Meeting</h1>
        </div>
        <button
          onClick={onCreate}
          disabled={isCreating}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
        >
          {isCreating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          New Meeting
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl border border-[#e7e1d8] bg-[#f5f2ee]" />
            ))}
          </div>
        ) : meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50">
              <NotebookText size={24} className="text-violet-400" />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-medium text-gray-700">No meeting notes yet</p>
              <p className="mt-1 text-[12px] text-[#8a8a85]">Create your first MoM to capture decisions and action items</p>
            </div>
            <button
              onClick={onCreate}
              disabled={isCreating}
              className="flex items-center gap-1.5 rounded-lg border border-[#e4e4e0] bg-white px-4 py-2 text-[12.5px] font-medium text-gray-700 transition-colors hover:bg-[#f5f2ee]"
            >
              {isCreating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              New Meeting
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {meetings.map((item) => (
              <MeetingCard
                key={item.id}
                item={item}
                onOpen={() => onSelect(item.id)}
                onDelete={() => handleDelete(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
