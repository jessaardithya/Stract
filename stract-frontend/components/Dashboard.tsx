"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCheck,
  Layers3,
  TimerReset,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useApp } from "@/context/AppContext";
import { getAnalytics } from "@/lib/api";
import type { AnalyticsSummary } from "@/types";

const HEALTH = {
  good: {
    label: "On track",
    chip:
      "border-emerald-200/80 bg-emerald-50 text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
    tone: "text-emerald-700",
    surface: "bg-emerald-50/80",
    hint: "Healthy pace with a balanced backlog.",
  },
  warning: {
    label: "At risk",
    chip:
      "border-amber-200/80 bg-amber-50 text-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
    tone: "text-amber-700",
    surface: "bg-amber-50/80",
    hint: "Progress is moving, but carry-over is building up.",
  },
  critical: {
    label: "Critical",
    chip:
      "border-red-200/80 bg-red-50 text-red-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
    tone: "text-red-600",
    surface: "bg-red-50/80",
    hint: "The board needs intervention to avoid slippage.",
  },
} as const;

const STATUS_META = [
  {
    key: "todo",
    label: "Todo",
    color: "bg-stone-300",
    track: "bg-stone-200/80",
    text: "text-stone-700",
  },
  {
    key: "in-progress",
    label: "In progress",
    color: "bg-sky-500",
    track: "bg-sky-100",
    text: "text-sky-700",
  },
  {
    key: "done",
    label: "Done",
    color: "bg-emerald-500",
    track: "bg-emerald-100",
    text: "text-emerald-700",
  },
] as const;

const PRIORITY_META = [
  {
    key: "high",
    label: "High priority",
    icon: AlertTriangle,
    accent: "text-rose-600",
    pill: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/80",
    surface: "border-rose-200/80 bg-rose-50/55",
  },
  {
    key: "medium",
    label: "Medium priority",
    icon: Layers3,
    accent: "text-amber-600",
    pill: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/80",
    surface: "border-amber-200/80 bg-amber-50/55",
  },
  {
    key: "low",
    label: "Low priority",
    icon: CheckCheck,
    accent: "text-stone-600",
    pill: "bg-stone-100 text-stone-700 ring-1 ring-stone-200/80",
    surface: "border-stone-200/80 bg-stone-50/70",
  },
] as const;

function MetricCard({
  label,
  value,
  detail,
  loading,
  icon: Icon,
  iconClassName,
}: {
  label: string;
  value: ReactNode;
  detail: string;
  loading: boolean;
  icon: LucideIcon;
  iconClassName: string;
}) {
  return (
    <div className="rounded-[26px] border border-[#e6e0d6] bg-white/90 p-5 shadow-[0_20px_60px_-40px_rgba(32,28,20,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8f887c]">
            {label}
          </p>
          <div className="mt-4">
            {loading ? (
              <Skeleton className="h-10 w-24 rounded-xl" />
            ) : (
              <p className="text-[2rem] font-semibold tracking-[-0.04em] text-[#1f1b17]">
                {value}
              </p>
            )}
          </div>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconClassName}`}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#746d62]">{detail}</p>
    </div>
  );
}

function SectionCard({
  title,
  eyebrow,
  children,
  aside,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-[#e6e0d6] bg-white/88 p-6 shadow-[0_24px_80px_-48px_rgba(28,24,17,0.34)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#938a7d]">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] text-[#1f1b17]">
            {title}
          </h2>
        </div>
        {aside}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function SegBar({ segments }: { segments: { pct: number; color: string }[] }) {
  return (
    <div className="flex h-3 w-full gap-2 overflow-hidden rounded-full bg-[#efe9df] p-[3px]">
      {segments.map((segment, index) =>
        segment.pct > 0 ? (
          <div
            key={index}
            className={`h-full rounded-full transition-all duration-700 ${segment.color}`}
            style={{ width: `${segment.pct}%` }}
          />
        ) : null,
      )}
    </div>
  );
}

export default function Dashboard() {
  const { activeWorkspace, activeProject } = useApp();
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const workspaceId = activeWorkspace?.id;
    const projectId = activeProject?.id;

    const fetchData = async () => {
      if (!workspaceId || !projectId) {
        setData(null);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        const result = await getAnalytics(workspaceId, projectId);
        setData(result.data);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    void fetchData();

    if (!workspaceId || !projectId) {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchData();
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [activeProject?.id, activeWorkspace?.id]);

  const health =
    data != null
      ? (HEALTH[data.backlog_health as keyof typeof HEALTH] ?? HEALTH.good)
      : HEALTH.good;

  const totalActive = data?.total_active ?? 0;
  const total = Math.max(totalActive, 1);

  const todoCount = data?.by_status?.todo ?? 0;
  const inProgressCount = data?.by_status?.["in-progress"] ?? 0;
  const doneCount = data?.by_status?.done ?? 0;

  const todoPct = Math.round((todoCount / total) * 100);
  const inProgressPct = Math.round((inProgressCount / total) * 100);
  const donePct = Math.round((doneCount / total) * 100);

  const highCount = data?.by_priority?.high ?? 0;
  const mediumCount = data?.by_priority?.medium ?? 0;
  const lowCount = data?.by_priority?.low ?? 0;

  const staleCount = data?.stale_count ?? 0;
  const staleShare = totalActive > 0 ? Math.round((staleCount / totalActive) * 100) : 0;
  const highShare = totalActive > 0 ? Math.round((highCount / totalActive) * 100) : 0;
  const completionRate =
    data?.completion_rate != null ? Math.round(data.completion_rate) : null;

  const dominantLane =
    totalActive === 0
      ? "No active work"
      : [
          { label: "Todo", count: todoCount },
          { label: "In progress", count: inProgressCount },
          { label: "Done", count: doneCount },
        ].sort((left, right) => right.count - left.count)[0].label;

  const projectColor = activeProject?.color ?? "#1f1b17";
  const description =
    activeProject?.description?.trim() ||
    "A focused view of execution, risk, and delivery rhythm across the current project.";

  const actionItems = [
    staleCount > 0
      ? {
          title: `${staleCount} stale task${staleCount === 1 ? "" : "s"} need attention`,
          body:
            staleShare >= 30
              ? "A sizable share of the board has gone quiet. Review blockers or re-prioritize."
              : "There are a few tasks without recent movement. A quick check-in should keep momentum up.",
          icon: TimerReset,
          tone: "text-amber-700 bg-amber-50",
        }
      : {
          title: "Fresh board activity",
          body: "No task has gone stale, which usually means ownership and updates are staying tight.",
          icon: CheckCheck,
          tone: "text-emerald-700 bg-emerald-50",
        },
    highCount > 0
      ? {
          title: `${highCount} high-priority item${highCount === 1 ? "" : "s"} in play`,
          body:
            highShare >= 40
              ? "A large part of the board is urgent. Protect focus and avoid overloading the team."
              : "Critical work is present but still contained. Make sure it stays visible in standups.",
          icon: AlertTriangle,
          tone: "text-rose-700 bg-rose-50",
        }
      : {
          title: "Priority pressure is low",
          body: "There are no high-priority tasks right now, which gives the team room to clear carry-over.",
          icon: Layers3,
          tone: "text-stone-700 bg-stone-100",
        },
    {
      title:
        completionRate == null
          ? "Waiting for delivery signal"
          : completionRate >= 70
            ? "Delivery pace looks strong"
            : completionRate >= 40
              ? "Progress is healthy, but watch carry-over"
              : "Completion rate needs a push",
      body:
        completionRate == null
          ? "Once more work closes out, this panel will start to reflect delivery quality."
          : completionRate >= 70
            ? "The team is closing work at a good clip over the last 7 days."
            : completionRate >= 40
              ? "Throughput is decent, but some work may be lingering between stages."
              : "A low completion rate often means too much work is being started without finishing.",
      icon: Activity,
      tone: "text-sky-700 bg-sky-50",
    },
  ];

  if (!activeWorkspace || !activeProject) {
    return (
      <div className="min-h-screen bg-[#f6f1e8] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <section className="rounded-[32px] border border-[#e6e0d6] bg-white/90 p-8 shadow-[0_30px_90px_-55px_rgba(30,26,20,0.35)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#938a7d]">
              Dashboard
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#1f1b17]">
              Pick a workspace and project to see the dashboard.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#746d62]">
              Stract will surface delivery flow, workload pressure, and risk signals once a
              project is active.
            </p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f1e8] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        {error && (
          <Alert variant="destructive" className="rounded-2xl border-red-200 bg-white">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.95fr)]">
          <section className="relative overflow-hidden rounded-[34px] border border-[#e6e0d6] bg-[linear-gradient(135deg,#f8f4ec_0%,#ffffff_58%,#fcfbf8_100%)] p-6 shadow-[0_30px_100px_-55px_rgba(35,29,22,0.42)] sm:p-8">
            <div
              className="absolute -right-20 -top-16 h-56 w-56 rounded-full blur-3xl opacity-20"
              style={{ backgroundColor: projectColor }}
            />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.78)_100%)]" />

            <div className="relative z-10 flex flex-col gap-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8d8579]">
                    <span>{activeWorkspace.name}</span>
                    <span className="h-1 w-1 rounded-full bg-[#b7aea1]" />
                    <span>Delivery cockpit</span>
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full ring-4 ring-white/70"
                      style={{ backgroundColor: projectColor }}
                    />
                    <h1 className="text-[2.2rem] font-semibold tracking-[-0.055em] text-[#1f1b17] sm:text-[3.15rem]">
                      {activeProject.name}
                    </h1>
                  </div>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-[#6f6659] sm:text-[15px]">
                    {description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${health.chip}`}
                  >
                    {health.label}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[#e3ddd2] bg-white/70 px-3 py-1.5 text-xs font-medium text-[#746d62]">
                    Refreshes every 60s
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {loading ? (
                  <>
                    <Skeleton className="h-28 rounded-[24px]" />
                    <Skeleton className="h-28 rounded-[24px]" />
                    <Skeleton className="h-28 rounded-[24px]" />
                  </>
                ) : (
                  <>
                    <div className="rounded-[24px] border border-white/70 bg-white/78 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#938a7d]">
                        Active work
                      </p>
                      <p className="mt-3 text-[2rem] font-semibold tracking-[-0.05em] text-[#1f1b17]">
                        {totalActive}
                      </p>
                      <p className="mt-2 text-sm text-[#746d62]">
                        Live tasks currently moving across the board.
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/70 bg-white/78 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#938a7d]">
                        Last 7 days
                      </p>
                      <p className="mt-3 text-[2rem] font-semibold tracking-[-0.05em] text-[#1f1b17]">
                        {data?.velocity_7d ?? 0}
                      </p>
                      <p className="mt-2 text-sm text-[#746d62]">
                        Completed tasks contributing to recent delivery pace.
                      </p>
                    </div>
                    <div className={`rounded-[24px] border border-white/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${health.surface}`}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#938a7d]">
                        Health note
                      </p>
                      <p className={`mt-3 text-lg font-semibold tracking-[-0.03em] ${health.tone}`}>
                        {health.label}
                      </p>
                      <p className="mt-2 text-sm text-[#746d62]">{health.hint}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[34px] border border-[#e6e0d6] bg-[#fcfbf8] p-6 shadow-[0_28px_80px_-52px_rgba(33,29,22,0.38)] sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#938a7d]">
                  Project pulse
                </p>
                <h2 className="mt-2 text-[1.35rem] font-semibold tracking-[-0.035em] text-[#1f1b17]">
                  Execution signal
                </h2>
              </div>
              <span className="rounded-full border border-[#e6e0d6] bg-white px-3 py-1 text-xs font-medium text-[#746d62]">
                {dominantLane}
              </span>
            </div>

            {loading ? (
              <div className="mt-8 space-y-4">
                <Skeleton className="mx-auto h-36 w-36 rounded-full" />
                <Skeleton className="h-12 rounded-2xl" />
                <Skeleton className="h-12 rounded-2xl" />
                <Skeleton className="h-12 rounded-2xl" />
              </div>
            ) : (
              <div className="mt-8">
                <div className="flex justify-center">
                  <div className="relative flex h-40 w-40 items-center justify-center rounded-full border border-[#e5dfd4] bg-[radial-gradient(circle_at_top,#ffffff_0%,#f5f0e6_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                    <div className="absolute inset-3 rounded-full border border-[#e6dfd2]" />
                    <div className="absolute inset-[30px] rounded-full border border-white shadow-[inset_0_1px_12px_rgba(31,27,23,0.06)]" />
                    <div className="relative text-center">
                      <p className="text-[2.4rem] font-semibold tracking-[-0.06em] text-[#1f1b17]">
                        {completionRate != null ? `${completionRate}%` : "--"}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8f887c]">
                        Completion rate
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  {[
                    { label: "Backlog health", value: health.label },
                    { label: "Dominant stage", value: dominantLane },
                    { label: "Stale pressure", value: `${staleCount} task${staleCount === 1 ? "" : "s"}` },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-[20px] border border-[#e8e2d8] bg-white px-4 py-3.5"
                    >
                      <span className="text-sm text-[#746d62]">{item.label}</span>
                      <span className="text-sm font-semibold text-[#1f1b17]">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Active tasks"
            value={totalActive}
            detail="Everything currently open across the project."
            loading={loading}
            icon={Layers3}
            iconClassName="bg-stone-100 text-stone-700"
          />
          <MetricCard
            label="Completed"
            value={data?.velocity_7d ?? 0}
            detail="Tasks closed in the last 7 days."
            loading={loading}
            icon={CheckCheck}
            iconClassName="bg-emerald-50 text-emerald-700"
          />
          <MetricCard
            label="High priority share"
            value={totalActive > 0 ? `${highShare}%` : "--"}
            detail="How much of the board is urgent right now."
            loading={loading}
            icon={ArrowUpRight}
            iconClassName="bg-rose-50 text-rose-700"
          />
          <MetricCard
            label="Stale tasks"
            value={staleCount}
            detail="Items without progress updates for 3 or more days."
            loading={loading}
            icon={TimerReset}
            iconClassName="bg-amber-50 text-amber-700"
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.95fr)_minmax(0,0.95fr)]">
          <SectionCard
            eyebrow="Workflow balance"
            title="How work is distributed"
            aside={
              !loading ? (
                <span className="rounded-full border border-[#e6e0d6] bg-[#f8f4ec] px-3 py-1 text-xs font-medium text-[#746d62]">
                  {totalActive} active
                </span>
              ) : null
            }
          >
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-20 rounded-[22px]" />
                <Skeleton className="h-20 rounded-[22px]" />
                <Skeleton className="h-20 rounded-[22px]" />
              </div>
            ) : (
              <div className="space-y-5">
                <SegBar
                  segments={[
                    { pct: todoPct, color: "bg-stone-400" },
                    { pct: inProgressPct, color: "bg-sky-500" },
                    { pct: donePct, color: "bg-emerald-500" },
                  ]}
                />

                <div className="space-y-3">
                  {STATUS_META.map((status) => {
                    const count =
                      status.key === "todo"
                        ? todoCount
                        : status.key === "in-progress"
                          ? inProgressCount
                          : doneCount;
                    const pct = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0;

                    return (
                      <div
                        key={status.key}
                        className="rounded-[24px] border border-[#ece5da] bg-[#fcfbf8] p-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className={`h-2.5 w-2.5 rounded-full ${status.color}`} />
                            <div>
                              <p className="text-sm font-semibold text-[#1f1b17]">
                                {status.label}
                              </p>
                              <p className="text-xs text-[#8b8378]">{pct}% of active workload</p>
                            </div>
                          </div>
                          <p className={`text-lg font-semibold tracking-[-0.04em] ${status.text}`}>
                            {count}
                          </p>
                        </div>
                        <div className={`mt-4 h-2 rounded-full ${status.track}`}>
                          <div
                            className={`h-full rounded-full ${status.color}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard eyebrow="Priority pressure" title="What needs focus first">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 rounded-[22px]" />
                <Skeleton className="h-24 rounded-[22px]" />
                <Skeleton className="h-24 rounded-[22px]" />
              </div>
            ) : (
              <div className="space-y-3">
                {PRIORITY_META.map(({ key, label, icon: Icon, accent, pill, surface }) => {
                  const count =
                    key === "high" ? highCount : key === "medium" ? mediumCount : lowCount;
                  const share = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0;

                  return (
                    <div
                      key={key}
                      className={`rounded-[24px] border p-4 ${surface}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-white ${accent}`}>
                            <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#1f1b17]">{label}</p>
                            <p className="text-xs text-[#8b8378]">
                              {share}% of current active tasks
                            </p>
                          </div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pill}`}>
                          {count}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard eyebrow="Action cues" title="What to do next">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 rounded-[22px]" />
                <Skeleton className="h-24 rounded-[22px]" />
                <Skeleton className="h-24 rounded-[22px]" />
              </div>
            ) : (
              <div className="space-y-3">
                {actionItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="rounded-[24px] border border-[#ece5da] bg-[#fcfbf8] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.tone}`}
                        >
                          <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#1f1b17]">{item.title}</p>
                          <p className="mt-1 text-sm leading-6 text-[#746d62]">
                            {item.body}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
