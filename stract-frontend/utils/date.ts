import { format, formatDistanceToNow, isPast, isToday } from 'date-fns';
import type { DueDateStatus } from '@/types';

export const formatDate = (dateStr: string | null | undefined): string | null => {
  if (!dateStr) return null;
  return format(new Date(dateStr), 'MMM d, yyyy');
};

export const formatRelative = (dateStr: string | null | undefined): string | null => {
  if (!dateStr) return null;
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
};

export const dueDateStatus = (dateStr: string | null | undefined): DueDateStatus => {
  if (!dateStr) return 'none';
  const d = new Date(dateStr);
  if (isPast(d) && !isToday(d)) return 'overdue';
  if (isToday(d)) return 'today';
  return 'upcoming';
};
