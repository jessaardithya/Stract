import { format, formatDistanceToNow, isPast, isToday } from 'date-fns';

export const formatDate = (dateStr) =>
  dateStr ? format(new Date(dateStr), 'MMM d, yyyy') : null;

export const formatRelative = (dateStr) =>
  dateStr ? formatDistanceToNow(new Date(dateStr), { addSuffix: true }) : null;

export const dueDateStatus = (dateStr) => {
  if (!dateStr) return 'none';
  const d = new Date(dateStr);
  
  // Create a date representing "today" at midnight for timezone-safe comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Normalize the input date to midnight as well
  const inputDate = new Date(d);
  inputDate.setHours(0, 0, 0, 0);

  if (inputDate < today) return 'overdue';
  if (inputDate.getTime() === today.getTime()) return 'today';
  
  return 'upcoming';
};
