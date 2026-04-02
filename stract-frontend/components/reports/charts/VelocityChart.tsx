import { BarChart, LineChart, AreaChart } from '@tremor/react';
import type { VelocityData } from '@/types';
import { ChartWidget, ChartType } from '../ChartWidget';

interface Props {
  data: VelocityData[];
}

export function VelocityChart({ data }: Props) {
  return (
    <ChartWidget
      title="Velocity"
      description="Tasks completed per week over the last 8 weeks"
      supportedTypes={['bar', 'line', 'area']}
    >
      {(type: ChartType) => {
        const props = {
          data,
          index: 'week',
          categories: ['completed'],
          colors: ['violet-600'],
          showLegend: false,
          className: 'h-full w-full min-h-[220px]',
        };

        if (type === 'line') return <LineChart {...props} />;
        if (type === 'area') return <AreaChart {...props} />;
        return <BarChart {...props} />;
      }}
    </ChartWidget>
  );
}
