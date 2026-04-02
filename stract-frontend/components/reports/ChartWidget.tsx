"use client";

import React, { useState } from 'react';

export type ChartType = 'bar' | 'line' | 'area' | 'donut';

interface ChartWidgetProps {
  title: string;
  description?: string;
  supportedTypes: ChartType[];
  children: (activeType: ChartType) => React.ReactNode;
}

const typeIcons: Record<ChartType, string> = {
  bar: '▊',
  line: '〜',
  area: '◿',
  donut: '◎',
};

export function ChartWidget({ title, description, supportedTypes, children }: ChartWidgetProps) {
  const [activeType, setActiveType] = useState<ChartType>(supportedTypes[0] || 'bar');

  return (
    <div className="bg-white rounded-xl border border-[#e4e4e0] p-5 transition-colors hover:border-violet-200 flex flex-col h-full">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h3 className="text-gray-900 font-medium">{title}</h3>
          {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        </div>
        {supportedTypes.length > 1 && (
          <div className="flex items-center gap-1 bg-[#fafaf8] border border-[#e4e4e0] p-1 rounded-lg shrink-0">
            {supportedTypes.map((type) => (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`px-2 py-1 text-xs rounded-md transition-all font-medium leading-none ${
                  activeType === type
                    ? 'bg-white shadow-sm text-violet-600 border border-[#e4e4e0]'
                    : 'text-gray-400 hover:text-gray-600 border border-transparent'
                }`}
                title={`Switch to ${type} chart`}
              >
                {typeIcons[type]}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 w-full min-h-[220px]">
        {children(activeType)}
      </div>
    </div>
  );
}
