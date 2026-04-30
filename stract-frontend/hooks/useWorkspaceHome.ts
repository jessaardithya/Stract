import { useEffect, useState, useMemo, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getPendingInvitations, getMyActivity } from '@/lib/api';
import { useApp } from '@/context/AppContext';
import type { Workspace, PendingInvitation, UserActivity } from '@/types';

const ACTIVE_WORKSPACE_ID_KEY = 'activeWorkspaceId';
const ACTIVE_PROJECT_ID_KEY = 'activeProjectId';
const LAST_USED_WORKSPACE_ID_KEY = 'lastUsedWorkspaceId';
const FORCE_WORKSPACE_HOME_KEY = 'forceWorkspaceHome';

export function useWorkspaceHome() {
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

  const [busyWorkspaceId, setBusyWorkspaceId] = useState<string | null>(null);
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

        if (cancelled) return;

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
        if (cancelled) return;

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
        if (cancelled) return;

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

  const handleAcceptSuccess = async (token: string) => {
    const workspaceItems = await refreshWorkspaces();
    setWorkspaceList(workspaceItems);
    setPendingInvitations((prev) => prev.filter((item) => item.token !== token));
  };

  const handleDeclineSuccess = (token: string) => {
    setPendingInvitations((prev) => prev.filter((item) => item.token !== token));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(ACTIVE_WORKSPACE_ID_KEY);
    localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
    localStorage.removeItem(LAST_USED_WORKSPACE_ID_KEY);
    window.sessionStorage.removeItem(FORCE_WORKSPACE_HOME_KEY);
    window.location.href = '/login';
  };

  return {
    workspaceList,
    pendingInvitations,
    activity,
    displayName,
    currentUserId,
    workspaceLoading,
    invitationsLoading,
    activityLoading,
    invitationsError,
    activityError,
    busyWorkspaceId,
    lastUsedWorkspaceId,
    shouldShowCreateWorkspace,
    shouldShowInvitationsSection,
    shouldShowActivitySection,
    handleEnterWorkspace,
    handleAcceptSuccess,
    handleDeclineSuccess,
    handleSignOut,
    addWorkspace,
    setLastUsedWorkspaceId,
  };
}
