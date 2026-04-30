'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { acceptInvitation } from '@/lib/api';
import type { PendingInvitation } from '@/types';

interface PendingInvitationCardProps {
  invitation: PendingInvitation;
  index: number;
  onAcceptSuccess: () => void;
  onDecline: (token: string) => void;
}

export default function PendingInvitationCard({
  invitation,
  index,
  onAcceptSuccess,
  onDecline,
}: PendingInvitationCardProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setIsBusy(true);
    setError(null);

    try {
      await acceptInvitation(invitation.token);
      onAcceptSuccess();
    } catch (err) {
      console.error('[home] failed to accept invitation', err);
      const message = err instanceof Error ? err.message : 'Could not accept invitation';
      setError(message);
      setIsBusy(false);
    }
  };

  const handleDecline = () => {
    onDecline(invitation.token);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 pt-3.5 flex flex-col gap-3 group relative hover:border-gray-300 transition-colors">
      <div className="min-w-0 pr-6">
        <div className="flex items-center gap-2">
          <span
            className="size-2 rounded-full shrink-0"
            style={{ backgroundColor: invitation.workspace_color || '#6366f1' }}
          />
          <p className="text-[13px] font-semibold text-gray-900 truncate">
            {invitation.workspace_name}
          </p>
        </div>
        <p className="mt-1 text-[12px] text-gray-500 truncate">
          Invited by <strong className="font-medium text-gray-700">{invitation.invited_by_name}</strong>
        </p>
        {error && (
          <p className="mt-1 text-[11px] text-red-500">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          className="flex-1 h-7 text-[12px] rounded border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 hover:border-indigo-300 shadow-none px-2"
          onClick={handleAccept}
          disabled={isBusy}
        >
          {isBusy ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Check size={12} className="mr-1.5" />}
          Accept
        </Button>
      </div>

      <button
        type="button"
        className="absolute top-3 right-3 text-gray-300 hover:text-gray-600 hover:bg-gray-100 p-1 rounded transition-colors"
        onClick={handleDecline}
        disabled={isBusy}
        aria-label="Decline invitation"
      >
        <X size={14} />
      </button>
    </div>
  );
}
