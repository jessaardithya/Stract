// ─── Auth ──────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
}

// ─── Workspace ─────────────────────────────────────────────────────────────
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  description: string | null;
  archived_at: string | null;
  created_at: string;
  member_count?: number;
  active_task_count?: number;
}

export interface WorkspaceMember {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: 'owner' | 'member';
}

// ─── Project ───────────────────────────────────────────────────────────────
export interface Project {
  id: string;
  workspace_id: string;
  creator_id: string;
  name: string;
  description: string | null;
  color: string;
  archived_at: string | null;
  created_at: string;
  task_counts: {
    todo: number;
    'in-progress': number;
    done: number;
  };
}

export interface Label {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_at: string;
}

// ─── Status ────────────────────────────────────────────────────────────────
export interface ProjectStatus {
  id: string;
  project_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
}

// ─── Task ──────────────────────────────────────────────────────────────────
export type Priority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  project_id: string;
  creator_id: string;
  assignee_id: string | null;
  status_id: string;
  status: ProjectStatus;
  title: string;
  description: string | null;
  priority: Priority;
  label: string | null;
  position: number;
  start_date: string | null;
  due_date: string | null;
  last_moved_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  assignee: WorkspaceMember | null;
  subtask_counts: {
    total: number;
    completed: number;
  };
}

// ─── Subtask ───────────────────────────────────────────────────────────────
export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
}

// ─── Activity ──────────────────────────────────────────────────────────────
export type ActivityType =
  | 'comment'
  | 'status_change'
  | 'field_change'
  | 'created'
  | 'system';

export interface Activity {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_avatar: string | null;
  type: ActivityType;
  content: string | null;
  before_value: string | null;
  after_value: string | null;
  created_at: string;
}

export interface PendingInvitation {
  token: string;
  workspace_id: string;
  workspace_name: string;
  workspace_color: string;
  invited_by_name: string;
  expires_at: string;
}

export interface UserActivity {
  activity_id: string;
  task_id: string;
  task_title: string;
  project_id?: string;
  project_name: string;
  workspace_id: string;
  workspace_name: string;
  type: ActivityType;
  content: string | null;
  created_at: string;
}

// ─── Analytics ─────────────────────────────────────────────────────────────
export interface AnalyticsSummary {
  project_id: string;
  total_active: number;
  by_status: Record<string, number>;
  by_priority: {
    low: number;
    medium: number;
    high: number;
  };
  velocity_7d: number;
  stale_count: number;
  completion_rate: number;
  backlog_health: 'good' | 'warning' | 'critical';
}

// ─── API ───────────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

// ─── App State ─────────────────────────────────────────────────────────────
export type BootState =
  | 'loading'
  | 'unauthenticated'
  | 'no-workspace'
  | 'workspace-selection'
  | 'no-project'
  | 'ready';

export type DueDateStatus = 'none' | 'overdue' | 'today' | 'upcoming';
