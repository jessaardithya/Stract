'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  Zap,
  AlertTriangle,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import { getAnalytics } from '@/lib/api';
import { useApp } from '@/context/AppContext';

const HEALTH_CONFIG = {
  good:     { label: 'Good',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  warning:  { label: 'Warning',  color: 'bg-amber-100 text-amber-700 border-amber-200'     },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200'           },
};

export default function Dashboard() {
  const { activeWorkspace, activeProject } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    if (!activeWorkspace?.id || !activeProject?.id) return;
    try {
      const result = await getAnalytics(activeWorkspace.id, activeProject.id);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [activeWorkspace?.id, activeProject?.id]);

  const health = data ? (HEALTH_CONFIG[data.backlog_health] ?? HEALTH_CONFIG.good) : null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-7">
      {/* Heading */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-0.5">
          {activeProject && (
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: activeProject.color }} />
          )}
          <h1 className="text-2xl font-semibold text-[#1a1a1a] tracking-tight">
            {activeProject ? `${activeProject.name} — Overview` : 'Dashboard'}
          </h1>
        </div>
        <p className="text-sm text-[#8a8a85] mt-0.5">Live project analytics · refreshes every 60s</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Active Tasks */}
        <Card className="border-[#e4e4e0] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-violet-600" />
              </div>
              {health && (
                <Badge className={`text-[10px] font-semibold border ${health.color}`}>
                  {health.label}
                </Badge>
              )}
            </div>
            {loading ? (
              <Skeleton className="h-9 w-16 mb-1" />
            ) : (
              <p className="text-3xl font-bold text-[#1a1a1a]">{data?.total_active ?? 0}</p>
            )}
            <p className="text-xs text-[#8a8a85] mt-1">Active Tasks</p>
          </CardContent>
        </Card>

        {/* Velocity */}
        <Card className="border-[#e4e4e0] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
              <Zap size={16} className="text-blue-600" />
            </div>
            {loading ? (
              <Skeleton className="h-9 w-16 mb-1" />
            ) : (
              <p className="text-3xl font-bold text-[#1a1a1a]">{data?.velocity_7d ?? 0}</p>
            )}
            <p className="text-xs text-[#8a8a85] mt-1">Completed last 7 days</p>
          </CardContent>
        </Card>

        {/* Stale */}
        <Card className="border-[#e4e4e0] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mb-3">
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
            {loading ? (
              <Skeleton className="h-9 w-16 mb-1" />
            ) : (
              <p className={`text-3xl font-bold ${(data?.stale_count ?? 0) > 3 ? 'text-red-500' : (data?.stale_count ?? 0) > 0 ? 'text-amber-500' : 'text-[#1a1a1a]'}`}>
                {data?.stale_count ?? 0}
              </p>
            )}
            <p className="text-xs text-[#8a8a85] mt-1">Stale tasks (&gt;3 days)</p>
          </CardContent>
        </Card>

        {/* Completion Rate */}
        <Card className="border-[#e4e4e0] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mb-3">
              <ArrowRight size={16} className="text-emerald-600" />
            </div>
            {loading ? (
              <Skeleton className="h-9 w-16 mb-1" />
            ) : (
              <p className="text-3xl font-bold text-[#1a1a1a]">
                {data?.completion_rate != null ? `${Math.round(data.completion_rate)}%` : '—'}
              </p>
            )}
            <p className="text-xs text-[#8a8a85] mt-1">Completion rate</p>
          </CardContent>
        </Card>

        {/* Priority Breakdown */}
        <Card className="border-[#e4e4e0] bg-white shadow-sm sm:col-span-2 lg:col-span-1">
          <CardContent className="p-5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center mb-3">
              <BarChart3 size={16} className="text-rose-600" />
            </div>
            {loading ? (
              <Skeleton className="h-9 w-32 mb-1" />
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">{data?.by_priority?.high ?? 0}</p>
                  <p className="text-[10px] text-[#8a8a85]">High</p>
                </div>
                <div className="text-[#e4e4e0]">·</div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-500">{data?.by_priority?.medium ?? 0}</p>
                  <p className="text-[10px] text-[#8a8a85]">Med</p>
                </div>
                <div className="text-[#e4e4e0]">·</div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-400">{data?.by_priority?.low ?? 0}</p>
                  <p className="text-[10px] text-[#8a8a85]">Low</p>
                </div>
              </div>
            )}
            <p className="text-xs text-[#8a8a85] mt-2">Priority breakdown</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution Bar */}
      {!loading && data && (
        <Card className="border-[#e4e4e0] bg-white shadow-sm">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Status Distribution</h3>
            <div className="flex gap-1 h-3 rounded-full overflow-hidden">
              {(() => {
                const total = Math.max(data.total_active, 1);
                const todo = Math.round((data.by_status?.todo ?? 0) / total * 100);
                const prog = Math.round((data.by_status?.['in-progress'] ?? 0) / total * 100);
                const done = Math.round((data.by_status?.done ?? 0) / total * 100);
                return (
                  <>
                    {todo > 0   && <div style={{ width: `${todo}%` }}   className="bg-gray-300 transition-all" />}
                    {prog > 0   && <div style={{ width: `${prog}%` }}   className="bg-blue-400 transition-all" />}
                    {done > 0   && <div style={{ width: `${done}%` }}   className="bg-emerald-400 transition-all" />}
                  </>
                );
              })()}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-[11px] text-[#8a8a85]"><span className="w-2 h-2 rounded-full bg-gray-300" /> Todo {data.by_status?.todo ?? 0}</span>
              <span className="flex items-center gap-1.5 text-[11px] text-[#8a8a85]"><span className="w-2 h-2 rounded-full bg-blue-400" /> In Progress {data.by_status?.['in-progress'] ?? 0}</span>
              <span className="flex items-center gap-1.5 text-[11px] text-[#8a8a85]"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Done {data.by_status?.done ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
