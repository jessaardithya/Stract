'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2, MapPin, Calendar, Plus } from 'lucide-react';
import { useMeetingEditor } from './useMeetingEditor';
import { AttendeeSelector } from './AttendeeSelector';
import { ActionItemRow } from './ActionItemRow';
import { createActionItem, getMembers } from '@/lib/api';
import type { MeetingActionItem, MeetingAttendee, WorkspaceMember } from '@/types';
import { useApp } from '@/context/AppContext';

interface MeetingEditorProps {
  workspaceId: string;
  projectId: string;
  meetingId: string;
  onBack: () => void;
}

function SaveIndicator({ state }: { state: string }) {
  if (!state) return null;
  return (
    <div className="flex items-center gap-1.5 text-[11.5px] font-medium">
      {state === 'saving' && (
        <>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-600">Saving…</span>
        </>
      )}
      {state === 'saved' && (
        <>
          <CheckCircle2 size={12} className="text-emerald-500" />
          <span className="text-emerald-600">Saved</span>
        </>
      )}
      {state === 'error' && (
        <>
          <AlertCircle size={12} className="text-red-400" />
          <span className="text-red-500">Failed to save</span>
        </>
      )}
    </div>
  );
}

function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  minRows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={minRows}
      className="w-full resize-none border-0 bg-transparent p-0 text-[13px] text-gray-800 leading-relaxed placeholder:text-[#c9c4bc] outline-none focus:outline-none"
      style={{ overflow: 'hidden' }}
    />
  );
}

const SECTION_LABEL = 'text-[10px] font-bold uppercase tracking-widest text-[#a0988e] mb-2';

export function MeetingEditor({ workspaceId, projectId, meetingId, onBack }: MeetingEditorProps) {
  const { openTask } = useApp();
  const { meeting, setMeeting, saveState, isLoading, updateField } = useMeetingEditor(workspaceId, projectId, meetingId);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);

  useEffect(() => {
    getMembers(workspaceId)
      .then((res) => setMembers(res.data || []))
      .catch(console.error);
  }, [workspaceId]);

  const handleAddActionItem = async () => {
    setIsAddingItem(true);
    try {
      const res = await createActionItem(workspaceId, projectId, meetingId, { title: '' });
      setMeeting((prev) => {
        if (!prev) return prev;
        return { ...prev, action_items: [...(prev.action_items || []), res.data] };
      });
    } catch { /* ignore */ } finally {
      setIsAddingItem(false);
    }
  };

  const handleActionItemUpdate = (updated: MeetingActionItem) => {
    setMeeting((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        action_items: prev.action_items.map((ai) => ai.id === updated.id ? updated : ai),
      };
    });
  };

  const handleActionItemDelete = (itemId: string) => {
    setMeeting((prev) => {
      if (!prev) return prev;
      return { ...prev, action_items: prev.action_items.filter((ai) => ai.id !== itemId) };
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#c9c4bc]" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[13px] text-[#8a8a85]">Meeting not found.</p>
        <button onClick={onBack} className="text-[12px] text-violet-600 hover:underline">← Back</button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-[#e7e1d8] bg-white px-6 py-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[12px] text-[#8a8a85] transition-colors hover:text-gray-700"
        >
          <ArrowLeft size={13} />
          Back to meetings
        </button>
        <SaveIndicator state={saveState} />
      </div>

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto px-10 py-8 max-w-3xl mx-auto w-full">
        {/* Title */}
        <input
          value={meeting.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="Untitled Meeting"
          className="mb-6 w-full border-0 bg-transparent p-0 text-[22px] font-bold text-gray-900 placeholder:text-[#c9c4bc] outline-none focus:outline-none"
        />

        {/* Meta row */}
        <div className="mb-8 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Calendar size={14} className="shrink-0 text-[#8a8a85]" />
            <input
              type="date"
              value={meeting.meeting_date}
              onChange={(e) => updateField('meeting_date', e.target.value)}
              className="border-0 bg-transparent p-0 text-[13px] text-gray-700 outline-none focus:outline-none [&::-webkit-calendar-picker-indicator]:opacity-50"
            />
          </div>
          <div className="flex items-center gap-3">
            <MapPin size={14} className="shrink-0 text-[#8a8a85]" />
            <input
              value={meeting.location ?? ''}
              onChange={(e) => updateField('location', e.target.value)}
              placeholder="Add location (Zoom, Office, etc.)"
              className="flex-1 border-0 bg-transparent p-0 text-[13px] text-gray-700 placeholder:text-[#c9c4bc] outline-none focus:outline-none"
            />
          </div>
        </div>

        {/* Attendees */}
        <div className="mb-8">
          <p className={SECTION_LABEL}>Attendees</p>
          <AttendeeSelector
            workspaceId={workspaceId}
            attendees={meeting.attendees ?? []}
            onChange={(updated: MeetingAttendee[]) => updateField('attendees', updated)}
          />
        </div>

        {/* Agenda */}
        <div className="mb-8">
          <p className={SECTION_LABEL}>Agenda</p>
          <AutoResizeTextarea
            value={meeting.agenda ?? ''}
            onChange={(v) => updateField('agenda', v)}
            placeholder="Meeting agenda…"
          />
        </div>

        {/* Notes */}
        <div className="mb-8">
          <p className={SECTION_LABEL}>Notes</p>
          <AutoResizeTextarea
            value={meeting.notes ?? ''}
            onChange={(v) => updateField('notes', v)}
            placeholder="Discussion notes, key points…"
            minRows={6}
          />
        </div>

        {/* Decisions */}
        <div className="mb-8">
          <p className={SECTION_LABEL}>Decisions</p>
          <AutoResizeTextarea
            value={meeting.decisions ?? ''}
            onChange={(v) => updateField('decisions', v)}
            placeholder="Key decisions made…"
          />
        </div>

        {/* Action Items */}
        <div className="mb-12">
          <p className={SECTION_LABEL}>Action Items</p>
          <div className="flex flex-col gap-0.5">
            {(meeting.action_items ?? []).map((item) => (
              <ActionItemRow
                key={item.id}
                item={item}
                workspaceId={workspaceId}
                projectId={projectId}
                meetingId={meetingId}
                members={members}
                onUpdate={handleActionItemUpdate}
                onDelete={handleActionItemDelete}
                onOpenTask={openTask}
              />
            ))}
          </div>
          <button
            onClick={handleAddActionItem}
            disabled={isAddingItem}
            className="mt-2 flex items-center gap-1.5 px-2 py-1.5 text-[12px] text-[#8a8a85] transition-colors hover:text-gray-700"
          >
            {isAddingItem ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Add action item
          </button>
        </div>
      </div>
    </div>
  );
}
