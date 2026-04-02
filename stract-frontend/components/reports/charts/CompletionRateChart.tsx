import { LineChart, AreaChart } from '@tremor/react';
import type { CompletionRateData } from '@/types';
import { ChartWidget, ChartType } from '../ChartWidget';

interface Props {
  data: CompletionRateData[];
}

export function CompletionRateChart({ data }: Props) {
  return (
    <ChartWidget
      title="Completion Rate"
      description="Daily completion rate % over time"
      supportedTypes={['line', 'area']}
    >
      {(type: ChartType) => {
        const props = {
          data,
          index: 'date',
          categories: ['rate'],
          colors: ['emerald-500'],
          showLegend: false,
          valueFormatter: (number: number) => `${number.toFixed(1)}%`,
          className: 'h-full w-full min-h-[220px]',
        };

        if (type === 'area') return <AreaChart {...props} />;
        return <LineChart {...props} />;
      }}
    </ChartWidget>
  );
}
