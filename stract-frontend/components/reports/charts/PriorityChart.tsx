import { DonutChart, BarChart } from '@tremor/react';
import type { PriorityBreakdown } from '@/types';
import { ChartWidget, ChartType } from '../ChartWidget';

interface Props {
  data: PriorityBreakdown[];
}

export function PriorityChart({ data }: Props) {
  const getColors = () => {
    return data.map((d) => {
      if (d.priority === 'high') return 'red';
      if (d.priority === 'medium') return 'amber';
      return 'emerald';
    });
  };

  return (
    <ChartWidget
      title="Priorities"
      description="Active tasks by priority"
      supportedTypes={['bar', 'donut']}
    >
      {(type: ChartType) => {
        if (type === 'donut') {
          return (
            <DonutChart
              data={data}
              index="priority"
              category="count"
              colors={getColors()}
              className="h-full w-full min-h-[220px]"
            />
          );
        }
        return (
          <BarChart
            data={data}
            index="priority"
            categories={['count']}
            colors={getColors()}
            showLegend={false}
            className="h-full w-full min-h-[220px]"
          />
        );
      }}
    </ChartWidget>
  );
}
