import { BarChart } from '@tremor/react';
import type { AssigneeWorkload } from '@/types';
import { ChartWidget, ChartType } from '../ChartWidget';

interface Props {
  data: AssigneeWorkload[];
}

export function AssigneeWorkloadChart({ data }: Props) {
  return (
    <ChartWidget
      title="Assignee Workload"
      description="Task distributions per team member"
      supportedTypes={['bar']}
    >
      {(_type: ChartType) => {
        return (
          <BarChart
            data={data}
            index="name"
            categories={['todo', 'in_progress', 'done']}
            colors={['slate-300', 'amber-400', 'emerald-500']}
            stack={true}
            showLegend={true}
            className="h-full w-full min-h-[220px]"
          />
        );
      }}
    </ChartWidget>
  );
}
