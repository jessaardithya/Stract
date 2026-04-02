import { DonutChart, BarChart } from '@tremor/react';
import type { StatusDistribution } from '@/types';
import { ChartWidget, ChartType } from '../ChartWidget';

interface Props {
  data: StatusDistribution[];
}

export function StatusDistributionChart({ data }: Props) {
  return (
    <ChartWidget
      title="Status Distribution"
      description="All active tasks by status"
      supportedTypes={['donut', 'bar']}
    >
      {(type: ChartType) => {
        if (type === 'bar') {
          return (
            <BarChart
              data={data}
              index="status_name"
              categories={['count']}
              colors={data.map((d) => d.color)}
              showLegend={false}
              className="h-full w-full min-h-[220px]"
            />
          );
        }
        return (
          <DonutChart
            data={data}
            index="status_name"
            category="count"
            colors={data.map((d) => d.color)}
            showLabel={true}
            className="h-full w-full min-h-[220px]"
          />
        );
      }}
    </ChartWidget>
  );
}
