import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  suffix?: string;
  trend?: 'up' | 'down';
  alert?: boolean;
  badge?: 'good' | 'warning' | 'critical';
}

export function KpiCard({
  label, value, icon: Icon, suffix, trend, alert, badge
}: KpiCardProps) {
  const badgeColors = {
    good: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    critical: 'bg-red-100 text-red-800',
  };

  return (
    <div className={`bg-white rounded-xl border p-5 transition-colors ${alert ? 'border-red-300 bg-red-50' : 'border-[#e4e4e0] hover:border-violet-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400">{label}</h3>
        <Icon className={`w-5 h-5 ${alert ? 'text-red-500' : 'text-gray-400'}`} />
      </div>
      
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-semibold tracking-tight ${alert ? 'text-red-900' : 'text-gray-900'}`}>
          {value}
        </span>
        {suffix && <span className="text-sm font-medium text-gray-500">{suffix}</span>}
      </div>

      {(trend || badge) && (
        <div className="mt-4 flex items-center gap-2">
          {trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-500" />}
          {trend === 'down' && <TrendingDown className="w-4 h-4 text-rose-500" />}
          {badge && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeColors[badge]}`}>
              {badge.charAt(0).toUpperCase() + badge.slice(1)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
