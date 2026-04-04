'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, X, UserCircle } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { getMembers } from '@/lib/api';
import type { MeetingAttendee, WorkspaceMember } from '@/types';

interface AttendeeSelectorProps {
  workspaceId: string;
  attendees: MeetingAttendee[];
  onChange: (updated: MeetingAttendee[]) => void;
}

export function AttendeeSelector({ workspaceId, attendees, onChange }: AttendeeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [externalName, setExternalName] = useState('');
  const [externalEmail, setExternalEmail] = useState('');

  useEffect(() => {
    if (!open) return;
    getMembers(workspaceId)
      .then((res) => setMembers(res.data || []))
      .catch(console.error);
  }, [open, workspaceId]);

  const filteredMembers = members.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  const isAdded = (userId: string) => attendees.some((a) => a.user_id === userId);

  const toggleMember = (member: WorkspaceMember) => {
    if (isAdded(member.id)) {
      onChange(attendees.filter((a) => a.user_id !== member.id));
    } else {
      if (attendees.length >= 20) return;
      const newAttendee: MeetingAttendee = {
        user_id: member.id,
        name: member.name || member.email,
        email: member.email,
        avatar_url: member.avatar_url,
        is_external: false,
      };
      onChange([...attendees, newAttendee]);
    }
  };

  const addExternal = () => {
    if (!externalName.trim() && !externalEmail.trim()) return;
    if (attendees.length >= 20) return;
    const newAttendee: MeetingAttendee = {
      user_id: null,
      name: externalName.trim() || externalEmail.trim(),
      email: externalEmail.trim(),
      avatar_url: null,
      is_external: true,
    };
    onChange([...attendees, newAttendee]);
    setExternalName('');
    setExternalEmail('');
  };

  const removeAttendee = (index: number) => {
    const updated = [...attendees];
    updated.splice(index, 1);
    onChange(updated);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Existing attendees */}
      {attendees.map((attendee, i) => (
        <div
          key={`${attendee.user_id ?? 'ext'}-${i}`}
          className="group flex items-center gap-1.5 rounded-full border border-[#e7e1d8] bg-[#f9f7f4] px-2.5 py-1 text-[12px]"
        >
          <Avatar className="h-4 w-4 shrink-0">
            <AvatarImage src={attendee.avatar_url ?? undefined} />
            <AvatarFallback className="text-[7px] font-bold uppercase bg-violet-100 text-violet-700">
              {attendee.name?.[0] ?? '?'}
            </AvatarFallback>
          </Avatar>
          <span className="text-gray-700 font-medium">{attendee.name}</span>
          {attendee.is_external && (
            <span className="text-[9px] text-[#8a8a85] font-normal">(ext)</span>
          )}
          <button
            onClick={() => removeAttendee(i)}
            className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#8a8a85] hover:text-red-400"
          >
            <X size={10} />
          </button>
        </div>
      ))}

      {/* Add attendee popover */}
      {attendees.length < 20 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 rounded-full border border-dashed border-[#c9c4bc] px-2.5 py-1 text-[12px] text-[#8a8a85] transition-colors hover:border-violet-400 hover:text-violet-600">
              <UserCircle size={12} />
              Add attendee
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2" sideOffset={4}>
            <Input
              autoFocus
              placeholder="Search members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-2 h-7 text-[12px] border-[#e7e1d8] shadow-none"
            />
            <div className="max-h-48 overflow-y-auto">
              {filteredMembers.map((member) => {
                const added = isAdded(member.id);
                return (
                  <button
                    key={member.id}
                    onClick={() => toggleMember(member)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-[#f5f2ee]"
                  >
                    <Avatar className="h-5 w-5 shrink-0">
                      <AvatarImage src={member.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[8px] font-bold uppercase bg-violet-100 text-violet-700">
                        {member.name?.[0] ?? member.email[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-gray-700">
                      {member.name || member.email}
                    </span>
                    {added && <Check size={12} className="shrink-0 text-violet-500" />}
                  </button>
                );
              })}
              {filteredMembers.length === 0 && search && (
                <div className="mt-2 border-t border-[#e7e1d8] pt-2">
                  <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-[#8a8a85]">
                    Add external attendee
                  </p>
                  <Input
                    placeholder="Name"
                    value={externalName}
                    onChange={(e) => setExternalName(e.target.value)}
                    className="mb-1 h-7 text-[12px] border-[#e7e1d8] shadow-none"
                  />
                  <Input
                    placeholder="Email (optional)"
                    value={externalEmail}
                    onChange={(e) => setExternalEmail(e.target.value)}
                    className="mb-1 h-7 text-[12px] border-[#e7e1d8] shadow-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { addExternal(); setOpen(false); }
                    }}
                  />
                  <button
                    onClick={() => { addExternal(); setOpen(false); }}
                    className="w-full rounded-md bg-violet-50 py-1 text-[12px] font-medium text-violet-600 hover:bg-violet-100"
                  >
                    Add external
                  </button>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
