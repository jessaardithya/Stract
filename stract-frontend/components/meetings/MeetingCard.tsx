'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { Trash2, Calendar, Users, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { MeetingListItem } from '@/types';

interface MeetingCardProps {
  item: MeetingListItem;
  onOpen: () => void;
  onDelete: () => Promise<void>;
}

function formatMeetingDate(dateStr: string): string {
  try {
    // meeting_date is a DATE (YYYY-MM-DD), parse without timezone shift
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return format(d, 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function MeetingCard({ item, onOpen, onDelete }: MeetingCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="group relative flex flex-col gap-3 rounded-xl border border-[#e7e1d8] bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-[#d5cfc6] cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onOpen}
    >
      {/* Delete button */}
      {isHovered && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              disabled={isDeleting}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-[#8a8a85] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 size={13} />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete meeting?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &quot;{item.title}&quot; and all its action items. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete();
                }}
                className="bg-red-500 hover:bg-red-600"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Date badge */}
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-violet-600">
        <Calendar size={11} />
        {formatMeetingDate(item.meeting_date)}
      </div>

      {/* Title */}
      <h3 className="text-[14px] font-semibold text-gray-900 leading-snug pr-6">
        {item.title || 'Untitled Meeting'}
      </h3>

      {/* Stats row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 text-[11px] text-[#8a8a85]">
          <Users size={11} />
          {item.attendee_count === 0
            ? 'No attendees'
            : `${item.attendee_count} attendee${item.attendee_count === 1 ? '' : 's'}`}
        </div>

        {item.action_item_count > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
            <AlertTriangle size={9} />
            {item.action_item_count} action item{item.action_item_count === 1 ? '' : 's'} pending
          </div>
        )}
      </div>
    </div>
  );
}
