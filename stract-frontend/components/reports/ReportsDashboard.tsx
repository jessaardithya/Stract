"use client";

import React from 'react';
import {
  RefreshCw,
  ListTodo,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  TimerReset,
  Activity,
  Sparkles,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useApp } from '@/context/AppContext';
import { useReportsData } from './useReportsData';
import { KpiCard } from './KpiCard';
import { VelocityChart } from './charts/VelocityChart';
import { CompletionRateChart } from './charts/CompletionRateChart';
import { BurndownChart } from './charts/BurndownChart';
import { StaleTasksChart } from './charts/StaleTasksChart';
import { StatusDistributionChart } from './charts/StatusDistributionChart';
import { PriorityChart } from './charts/PriorityChart';
import { AssigneeWorkloadChart } from './charts/AssigneeWorkloadChart';
import { ProjectsSummaryTable } from './ProjectsSummaryTable';

function ReportsSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="min-h-[210px] border border-[#e4e4e0] bg-white" />
        <div className="min-h-[210px] border border-[#e4e4e0] bg-[#f5f2ea]" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((k) => (
          <div key={k} className="h-[132px] border border-[#e4e4e0] bg-white" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {[1, 2, 3, 4].map((k) => (
          <div key={k} className="h-[340px] border border-[#e4e4e0] bg-white" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {[1, 2, 3].map((k) => (
          <div key={k} className="h-[320px] border border-[#e4e4e0] bg-white" />
        ))}
      </div>
    </div>
  );
}

function ReportsError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="mt-8 border border-red-200 bg-red-50 px-8 py-16 text-center">
      <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-red-500" />
      <h3 className="text-xl font-semibold text-red-900">Failed to load reports</h3>
      <p className="mt-2 text-sm text-red-700">{error.message}</p>
      <button
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-2 border border-red-300 bg-white px-5 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}

function SectionHeading({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-[#e4e4e0] pb-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8a8a85]">
          {label}
        </p>
        <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-gray-950">{title}</h2>
      </div>
      <p className="max-w-xl text-sm text-[#706b64]">{description}</p>
    </div>
  );
}

function HealthBadge({ value }: { value: 'good' | 'warning' | 'critical' }) {
  const styles = {
    good: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    critical: 'border-red-200 bg-red-50 text-red-700',
  };

  return (
    <span className={`inline-flex items-center gap-2 border px-3 py-1 text-xs font-semibold capitalize ${styles[value]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {value}
    </span>
  );
}

export default function ReportsDashboard() {
  const { activeWorkspace } = useApp();
  const { data, loading, error, lastUpdated, refetch } = useReportsData();

  const workspaceName = activeWorkspace?.name || 'Workspace';

  return (
    <div className="mx-auto w-full max-w-[1480px] px-5 py-6 md:px-8 md:py-8">
      <div className="space-y-8 pb-12">
        <section className="grid gap-6 border-b border-[#e4e4e0] pb-8 xl:grid-cols-[1.45fr_0.85fr]">
          <div className="bg-white px-6 py-6 md:px-8 md:py-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-600">
              Workspace reports
            </p>
            <h1 className="mt-4 max-w-3xl text-[34px] font-semibold tracking-[-0.03em] text-gray-950 md:text-[46px]">
              {workspaceName} performance, delivery pace, and workload distribution.
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#706b64]">
              A live reporting surface across every project in this workspace, designed to show delivery momentum,
              completion pressure, and where attention is drifting.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
              <button
                onClick={refetch}
                disabled={loading}
                className="inline-flex items-center gap-2 border border-[#d8d2c8] bg-[#f7f4ee] px-4 py-2.5 font-medium text-gray-800 transition-colors hover:bg-[#f0ece3] disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-violet-600' : 'text-violet-600'}`} />
                Refresh data
              </button>
              <span className="inline-flex items-center gap-2 text-[#8a8a85]">
                <TimerReset className="h-4 w-4" />
                Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
              </span>
            </div>
          </div>

          <div className="border border-[#e4e4e0] bg-[#f6f2ea] px-6 py-6 md:px-7">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8a8a85]">
                Snapshot
              </p>
              {data && <HealthBadge value={data.kpis.backlog_health} />}
            </div>

            {data ? (
              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-2 gap-5 border-b border-[#e4e4e0] pb-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#8a8a85]">Completion rate</p>
                    <p className="mt-2 text-4xl font-semibold tracking-tight text-gray-950">
                      {data.kpis.completion_rate.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#8a8a85]">Stale tasks</p>
                    <p className="mt-2 text-4xl font-semibold tracking-tight text-gray-950">
                      {data.kpis.stale_count}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 text-sm text-[#5d5a54]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="mt-0.5 h-4 w-4 text-violet-600" />
                      <span>Delivery pace</span>
                    </div>
                    <span className="font-medium text-gray-900">{data.kpis.velocity_7d} tasks in 7 days</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Activity className="mt-0.5 h-4 w-4 text-violet-600" />
                      <span>Open work</span>
                    </div>
                    <span className="font-medium text-gray-900">{data.kpis.total_active} active tasks</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-violet-600" />
                      <span>Health note</span>
                    </div>
                    <span className="max-w-[180px] text-right font-medium text-gray-900">
                      {data.kpis.backlog_health === 'good'
                        ? 'Backlog is balanced and moving.'
                        : data.kpis.backlog_health === 'warning'
                          ? 'Open work is building faster than it closes.'
                          : 'Completion pressure is high and needs attention.'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-8 text-sm text-[#8a8a85]">Waiting for workspace data.</div>
            )}
          </div>
        </section>

        {error ? (
          <ReportsError error={error} onRetry={refetch} />
        ) : loading && !data ? (
          <ReportsSkeleton />
        ) : data ? (
          <>
            <section className="space-y-4">
              <SectionHeading
                label="Selected KPIs"
                title="The metrics that matter right now"
                description="A compact read on throughput, completed work, momentum, and backlog quality for the current workspace."
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="Active tasks"
                  value={data.kpis.total_active}
                  icon={ListTodo}
                  hint="Currently open across the workspace"
                />
                <KpiCard
                  label="Completed today"
                  value={data.kpis.completed_today}
                  icon={CheckCircle2}
                  hint="Closed in the last 24 hours"
                />
                <KpiCard
                  label="Velocity (7d)"
                  value={data.kpis.velocity_7d}
                  icon={TrendingUp}
                  trend={data.kpis.velocity_7d > data.kpis.velocity_30d / 4 ? 'up' : 'down'}
                  hint="Compared against the 30-day baseline"
                />
                <KpiCard
                  label="Backlog health"
                  value={data.kpis.completion_rate.toFixed(1)}
                  suffix="%"
                  icon={AlertTriangle}
                  badge={data.kpis.backlog_health}
                  hint="Completion rate across current workload"
                />
              </div>
            </section>

            <section className="space-y-5">
              <SectionHeading
                label="Momentum"
                title="How work is moving over time"
                description="Track output, completion consistency, backlog burn, and stale buildup without leaving the workspace view."
              />
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <VelocityChart data={data.velocity_over_time} />
                <CompletionRateChart data={data.completion_rate_over_time} />
                <BurndownChart data={data.burndown} />
                <StaleTasksChart data={data.stale_trend} />
              </div>
            </section>

            <section className="space-y-5">
              <SectionHeading
                label="Distribution"
                title="Where work is sitting"
                description="Break down status mix, urgency profile, and assignee concentration to spot imbalance before it slows delivery."
              />
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <StatusDistributionChart data={data.status_distribution} />
                <PriorityChart data={data.priority_breakdown} />
                <AssigneeWorkloadChart data={data.assignee_workload} />
              </div>
            </section>

            <section className="space-y-5">
              <SectionHeading
                label="Projects"
                title="Completion by project"
                description="Compare project volume and closure rate in one place so it is easier to see which streams are finishing cleanly."
              />
              <ProjectsSummaryTable projects={data.projects_summary} />
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
