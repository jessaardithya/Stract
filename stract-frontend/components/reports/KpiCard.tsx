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
  hint?: string;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  suffix,
  trend,
  alert,
  badge,
  hint,
}: KpiCardProps) {
  const badgeColors = {
    good: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    critical: 'border-red-200 bg-red-50 text-red-700',
  };

  const iconColor = alert ? 'text-red-500' : 'text-violet-600';

  return (
    <div
      className={`flex h-full flex-col justify-between border px-5 py-5 transition-colors ${
        alert ? 'border-red-200 bg-red-50/60' : 'border-[#e4e4e0] bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a8a85]">{label}</p>
          {hint && <p className="mt-2 max-w-[18rem] text-sm leading-6 text-[#706b64]">{hint}</p>}
        </div>
        <span className="flex h-10 w-10 items-center justify-center border border-black/[0.06] bg-[#f7f4ee]">
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </span>
      </div>

      <div className="mt-8 flex items-end justify-between gap-4">
        <div className="flex items-end gap-2">
          <span className={`text-[34px] font-semibold leading-none tracking-[-0.03em] ${alert ? 'text-red-900' : 'text-gray-950'}`}>
            {value}
          </span>
          {suffix && <span className="pb-1 text-sm font-medium text-[#8a8a85]">{suffix}</span>}
        </div>

        {(trend || badge) && (
          <div className="flex items-center gap-2">
            {trend === 'up' && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                <TrendingUp className="h-4 w-4" />
                Up
              </span>
            )}
            {trend === 'down' && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                <TrendingDown className="h-4 w-4" />
                Down
              </span>
            )}
            {badge && (
              <span className={`inline-flex items-center gap-2 border px-2.5 py-1 text-[11px] font-semibold capitalize ${badgeColors[badge]}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {badge}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
