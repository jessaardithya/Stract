'use client';

import { formatDistanceToNow } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { UserActivity } from '@/types';

interface ActivityRowProps {
  item: UserActivity;
  index: number;
  currentUserId: string | null;
  isOpening: boolean;
  onOpenActivity: (item: UserActivity) => void;
}

function describeActivity(item: UserActivity) {
  if (item.content?.trim()) {
    return item.content;
  }
  if (item.type === 'created') {
    return `created task`;
  }
  if (item.type === 'comment') {
    return `commented on`;
  }
  if (item.type === 'status_change') {
    return `updated status of`;
  }
  if (item.type === 'field_change') {
    return `modified field in`;
  }
  return `updated task`;
}

export default function ActivityRow({ item, index, currentUserId, isOpening, onOpenActivity }: ActivityRowProps) {
  const isMe = currentUserId === item.user_id;
  const displayName = item.user_name || (isMe ? 'You' : 'Someone');
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onOpenActivity(item)}
      className="w-full text-left group relative py-3 pl-12 pr-3 transition-colors hover:bg-white rounded-lg group-hover:block"
      disabled={isOpening}
    >
      {/* Sender Avatar */}
      <div className="absolute left-[8px] top-[14px] z-10 transition-transform group-hover:scale-105">
        <Avatar className="size-7 border border-white shadow-sm">
          {item.user_avatar && <AvatarImage src={item.user_avatar} />}
          <AvatarFallback className="bg-slate-100 text-[10px] font-bold text-slate-500 uppercase">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1">
        <p className="text-[13px] text-gray-600 truncate leading-relaxed">
          <strong className="font-semibold text-gray-900 mr-1.5">{displayName}</strong>
          <span className="text-gray-500 mr-1.5">{describeActivity(item)}</span>
          <span className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">{item.task_title}</span>
        </p>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-medium text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 hidden sm:inline-block">
            {item.workspace_name}
          </span>
          <span className="text-[11px] text-gray-400 flex items-center gap-1.5 min-w-[75px] justify-end">
            {isOpening && <Loader2 size={10} className="animate-spin text-indigo-500" />}
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>
    </button>
  );
}
