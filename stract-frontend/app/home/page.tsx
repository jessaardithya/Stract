'use client';

import { useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import CreateWorkspace from '@/components/onboarding/CreateWorkspace';
import WorkspaceCard from '@/components/home/WorkspaceCard';
import PendingInvitationCard from '@/components/home/PendingInvitationCard';
import ActivityRow from '@/components/home/ActivityRow';
import { HomeSidebar } from '@/components/home/HomeSidebar';
import { useWorkspaceHome } from '@/hooks/useWorkspaceHome';
import { createWorkspace } from '@/lib/api';
import { deriveSlug } from '@/utils/slug';

const FORCE_WORKSPACE_HOME_KEY = 'forceWorkspaceHome';

function HomeSkeleton() {
  return (
    <div className="min-h-screen bg-[#fafaf8]">
      <div className="max-w-[1200px] mx-auto px-8 py-10 animate-pulse">
        <div className="space-y-2 mb-10">
          <div className="h-8 w-64 rounded bg-[#e4e4e0]" />
          <div className="h-4 w-48 rounded bg-[#f0efeb]" />
        </div>
        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <div className="mb-4 h-3 w-36 rounded bg-[#e4e4e0]" />
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-40 rounded-xl border border-[#e4e4e0] bg-white" />
              ))}
            </div>
          </div>
          <div className="lg:col-span-1 space-y-10">
            <div>
              <div className="mb-4 h-3 w-36 rounded bg-[#e4e4e0]" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-16 rounded-lg border border-[#e4e4e0] bg-white" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceHomePage() {
  const router = useRouter();
  const {
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
  } = useWorkspaceHome();

  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

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

  const handleCreateWorkspaceSubmit = async () => {
    const trimmedName = workspaceName.trim();
    const trimmedSlug = workspaceSlug.trim();

    if (!trimmedName || !trimmedSlug || creatingWorkspace) return;

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

  if (workspaceLoading) return <HomeSkeleton />;
  if (shouldShowCreateWorkspace) return <CreateWorkspace />;

  return (
    <div className="flex min-h-screen bg-[#fafaf8] font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <HomeSidebar
        workspaces={workspaceList}
        lastUsedWorkspaceId={lastUsedWorkspaceId}
        displayName={displayName}
        onEnterWorkspace={handleEnterWorkspace}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-8 py-10">
          <header className="mb-10">
            <h1 className="text-[28px] font-semibold tracking-tight text-gray-900">
              Welcome back, {displayName}
            </h1>
            <p className="mt-1 text-[14px] text-gray-500">
              Choose a workspace to continue where you left off.
            </p>
          </header>

          <div className="grid lg:grid-cols-[1fr_360px] gap-10">
            {/* Left Column: Workspaces */}
            <section className="min-w-0">
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-gray-400 mb-5">
                Your Workspaces
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                {workspaceList.map((workspace, index) => (
                  <WorkspaceCard
                    key={workspace.id}
                    workspace={workspace}
                    index={index}
                    isOwner={currentUserId === workspace.owner_id}
                    isBusy={busyWorkspaceId === workspace.id}
                    lastUsedWorkspaceId={lastUsedWorkspaceId}
                    onEnterWorkspace={handleEnterWorkspace}
                  />
                ))}

                <button
                  type="button"
                  onClick={() => setNewWorkspaceOpen(true)}
                  className="bg-white rounded-xl border-dashed border border-gray-300 p-5 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-left min-h-[190px] flex flex-col justify-between group"
                >
                  <div className="size-10 rounded-lg border border-gray-200 bg-gray-50 text-gray-400 group-hover:text-indigo-600 group-hover:border-indigo-200 group-hover:bg-white flex items-center justify-center transition-colors">
                    <Plus size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-900 transition-colors">New Workspace</p>
                    <p className="mt-1 text-[13px] text-gray-500">
                      Start a fresh space for a client, team, or personal workstream.
                    </p>
                  </div>
                </button>
              </div>
            </section>

            {/* Right Column: Activity & Invitations */}
            <aside className="space-y-10 min-w-0">
              {shouldShowInvitationsSection && (
                <section>
                  <h2 className="text-[12px] font-semibold uppercase tracking-wider text-gray-400 mb-5">
                    Pending Invitations
                  </h2>
                  <div className="space-y-3">
                    {invitationsLoading ? (
                      <div className="text-sm text-gray-400">Loading invitations...</div>
                    ) : invitationsError ? (
                      <div className="text-sm text-gray-400">{invitationsError}</div>
                    ) : (
                      pendingInvitations.map((invitation, index) => (
                        <PendingInvitationCard
                          key={invitation.token}
                          invitation={invitation}
                          index={index}
                          onAcceptSuccess={() => handleAcceptSuccess(invitation.token)}
                          onDecline={() => handleDeclineSuccess(invitation.token)}
                        />
                      ))
                    )}
                  </div>
                </section>
              )}

              {shouldShowActivitySection && (
                <section>
                  <h2 className="text-[12px] font-semibold uppercase tracking-wider text-gray-400 mb-5">
                    Recent Activity
                  </h2>

                  {activityLoading ? (
                    <div className="text-sm text-gray-400">Loading activity...</div>
                  ) : activityError ? (
                    <div className="text-sm text-gray-400">{activityError}</div>
                  ) : (
                    <div className="relative">
                      {/* Optional timeline line aesthetic */}
                      <div className="absolute left-[19px] top-4 bottom-4 w-px bg-slate-200 pointer-events-none hidden sm:block" />
                      
                      <div className="space-y-1">
                        {activity.map((item, index) => (
                          <ActivityRow
                            key={item.activity_id}
                            item={item}
                            index={index}
                            currentUserId={currentUserId}
                            isOpening={busyWorkspaceId === item.workspace_id}
                            onOpenActivity={async (activityItem) => {
                              const ws = workspaceList.find((entry) => entry.id === activityItem.workspace_id);
                              if (ws) {
                                await handleEnterWorkspace(ws, { projectId: activityItem.project_id ?? null });
                              }
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </aside>
          </div>
        </div>
      </main>

      <Dialog
        open={newWorkspaceOpen}
        onOpenChange={(open) => !creatingWorkspace && (open ? setNewWorkspaceOpen(true) : resetWorkspaceDialog())}
      >
        <DialogContent className="sm:max-w-[420px] rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">Create a workspace</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5 focus-within:text-indigo-600">
              <label className="text-[12px] font-medium text-gray-700 transition-colors focus-within:text-indigo-600" htmlFor="workspace-name">
                Workspace name
              </label>
              <Input
                id="workspace-name"
                type="text"
                value={workspaceName}
                onChange={(event) => handleWorkspaceNameChange(event.target.value)}
                placeholder="Acme Corp"
                disabled={creatingWorkspace}
                className="h-10 rounded-lg text-[13px] border-gray-200 bg-white shadow-sm focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 placeholder:text-gray-400"
              />
            </div>

            <div className="space-y-1.5 focus-within:text-indigo-600">
              <label className="text-[12px] font-medium text-gray-700 transition-colors focus-within:text-indigo-600" htmlFor="workspace-description">
                Description
              </label>
              <Input
                id="workspace-description"
                type="text"
                value={workspaceDescription}
                onChange={(event) => setWorkspaceDescription(event.target.value)}
                placeholder="What is this workspace for?"
                disabled={creatingWorkspace}
                className="h-10 rounded-lg text-[13px] border-gray-200 bg-white shadow-sm focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 placeholder:text-gray-400"
              />
            </div>

            <div className="space-y-1.5 focus-within:text-indigo-600">
              <label className="text-[12px] font-medium text-gray-700 transition-colors focus-within:text-indigo-600" htmlFor="workspace-slug">
                Workspace URL
              </label>
              <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 focus-within:ring-[3px] focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-shadow">
                <span className="border-r border-gray-200 px-3 py-2 text-[13px] text-gray-500 bg-gray-50/50">
                  stract.app/
                </span>
                <input
                  id="workspace-slug"
                  value={workspaceSlug}
                  onChange={(event) => handleWorkspaceSlugChange(event.target.value)}
                  className="flex-1 bg-white px-3 py-2 text-[13px] text-gray-900 outline-none"
                  placeholder="acme-corp"
                  disabled={creatingWorkspace}
                />
              </div>
              {workspaceError && <p className="text-[12px] text-red-500 pt-1">{workspaceError}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={resetWorkspaceDialog}
                disabled={creatingWorkspace}
                className="h-9 rounded-lg text-[13px] text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-9 rounded-lg px-4 text-[13px] bg-indigo-600 text-white hover:bg-indigo-700"
                onClick={handleCreateWorkspaceSubmit}
                disabled={!workspaceName.trim() || !workspaceSlug.trim() || creatingWorkspace}
              >
                {creatingWorkspace && <Loader2 size={14} className="animate-spin mr-2" />}
                Create workspace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
