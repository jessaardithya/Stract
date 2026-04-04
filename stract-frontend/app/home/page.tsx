'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import {
  Check,
  Clock3,
  Hexagon,
  Inbox,
  Loader2,
  LogOut,
  Plus,
  UserPlus,
  Users,
  FolderKanban,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import CreateWorkspace from '@/components/onboarding/CreateWorkspace';
import { useApp } from '@/context/AppContext';
import { acceptInvitation, createInvitation, createWorkspace, getMyActivity, getPendingInvitations } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { PendingInvitation, UserActivity, Workspace } from '@/types';
import { deriveSlug } from '@/utils/slug';

const ACTIVE_WORKSPACE_ID_KEY = 'activeWorkspaceId';
const ACTIVE_PROJECT_ID_KEY = 'activeProjectId';
const LAST_USED_WORKSPACE_ID_KEY = 'lastUsedWorkspaceId';
const FORCE_WORKSPACE_HOME_KEY = 'forceWorkspaceHome';

function HomeSkeleton() {
  return (
    <div className="min-h-screen bg-[#fafaf8]">
      <div className="max-w-4xl mx-auto px-6 py-8 animate-pulse">
        <div className="flex items-center justify-between pb-6 border-b border-[#e4e4e0]">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[#e4e4e0]" />
            <div className="space-y-2">
              <div className="h-4 w-20 rounded bg-[#e4e4e0]" />
              <div className="h-3 w-32 rounded bg-[#f0efeb]" />
            </div>
          </div>
          <div className="h-9 w-24 rounded-lg bg-[#e4e4e0]" />
        </div>

        <div className="mt-10 space-y-10">
          <div>
            <div className="mb-5 h-3 w-36 rounded bg-[#e4e4e0]" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-40 rounded-xl border border-[#e4e4e0] bg-white" />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-5 h-3 w-40 rounded bg-[#e4e4e0]" />
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="h-16 rounded-xl border border-[#e4e4e0] bg-white" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvitationRowsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className="h-[74px] rounded-xl border border-[#e4e4e0] bg-white"
        />
      ))}
    </div>
  );
}

function ActivityRowsSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="h-14 rounded-lg border border-[#e4e4e0] bg-white"
        />
      ))}
    </div>
  );
}

function describeActivity(item: UserActivity) {
  if (item.content?.trim()) {
    return item.content;
  }

  if (item.type === 'created') {
    return `Created "${item.task_title}"`;
  }

  if (item.type === 'comment') {
    return `Commented on "${item.task_title}"`;
  }

  if (item.type === 'status_change') {
    return `Updated the status on "${item.task_title}"`;
  }

  if (item.type === 'field_change') {
    return `Edited "${item.task_title}"`;
  }

  return `Updated "${item.task_title}"`;
}

export default function WorkspaceHomePage() {
  const router = useRouter();
  const {
    addWorkspace,
    refreshWorkspaces,
    setActiveWorkspace,
    workspaces: contextWorkspaces,
  } = useApp();

  const [workspaceList, setWorkspaceList] = useState<Workspace[]>(contextWorkspaces);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [activity, setActivity] = useState<UserActivity[]>([]);
  const [displayName, setDisplayName] = useState('there');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [invitationErrors, setInvitationErrors] = useState<Record<string, string>>({});
  const [workspaceInviteErrors, setWorkspaceInviteErrors] = useState<Record<string, string>>({});
  const [workspaceInviteEmails, setWorkspaceInviteEmails] = useState<Record<string, string>>({});
  const [workspaceInviteSuccess, setWorkspaceInviteSuccess] = useState<Record<string, string>>({});
  const [creatingInviteWorkspaceId, setCreatingInviteWorkspaceId] = useState<string | null>(null);
  const [busyWorkspaceId, setBusyWorkspaceId] = useState<string | null>(null);
  const [busyInvitationToken, setBusyInvitationToken] = useState<string | null>(null);
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [lastUsedWorkspaceId, setLastUsedWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLastUsedWorkspaceId(
        localStorage.getItem(LAST_USED_WORKSPACE_ID_KEY) ||
        localStorage.getItem(ACTIVE_WORKSPACE_ID_KEY),
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspaceHome = async () => {
      setWorkspaceLoading(true);

      try {
        const [workspaceItems, userResult] = await Promise.all([
          refreshWorkspaces(),
          supabase.auth.getUser(),
        ]);

        if (cancelled) {
          return;
        }

        const nextUser = userResult.data.user;
        const nextName =
          nextUser?.user_metadata?.full_name ||
          nextUser?.user_metadata?.name ||
          nextUser?.email?.split('@')[0] ||
          'there';

        setWorkspaceList(workspaceItems);
        setDisplayName(nextName);
        setCurrentUserId(nextUser?.id ?? null);
      } catch (err) {
        console.error('[home] failed to load workspace hub', err);
      } finally {
        if (!cancelled) {
          setWorkspaceLoading(false);
        }
      }
    };

    const loadInvitations = async () => {
      setInvitationsLoading(true);
      setInvitationsError(null);

      try {
        const result = await getPendingInvitations();
        if (cancelled) {
          return;
        }

        setPendingInvitations(result.data || []);
      } catch (err) {
        console.error('[home] failed to load invitations', err);
        if (!cancelled) {
          setPendingInvitations([]);
          setInvitationsError('Could not load invitations');
        }
      } finally {
        if (!cancelled) {
          setInvitationsLoading(false);
        }
      }
    };

    const loadActivity = async () => {
      setActivityLoading(true);
      setActivityError(null);

      try {
        const result = await getMyActivity();
        if (cancelled) {
          return;
        }

        setActivity(result.data || []);
      } catch (err) {
        console.error('[home] failed to load activity', err);
        if (!cancelled) {
          setActivity([]);
          setActivityError('Could not load activity');
        }
      } finally {
        if (!cancelled) {
          setActivityLoading(false);
        }
      }
    };

    loadWorkspaceHome();
    loadInvitations();
    loadActivity();

    return () => {
      cancelled = true;
    };
  }, [refreshWorkspaces]);

  const shouldShowCreateWorkspace = useMemo(
    () =>
      !workspaceLoading &&
      !invitationsLoading &&
      !invitationsError &&
      workspaceList.length === 0 &&
      pendingInvitations.length === 0,
    [workspaceLoading, invitationsLoading, invitationsError, pendingInvitations.length, workspaceList.length],
  );

  const shouldShowInvitationsSection =
    invitationsLoading || pendingInvitations.length > 0 || invitationsError !== null;

  const shouldShowActivitySection =
    activityLoading || activity.length > 0 || activityError !== null;

  const resetWorkspaceDialog = () => {
    setNewWorkspaceOpen(false);
    setWorkspaceName('');
    setWorkspaceDescription('');
    setWorkspaceSlug('');
    setSlugEdited(false);
    setWorkspaceError('');
  };

  const handleWorkspaceNameChange = (value: string) => {
    setWorkspaceName(value);
    if (!slugEdited) {
      setWorkspaceSlug(deriveSlug(value));
      setWorkspaceError('');
    }
  };

  const handleWorkspaceSlugChange = (value: string) => {
    setSlugEdited(true);
    setWorkspaceSlug(deriveSlug(value));
    setWorkspaceError('');
  };

  const handleEnterWorkspace = async (
    workspace: Workspace,
    options?: { projectId?: string | null },
  ) => {
    setBusyWorkspaceId(workspace.id);
    setLastUsedWorkspaceId(workspace.id);

    try {
      window.sessionStorage.removeItem(FORCE_WORKSPACE_HOME_KEY);
      await setActiveWorkspace(workspace, { projectId: options?.projectId ?? null });
      startTransition(() => router.push('/'));
    } finally {
      setBusyWorkspaceId(null);
    }
  };

  const handleCreateWorkspace = async () => {
    const trimmedName = workspaceName.trim();
    const trimmedSlug = workspaceSlug.trim();

    if (!trimmedName || !trimmedSlug || creatingWorkspace) {
      return;
    }

    setCreatingWorkspace(true);
    setWorkspaceError('');

    try {
      const result = await createWorkspace({
        name: trimmedName,
        slug: trimmedSlug,
        description: workspaceDescription.trim(),
      });

      resetWorkspaceDialog();
      await addWorkspace(result.data);
      setLastUsedWorkspaceId(result.data.id);
      window.sessionStorage.removeItem(FORCE_WORKSPACE_HOME_KEY);
      startTransition(() => router.push('/'));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      if (message.toLowerCase().includes('slug') || message.toLowerCase().includes('taken')) {
        setWorkspaceError('This URL is already taken');
      } else {
        setWorkspaceError(message);
      }
    } finally {
      setCreatingWorkspace(false);
    }
  };

  const handleAcceptInvitation = async (invitation: PendingInvitation) => {
    setBusyInvitationToken(invitation.token);
    setInvitationErrors((prev) => {
      const next = { ...prev };
      delete next[invitation.token];
      return next;
    });

    try {
      await acceptInvitation(invitation.token);
      const workspaceItems = await refreshWorkspaces();
      setWorkspaceList(workspaceItems);
      setPendingInvitations((prev) => prev.filter((item) => item.token !== invitation.token));
    } catch (err) {
      console.error('[home] failed to accept invitation', err);
      const message = err instanceof Error ? err.message : 'Could not accept invitation';
      setInvitationErrors((prev) => ({
        ...prev,
        [invitation.token]: message,
      }));
    } finally {
      setBusyInvitationToken(null);
    }
  };

  const handleDeclineInvitation = (token: string) => {
    setInvitationErrors((prev) => {
      const next = { ...prev };
      delete next[token];
      return next;
    });
    setPendingInvitations((prev) => prev.filter((item) => item.token !== token));
  };

  const handleCreateMemberInvite = async (workspace: Workspace) => {
    if (creatingInviteWorkspaceId) {
      return;
    }

    const invitedEmail = workspaceInviteEmails[workspace.id]?.trim().toLowerCase() || '';
    if (!invitedEmail) {
      setWorkspaceInviteErrors((prev) => ({
        ...prev,
        [workspace.id]: 'Enter the teammate email first',
      }));
      return;
    }

    setCreatingInviteWorkspaceId(workspace.id);
    setWorkspaceInviteSuccess((prev) => {
      const next = { ...prev };
      delete next[workspace.id];
      return next;
    });
    setWorkspaceInviteErrors((prev) => {
      const next = { ...prev };
      delete next[workspace.id];
      return next;
    });

    try {
      const result = await createInvitation(workspace.id, {
        invited_email: invitedEmail,
        expires_in_days: 7,
      });
      setWorkspaceInviteSuccess((prev) => ({
        ...prev,
        [workspace.id]: result.data.invited_email || invitedEmail,
      }));
      setWorkspaceInviteEmails((prev) => ({
        ...prev,
        [workspace.id]: '',
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not add members right now';
      setWorkspaceInviteErrors((prev) => ({
        ...prev,
        [workspace.id]: message,
      }));
    } finally {
      setCreatingInviteWorkspaceId(null);
    }
  };

  const handleWorkspaceInviteEmailChange = (workspaceId: string, value: string) => {
    setWorkspaceInviteEmails((prev) => ({
      ...prev,
      [workspaceId]: value,
    }));
    setWorkspaceInviteErrors((prev) => {
      const next = { ...prev };
      delete next[workspaceId];
      return next;
    });
    setWorkspaceInviteSuccess((prev) => {
      const next = { ...prev };
      delete next[workspaceId];
      return next;
    });
  };

  const handleOpenActivity = async (item: UserActivity) => {
    const workspace = workspaceList.find((entry) => entry.id === item.workspace_id);
    if (!workspace) {
      return;
    }

    try {
      await handleEnterWorkspace(workspace, {
        projectId: item.project_id ?? null,
      });
    } catch (err) {
      console.error('[home] failed to open activity workspace', err);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(ACTIVE_WORKSPACE_ID_KEY);
    localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
    localStorage.removeItem(LAST_USED_WORKSPACE_ID_KEY);
    window.sessionStorage.removeItem(FORCE_WORKSPACE_HOME_KEY);
    window.location.href = '/login';
  };

  if (workspaceLoading) {
    return <HomeSkeleton />;
  }

  if (shouldShowCreateWorkspace) {
    return <CreateWorkspace />;
  }

  return (
    <>
      <main className="min-h-screen bg-[#fafaf8]">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <header className="flex items-center justify-between gap-4 border-b border-[#e4e4e0] pb-6">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-sm">
                <Hexagon size={20} className="fill-current" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-950">Stract</p>
                <p className="text-sm text-gray-500">Workspace home</p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-[#8a8a85] hover:bg-[#f4f4f2] hover:text-gray-950"
              onClick={handleSignOut}
            >
              <LogOut size={14} />
              Sign out
            </Button>
          </header>

          <section className="pt-10">
            <p className="text-3xl font-semibold tracking-tight text-gray-950">
              Welcome back, {displayName}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Choose a workspace to continue where you left off.
            </p>
          </section>

          <section className="mt-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
              Your Workspaces
            </p>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {workspaceList.map((workspace) => {
                const isBusy = busyWorkspaceId === workspace.id;
                const isOwner = currentUserId === workspace.owner_id;
                const isCreatingInvite = creatingInviteWorkspaceId === workspace.id;
                const inviteSuccessEmail = workspaceInviteSuccess[workspace.id];
                return (
                  <div
                    key={workspace.id}
                    role="button"
                    tabIndex={isBusy ? -1 : 0}
                    onClick={() => handleEnterWorkspace(workspace)}
                    onKeyDown={(event) => {
                      if (isBusy) {
                        return;
                      }
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void handleEnterWorkspace(workspace);
                      }
                    }}
                    className="bg-white rounded-xl border border-[#e4e4e0] p-5 hover:border-violet-200 hover:shadow-sm cursor-pointer transition-all text-left"
                    aria-disabled={isBusy}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="size-11 rounded-2xl bg-gradient-to-br from-violet-500 via-violet-500 to-blue-500 text-white flex items-center justify-center text-lg font-semibold shadow-sm">
                        {workspace.name[0]?.toUpperCase() ?? 'W'}
                      </div>

                      <div className="flex items-center gap-2">
                        {lastUsedWorkspaceId === workspace.id && (
                          <span className="inline-flex items-center rounded-full bg-[#f4f1ff] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                            Last used
                          </span>
                        )}
                        {isBusy && <Loader2 size={15} className="animate-spin text-violet-600" />}
                      </div>
                    </div>

                    <div className="mt-5">
                      <p className="text-base font-semibold text-gray-950">{workspace.name}</p>
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                        {workspace.description?.trim() || 'Shared planning space for your team and projects.'}
                      </p>
                    </div>

                    <div className="mt-5 flex items-center gap-4 text-sm text-gray-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Users size={14} />
                        {workspace.member_count ?? 0} members
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <FolderKanban size={14} />
                        {workspace.active_task_count ?? 0} active tasks
                      </span>
                    </div>

                    {isOwner && (
                      <div className="mt-4">
                        <div
                          className="flex flex-col gap-2 sm:flex-row"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <Input
                            type="email"
                            value={workspaceInviteEmails[workspace.id] || ''}
                            onChange={(event) =>
                              handleWorkspaceInviteEmailChange(workspace.id, event.target.value)
                            }
                            placeholder="teammate@email.com"
                            className="h-9 border-[#e4e4e0] bg-[#fafaf8] text-sm"
                            disabled={isCreatingInvite}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-[#e4e4e0] bg-[#fafaf8] text-gray-700 hover:bg-[#f4f4f2]"
                            disabled={isCreatingInvite}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleCreateMemberInvite(workspace);
                            }}
                          >
                            {isCreatingInvite ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                            Invite
                          </Button>
                        </div>
                        {workspaceInviteErrors[workspace.id] && (
                          <p className="mt-2 text-xs text-red-500">{workspaceInviteErrors[workspace.id]}</p>
                        )}
                        {inviteSuccessEmail && !workspaceInviteErrors[workspace.id] && (
                          <p className="mt-2 text-xs text-gray-400">
                            Invitation sent to {inviteSuccessEmail}. They can accept it from `/home`.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setNewWorkspaceOpen(true)}
                className="bg-white rounded-xl border-dashed border-2 border-[#e4e4e0] p-5 hover:border-violet-200 hover:bg-[#fcfbff] transition-all text-left min-h-[204px] flex flex-col justify-between"
              >
                <div className="size-11 rounded-2xl border border-[#e4e4e0] text-gray-500 flex items-center justify-center">
                  <Plus size={18} />
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-950">New Workspace</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Start a fresh space for a client, team, or personal workstream.
                  </p>
                </div>
              </button>
            </div>
          </section>

          {shouldShowInvitationsSection && (
            <section className="mt-10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                Pending Invitations
              </p>

              {invitationsLoading ? (
                <InvitationRowsSkeleton />
              ) : invitationsError ? (
                <div className="text-sm text-gray-400">{invitationsError}</div>
              ) : (
                <div className="space-y-3">
                  {pendingInvitations.map((invitation) => {
                    const isBusy = busyInvitationToken === invitation.token;
                    return (
                      <div
                        key={invitation.token}
                        className="bg-white rounded-xl border border-[#e4e4e0] px-5 py-4"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="size-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: invitation.workspace_color || '#6366f1' }}
                              />
                              <p className="text-sm font-semibold text-gray-950">
                                {invitation.workspace_name}
                              </p>
                            </div>
                            <p className="mt-1 text-sm text-gray-500">
                              invited by {invitation.invited_by_name}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                              Expires {formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })}
                            </p>
                            {invitationErrors[invitation.token] && (
                              <p className="mt-2 text-xs text-red-500">
                                {invitationErrors[invitation.token]}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="bg-violet-600 text-white hover:bg-violet-700"
                              onClick={() => handleAcceptInvitation(invitation)}
                              disabled={isBusy}
                            >
                              {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              Accept
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-gray-400 hover:bg-[#f4f4f2] hover:text-gray-600"
                              onClick={() => handleDeclineInvitation(invitation.token)}
                              disabled={isBusy}
                            >
                              <X size={14} />
                              Decline
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {shouldShowActivitySection && (
            <section className="mt-10 pb-12">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                Recent Activity
              </p>

              {activityLoading ? (
                <ActivityRowsSkeleton />
              ) : activityError ? (
                <div className="text-sm text-gray-400">{activityError}</div>
              ) : (
                <div className="space-y-2">
                  {activity.map((item) => {
                    const isOpening = busyWorkspaceId === item.workspace_id;
                    return (
                      <button
                        key={item.activity_id}
                        type="button"
                        onClick={() => handleOpenActivity(item)}
                        className="w-full rounded-lg px-4 py-3 text-left text-sm text-gray-700 hover:bg-[#f4f4f2] transition-colors flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                        disabled={isOpening}
                      >
                        <div className="min-w-0 flex items-center gap-3">
                          <span className="size-8 rounded-full bg-[#f4f4f2] text-gray-500 flex items-center justify-center shrink-0">
                            <Inbox size={14} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate">{describeActivity(item)}</p>
                            <p className="mt-0.5 truncate text-xs text-gray-400">
                              {item.task_title} · {item.project_name}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
                          <span className="inline-flex items-center rounded-full bg-[#f4f4f2] px-2 py-1 text-[11px] font-medium text-gray-500">
                            {item.workspace_name}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            {isOpening ? <Loader2 size={13} className="animate-spin" /> : <Clock3 size={13} />}
                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      <Dialog
        open={newWorkspaceOpen}
        onOpenChange={(open) => !creatingWorkspace && (open ? setNewWorkspaceOpen(true) : resetWorkspaceDialog())}
      >
        <DialogContent className="sm:max-w-[420px] border-[#e4e4e0] bg-white">
          <DialogHeader>
            <DialogTitle>Create a workspace</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="workspace-name">
                Workspace name
              </label>
              <Input
                id="workspace-name"
                type="text"
                value={workspaceName}
                onChange={(event) => handleWorkspaceNameChange(event.target.value)}
                placeholder="Acme Corp"
                disabled={creatingWorkspace}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="workspace-description">
                Description
              </label>
              <Input
                id="workspace-description"
                type="text"
                value={workspaceDescription}
                onChange={(event) => setWorkspaceDescription(event.target.value)}
                placeholder="What is this workspace for?"
                disabled={creatingWorkspace}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="workspace-slug">
                Workspace URL
              </label>
              <div className="flex items-center overflow-hidden rounded-lg border border-[#e4e4e0] bg-[#fafaf8]">
                <span className="border-r border-[#e4e4e0] px-3 py-2 text-sm text-gray-400">
                  stract.app /
                </span>
                <input
                  id="workspace-slug"
                  value={workspaceSlug}
                  onChange={(event) => handleWorkspaceSlugChange(event.target.value)}
                  className="flex-1 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                  placeholder="acme-corp"
                  disabled={creatingWorkspace}
                />
              </div>
              {workspaceError && <p className="text-sm text-red-500">{workspaceError}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={resetWorkspaceDialog}
                disabled={creatingWorkspace}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-violet-600 text-white hover:bg-violet-700"
                onClick={handleCreateWorkspace}
                disabled={!workspaceName.trim() || !workspaceSlug.trim() || creatingWorkspace}
              >
                {creatingWorkspace && <Loader2 size={14} className="animate-spin" />}
                Create workspace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
