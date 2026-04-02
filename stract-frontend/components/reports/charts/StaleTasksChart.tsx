import { BarChart, LineChart } from '@tremor/react';
import type { StaleTrendData } from '@/types';
import { ChartWidget, ChartType } from '../ChartWidget';

interface Props {
  data: StaleTrendData[];
}

export function StaleTasksChart({ data }: Props) {
  return (
    <ChartWidget
      title="Stale Tasks"
      description="Inactive for 3+ days over time"
      supportedTypes={['bar', 'line']}
    >
      {(type: ChartType) => {
        const props = {
          data,
          index: 'week',
          categories: ['stale'],
          colors: ['amber-500'],
          showLegend: false,
          className: 'h-full w-full min-h-[220px]',
        };

        if (type === 'line') return <LineChart {...props} />;
        return <BarChart {...props} />;
      }}
    </ChartWidget>
  );
}
