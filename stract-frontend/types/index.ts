// Auth
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
}

// Workspace
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

// Project
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

// Status
export interface ProjectStatus {
  id: string;
  project_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
}

// Task
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
  creator: User | null;
  subtask_counts: {
    total: number;
    completed: number;
  };
}

// Subtask
export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
}

// Activity
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

export interface CreatedInvitation {
  token: string;
  workspace_id: string;
  invited_email: string;
  expires_at: string;
}

export interface UserActivity {
  activity_id: string;
  task_id: string;
  task_title: string;
  project_id: string;
  project_name: string;
  workspace_id: string;
  workspace_name: string;
  type: ActivityType;
  content: string | null;
  created_at: string;
}

// Analytics
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

export interface WorkspaceReports {
  kpis: ReportKPIs;
  status_distribution: StatusDistribution[];
  priority_breakdown: PriorityBreakdown[];
  velocity_over_time: VelocityData[];
  completion_rate_over_time: CompletionRateData[];
  burndown: BurndownData[];
  assignee_workload: AssigneeWorkload[];
  stale_trend: StaleTrendData[];
  projects_summary: ProjectSummaryItem[];
}

export interface ReportKPIs {
  total_active: number;
  completed_today: number;
  velocity_7d: number;
  velocity_30d: number;
  stale_count: number;
  completion_rate: number;
  backlog_health: 'good' | 'warning' | 'critical';
}

export interface StatusDistribution {
  status_name: string;
  color: string;
  count: number;
}

export interface PriorityBreakdown {
  priority: string;
  count: number;
}

export interface VelocityData {
  week: string;
  completed: number;
}

export interface CompletionRateData {
  date: string;
  rate: number;
}

export interface BurndownData {
  date: string;
  remaining: number;
  ideal: number;
}

export interface AssigneeWorkload {
  name: string;
  avatar_url: string | null;
  todo: number;
  in_progress: number;
  done: number;
}

export interface StaleTrendData {
  week: string;
  stale: number;
}

export interface ProjectSummaryItem {
  id: string;
  name: string;
  color: string;
  total: number;
  completed: number;
  completion_rate: number;
}

// API
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

// App State
export type BootState =
  | 'loading'
  | 'unauthenticated'
  | 'no-workspace'
  | 'workspace-selection'
  | 'no-project'
  | 'ready';

export type DueDateStatus = 'none' | 'overdue' | 'today' | 'upcoming';

// Meetings
export interface MeetingAttendee {
  user_id: string | null;
  name: string;
  email: string;
  avatar_url: string | null;
  is_external: boolean;
}

export interface MeetingActionItem {
  id: string;
  meeting_id: string;
  title: string;
  is_done: boolean;
  assignee_id: string | null;
  assignee_name: string | null;
  assignee_avatar: string | null;
  due_date: string | null;
  converted_task_id: string | null;
  created_at: string;
}

export interface MeetingNote {
  id: string;
  project_id: string;
  workspace_id: string;
  creator_id: string;
  title: string;
  meeting_date: string;
  location: string | null;
  attendees: MeetingAttendee[];
  agenda: string | null;
  notes: string | null;
  decisions: string | null;
  action_items: MeetingActionItem[];
  created_at: string;
  updated_at: string;
}

export interface MeetingListItem {
  id: string;
  title: string;
  meeting_date: string;
  creator_id: string;
  attendee_count: number;
  action_item_count: number;
  created_at: string;
}

// Forms (Phase 13B)
export type FieldType = 'text' | 'textarea' | 'select' | 'email' | 'date' | 'priority';

export interface FormField {
  id: string;
  form_id: string;
  label: string;
  field_type: FieldType;
  placeholder: string | null;
  options: string[] | null;
  is_required: boolean;
  position: number;
  created_at: string;
}

export interface ProjectForm {
  id: string;
  project_id: string;
  workspace_id: string;
  creator_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  auto_create: boolean;
  slug: string;
  default_status_id: string | null;
  default_priority: Priority;
  is_active: boolean;
  fields: FormField[];
  submission_count: number;
  created_at: string;
  updated_at: string;
}

export interface FormListItem {
  id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  auto_create: boolean;
  is_active: boolean;
  slug: string;
  submission_count: number;
  pending_count: number;
  created_at: string;
}

export interface FormSubmission {
  id: string;
  form_id: string;
  project_id: string;
  submitted_by: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  answers: Record<string, string>;
  status: 'pending' | 'approved' | 'rejected';
  task_id: string | null;
  created_at: string;
}

export interface PublicFormData {
  title: string;
  description: string | null;
  is_public: boolean;
  fields: FormField[];
}
