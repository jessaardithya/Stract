import type { ProjectSummaryItem } from '@/types';

interface Props {
  projects: ProjectSummaryItem[];
}

export function ProjectsSummaryTable({ projects }: Props) {
  return (
    <div className="bg-white rounded-xl border border-[#e4e4e0] mt-8 overflow-hidden">
      <div className="p-6 border-b border-[#e4e4e0]">
        <h3 className="text-lg font-medium text-gray-900">Projects Overview</h3>
        <p className="text-sm text-gray-500 mt-1">Completion breakdown per project</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#fafaf8] border-b border-[#e4e4e0] text-sm font-medium text-gray-500">
              <th className="px-6 py-4">Project</th>
              <th className="px-6 py-4">Total tasks</th>
              <th className="px-6 py-4">Completed</th>
              <th className="px-6 py-4">Completion Rate</th>
              <th className="px-6 py-4 w-1/4">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e4e4e0]">
            {projects.map((p, idx) => {
              const rateColor = 
                p.completion_rate >= 75 ? 'text-emerald-600' :
                p.completion_rate >= 40 ? 'text-amber-600' : 'text-red-600';

              return (
                <tr key={p.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#fafaf8]/50'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: p.color }}
                      ></span>
                      <span className="font-medium text-gray-900">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">{p.total}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">{p.completed}</td>
                  <td className={`px-6 py-4 whitespace-nowrap font-medium ${rateColor}`}>
                    {p.completion_rate.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${p.completion_rate}%`,
                          backgroundColor: p.color
                        }}
                      ></div>
                    </div>
                  </td>
                </tr>
              );
            })}
            {projects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">
                  No projects available in this workspace.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
