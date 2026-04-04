import type { ProjectSummaryItem } from '@/types';

interface Props {
  projects: ProjectSummaryItem[];
}

export function ProjectsSummaryTable({ projects }: Props) {
  return (
    <div className="overflow-hidden border border-[#e4e4e0] bg-white">
      <div className="grid grid-cols-[minmax(220px,1.3fr)_120px_120px_180px_minmax(180px,1fr)] gap-0 border-b border-[#e4e4e0] bg-[#f7f4ee] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a8a85]">
        <span>Project</span>
        <span>Total tasks</span>
        <span>Completed</span>
        <span>Completion rate</span>
        <span>Progress</span>
      </div>

      <div className="divide-y divide-[#e4e4e0]">
        {projects.map((project) => {
          const rateColor =
            project.completion_rate >= 75
              ? 'text-emerald-600'
              : project.completion_rate >= 40
                ? 'text-amber-600'
                : 'text-rose-600';

          return (
            <div
              key={project.id}
              className="grid grid-cols-1 gap-4 px-5 py-4 text-sm text-[#5d5a54] md:grid-cols-[minmax(220px,1.3fr)_120px_120px_180px_minmax(180px,1fr)] md:items-center"
            >
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-950">{project.name}</p>
                  <p className="mt-0.5 text-xs text-[#8a8a85]">Project delivery snapshot</p>
                </div>
              </div>

              <span>{project.total}</span>
              <span>{project.completed}</span>
              <span className={`font-semibold ${rateColor}`}>{project.completion_rate.toFixed(1)}%</span>

              <div className="flex items-center gap-3">
                <div className="h-2 w-full overflow-hidden bg-[#ede8dc]">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${project.completion_rate}%`,
                      backgroundColor: project.color,
                    }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-xs text-[#8a8a85]">
                  {Math.round(project.completion_rate)}%
                </span>
              </div>
            </div>
          );
        })}

        {projects.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-[#8a8a85]">
            No projects available in this workspace.
          </div>
        )}
      </div>
    </div>
  );
}
