"use client";

import React from 'react';
import { RefreshCw, ListTodo, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(k => <div key={k} className="h-[120px] bg-white border border-[#e4e4e0] rounded-xl"></div>)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(k => <div key={k} className="h-[320px] bg-white border border-[#e4e4e0] rounded-xl"></div>)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(k => <div key={k} className="h-[320px] bg-white border border-[#e4e4e0] rounded-xl"></div>)}
      </div>
    </div>
  );
}

function ReportsError({ error, onRetry }: { error: Error, onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 border border-red-200 bg-red-50 rounded-xl mt-8">
      <AlertTriangle className="w-10 h-10 text-red-500 mb-4" />
      <h3 className="text-xl font-medium text-red-900 mb-2">Failed to load reports</h3>
      <p className="text-red-700 mb-6">{error.message}</p>
      <button 
        onClick={onRetry} 
        className="px-5 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm"
      >
        Try again
      </button>
    </div>
  );
}

export default function ReportsDashboard() {
  const { activeWorkspace } = useApp();
  const { data, loading, error, lastUpdated, refetch } = useReportsData();

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <p className="text-sm font-medium text-violet-600 mb-1">
            {activeWorkspace?.name || 'Workspace'}
          </p>
          <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">Reports</h1>
          <p className="text-gray-500 mt-1">Across all projects in this workspace</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-xs font-medium text-gray-400">
            Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
          </span>
          <button
            onClick={refetch}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-[#e4e4e0] shadow-sm rounded-lg hover:bg-[#fafaf8] hover:border-violet-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-violet-600' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <ReportsError error={error} onRetry={refetch} />
      ) : loading && !data ? (
        <ReportsSkeleton />
      ) : data ? (
        <div className="space-y-6 pb-12">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard
              label="Active Tasks"
              value={data.kpis.total_active}
              icon={ListTodo}
            />
            <KpiCard
              label="Completed Today"
              value={data.kpis.completed_today}
              icon={CheckCircle2}
            />
            <KpiCard
              label="Velocity (7d)"
              value={data.kpis.velocity_7d}
              icon={TrendingUp}
              trend={data.kpis.velocity_7d > data.kpis.velocity_30d / 4 ? 'up' : 'down'}
            />
            <KpiCard
              label="Backlog Health"
              value={data.kpis.completion_rate.toFixed(1)}
              suffix="%"
              icon={AlertTriangle}
              badge={data.kpis.backlog_health}
            />
          </div>

          {/* Time Series 2-Col Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <VelocityChart data={data.velocity_over_time} />
            <CompletionRateChart data={data.completion_rate_over_time} />
            <BurndownChart data={data.burndown} />
            <StaleTasksChart data={data.stale_trend} />
          </div>

          {/* Distribution 3-Col Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <StatusDistributionChart data={data.status_distribution} />
            <PriorityChart data={data.priority_breakdown} />
            <AssigneeWorkloadChart data={data.assignee_workload} />
          </div>

          {/* Projects Table */}
          <ProjectsSummaryTable projects={data.projects_summary} />
        </div>
      ) : null}
    </div>
  );
}
