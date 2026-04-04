"use client";

import React, { useState } from 'react';

export type ChartType = 'bar' | 'line' | 'area' | 'donut';

interface ChartWidgetProps {
  title: string;
  description?: string;
  supportedTypes: ChartType[];
  children: (activeType: ChartType) => React.ReactNode;
}

const typeLabels: Record<ChartType, string> = {
  bar: 'Bar',
  line: 'Line',
  area: 'Area',
  donut: 'Donut',
};

export function ChartWidget({ title, description, supportedTypes, children }: ChartWidgetProps) {
  const [activeType, setActiveType] = useState<ChartType>(supportedTypes[0] || 'bar');

  return (
    <section className="flex h-full flex-col border border-[#e4e4e0] bg-white">
      <div className="flex flex-col gap-4 border-b border-[#e4e4e0] px-5 py-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a8a85]">Chart</p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-gray-950">{title}</h3>
          {description && <p className="mt-1 max-w-[28rem] text-sm leading-6 text-[#706b64]">{description}</p>}
        </div>
        {supportedTypes.length > 1 && (
          <div className="flex items-center gap-1 self-start border border-[#e4e4e0] bg-[#fafaf8] p-1">
            {supportedTypes.map((type) => (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                  activeType === type
                    ? 'bg-white text-violet-700'
                    : 'text-[#8a8a85] hover:text-gray-700'
                }`}
                title={`Switch to ${typeLabels[type]} chart`}
              >
                {typeLabels[type]}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 px-4 py-5 md:px-5">
        <div className="min-h-[240px] w-full">{children(activeType)}</div>
      </div>
    </section>
  );
}
