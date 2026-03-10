'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Flame, TrendingUp, CheckCircle2, Activity } from 'lucide-react';
import { fetchAnalytics } from '@/lib/api';

const POLL_INTERVAL = 60_000; // 60 seconds

const STATUS_COLORS = {
  todo: { bar: 'bg-[#9ca3af]', label: 'Todo', text: 'text-[#9ca3af]' },
  'in-progress': { bar: 'bg-[#3b82f6]', label: 'In Progress', text: 'text-[#3b82f6]' },
  done: { bar: 'bg-[#10b981]', label: 'Done', text: 'text-[#10b981]' },
};

const HEALTH_CONFIG = {
  good: { label: 'Good health', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  warning: { label: 'Warning', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
};

function StaleIcon({ count }) {
  if (count === 0) return <span className="text-sm font-semibold text-emerald-600">{count}</span>;
  const color = count <= 3 ? 'text-amber-500' : 'text-red-500';
  return (
    <span className={`flex items-center gap-1 text-sm font-semibold ${color}`}>
      <AlertTriangle size={14} />
      {count}
    </span>
  );
}

function KPICard({ title, value, sub, loading }) {
  return (
    <Card className="bg-white border border-[#e4e4e0] shadow-sm flex-1">
      <CardContent className="p-5">
        {loading ? (
          <>
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </>
        ) : (
          <>
            <p className="text-xs font-medium text-[#8a8a85] uppercase tracking-wide mb-2">{title}</p>
            <div className="text-3xl font-semibold text-[#1a1a1a] mb-1">{value}</div>
            <div className="text-xs text-[#8a8a85]">{sub}</div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchAnalytics();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [load]);

  // --- Status distribution bar ---
  const byStatus = data?.by_status ?? { todo: 0, 'in-progress': 0, done: 0 };
  const total = Object.values(byStatus).reduce((s, v) => s + v, 0);
  const pct = (key) => (total === 0 ? 0 : Math.round((byStatus[key] / total) * 100));

  const health = data?.backlog_health ?? 'good';
  const HealthCfg = HEALTH_CONFIG[health] ?? HEALTH_CONFIG.good;
  const HealthIcon = HealthCfg.icon;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#1a1a1a] tracking-tight">Dashboard</h1>
        <p className="text-sm text-[#8a8a85] mt-0.5">Live project insights — refreshes every 60s</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* KPI Row */}
      <div className="flex gap-4 mb-6">
        <KPICard
          loading={loading}
          title="Active Tasks"
          value={data?.total_active ?? '—'}
          sub={
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${HealthCfg.color}`}>
              <HealthIcon size={11} />
              {HealthCfg.label}
            </span>
          }
        />
        <KPICard
          loading={loading}
          title="Velocity (7d)"
          value={
            <span className="flex items-center gap-1.5">
              {data?.velocity_7d ?? '—'}
              <TrendingUp size={20} className="text-emerald-500" />
            </span>
          }
          sub="tasks completed this week"
        />
        <KPICard
          loading={loading}
          title="Stale Tasks"
          value={<StaleIcon count={data?.stale_count ?? 0} />}
          sub={loading ? '' : data?.stale_count === 0 ? 'All tasks are active' : 'untouched for 3+ days'}
        />
      </div>

      {/* Status Distribution Bar */}
      <Card className="bg-white border border-[#e4e4e0] shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-[#8a8a85] uppercase tracking-wide">Status Distribution</p>
            <Activity size={14} className="text-[#8a8a85]" />
          </div>

          {loading ? (
            <Skeleton className="h-4 w-full rounded-full mb-3" />
          ) : (
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-3">
              {['todo', 'in-progress', 'done'].map((key) => (
                <div
                  key={key}
                  className={`${STATUS_COLORS[key].bar} transition-all duration-500`}
                  style={{ width: `${pct(key)}%`, minWidth: byStatus[key] > 0 ? '2%' : '0' }}
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 flex-wrap">
            {['todo', 'in-progress', 'done'].map((key) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[key].bar}`} />
                <span className="text-xs text-[#8a8a85]">
                  {STATUS_COLORS[key].label}{' '}
                  <span className="font-medium text-[#1a1a1a]">{pct(key)}%</span>
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
