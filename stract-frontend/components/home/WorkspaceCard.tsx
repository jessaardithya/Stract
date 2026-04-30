'use client';

import { useState } from 'react';
import { Loader2, Users, FolderKanban, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createInvitation } from '@/lib/api';
import type { Workspace } from '@/types';

interface WorkspaceCardProps {
  workspace: Workspace;
  index: number;
  isOwner: boolean;
  isBusy: boolean;
  lastUsedWorkspaceId: string | null;
  onEnterWorkspace: (workspace: Workspace) => void;
}

export default function WorkspaceCard({
  workspace,
  index,
  isOwner,
  isBusy,
  lastUsedWorkspaceId,
  onEnterWorkspace,
}: WorkspaceCardProps) {
  const [invitedEmail, setInvitedEmail] = useState('');
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccessEmail, setInviteSuccessEmail] = useState<string | null>(null);

  const handleCreateMemberInvite = async () => {
    if (isCreatingInvite) {
      return;
    }

    const email = invitedEmail.trim().toLowerCase();
    if (!email) {
      setInviteError('Enter the teammate email first');
      return;
    }

    setIsCreatingInvite(true);
    setInviteError(null);
    setInviteSuccessEmail(null);

    try {
      const result = await createInvitation(workspace.id, {
        invited_email: email,
        expires_in_days: 7,
      });
      setInviteSuccessEmail(result.data.invited_email || email);
      setInvitedEmail('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not add members right now';
      setInviteError(message);
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const isLastUsed = lastUsedWorkspaceId === workspace.id;

  return (
    <div
      role="button"
      tabIndex={isBusy ? -1 : 0}
      onClick={() => onEnterWorkspace(workspace)}
      onKeyDown={(event) => {
        if (isBusy) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          void onEnterWorkspace(workspace);
        }
      }}
      className={`bg-white rounded-xl border p-5 cursor-pointer text-left transition-all ${
        isLastUsed ? 'border-indigo-200 shadow-sm' : 'border-gray-200 hover:border-gray-300'
      }`}
      aria-disabled={isBusy}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="size-10 rounded-lg bg-indigo-50 border border-indigo-100/50 text-indigo-600 flex items-center justify-center text-[15px] font-semibold shrink-0">
          {workspace.name[0]?.toUpperCase() ?? 'W'}
        </div>

        <div className="flex items-center gap-2">
          {isLastUsed && (
            <span className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
              Active
            </span>
          )}
          {isBusy && <Loader2 size={15} className="animate-spin text-gray-400 shrink-0" />}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[14px] font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">{workspace.name}</p>
        <p className="mt-1 text-[13px] text-gray-500 line-clamp-2">
          {workspace.description?.trim() || 'Shared planning space for your team and projects.'}
        </p>
      </div>

      <div className="mt-4 flex items-center gap-4 text-[12px] text-gray-500 font-medium">
        <span className="inline-flex items-center gap-1.5">
          <Users size={13} />
          {workspace.member_count ?? 0} members
        </span>
        <span className="inline-flex items-center gap-1.5 border-l border-gray-200 pl-4">
          <FolderKanban size={13} />
          {workspace.active_task_count ?? 0} tasks
        </span>
      </div>

      {isOwner && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <div
            className="flex flex-col gap-2 sm:flex-row relative"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Input
              type="email"
              value={invitedEmail}
              onChange={(event) => {
                setInvitedEmail(event.target.value);
                setInviteError(null);
                setInviteSuccessEmail(null);
              }}
              placeholder="Teammate email"
              className="h-8 rounded-md border-gray-200 bg-white text-[12px] focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 placeholder:text-gray-400 pr-[70px]"
              disabled={isCreatingInvite}
            />
            <Button
              type="button"
              size="sm"
              className="absolute right-1 top-1 bottom-1 h-6 rounded px-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 shadow-none border-none text-[11px] font-semibold"
              disabled={isCreatingInvite || !invitedEmail}
              onClick={(event) => {
                event.stopPropagation();
                void handleCreateMemberInvite();
              }}
            >
              {isCreatingInvite ? <Loader2 size={12} className="animate-spin" /> : 'Invite'}
            </Button>
          </div>
          {inviteError && (
            <p className="mt-1.5 text-[11px] text-red-500">{inviteError}</p>
          )}
          {inviteSuccessEmail && !inviteError && (
            <p className="mt-1.5 text-[11px] text-gray-500">
              Invitation sent to <strong className="text-gray-700">{inviteSuccessEmail}</strong>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
