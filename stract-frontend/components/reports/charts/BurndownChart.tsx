import { LineChart, AreaChart } from '@tremor/react';
import type { BurndownData } from '@/types';
import { ChartWidget, ChartType } from '../ChartWidget';

interface Props {
  data: BurndownData[];
}

export function BurndownChart({ data }: Props) {
  return (
    <ChartWidget
      title="Burndown"
      description="Remaining tasks vs ideal path"
      supportedTypes={['line', 'area']}
    >
      {(type: ChartType) => {
        const props = {
          data,
          index: 'date',
          categories: ['remaining', 'ideal'],
          colors: ['violet-600', 'slate-300'],
          showLegend: true,
          className: 'h-full w-full min-h-[220px]',
        };

        if (type === 'area') return <AreaChart {...props} />;
        return <LineChart {...props} />;
      }}
    </ChartWidget>
  );
}
