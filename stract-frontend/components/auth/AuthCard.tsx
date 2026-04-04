'use client';

import { Hexagon } from 'lucide-react';

interface AuthCardProps {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  eyebrow?: React.ReactNode;
  asideTitle?: React.ReactNode;
  asideDescription?: React.ReactNode;
  asidePoints?: string[];
}

export default function AuthCard({
  title,
  subtitle,
  children,
  footer,
  eyebrow = 'Workspace access',
  asideTitle = 'Work that stays aligned from board to delivery.',
  asideDescription = 'Plan projects, move work cleanly, and keep every workspace in sync without losing the signal.',
  asidePoints = [
    'Boards, timelines, calendar, and reports in one workspace',
    'Real-time updates across tasks, activity, and members',
    'Designed for focused project operations, not dashboard clutter',
  ],
}: AuthCardProps) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f4ee]">
      <div className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative flex min-h-[40vh] items-end overflow-hidden border-b border-[#e4e0d7] bg-[#f1ece3] px-6 py-8 md:px-10 lg:min-h-screen lg:border-b-0 lg:border-r lg:px-14 lg:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.1),transparent_26%)]" />
          <div className="absolute right-[-6%] top-[14%] h-[280px] w-[280px] rounded-full border border-white/60 bg-white/50 blur-3xl" />
          <div className="absolute left-[8%] top-[18%] h-[120px] w-[120px] border border-black/[0.05] bg-white/45" />
          <div className="absolute bottom-[14%] right-[22%] h-[86px] w-[86px] rounded-full border border-black/[0.04] bg-white/35" />

          <div className="relative z-10 max-w-[540px]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-[0_18px_40px_rgba(99,102,241,0.28)]">
                <Hexagon size={22} className="fill-current" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#8a8a85]">Stract</p>
                <p className="text-sm text-[#706b64]">Project workspace system</p>
              </div>
            </div>

            <div className="mt-12">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-600">{eyebrow}</p>
              <h1 className="mt-4 max-w-[12ch] text-[42px] font-semibold tracking-[-0.04em] text-gray-950 md:text-[56px]">
                {asideTitle}
              </h1>
              <p className="mt-5 max-w-[44ch] text-[15px] leading-7 text-[#706b64]">{asideDescription}</p>
            </div>

            <div className="mt-10 space-y-3">
              {asidePoints.map((point) => (
                <div
                  key={point}
                  className="flex items-start gap-3 border-t border-black/[0.06] py-3 text-sm text-[#5d5a54]"
                >
                  <span className="mt-1 h-2 w-2 rounded-full bg-violet-600" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center px-6 py-10 md:px-10 lg:px-14">
          <div className="mx-auto w-full max-w-[460px]">
            <div className="border border-[#e4e0d7] bg-white px-6 py-7 md:px-8 md:py-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8a8a85]">{eyebrow}</p>
              <h2 className="mt-4 text-[30px] font-semibold tracking-[-0.03em] text-gray-950">{title}</h2>
              <p className="mt-2 max-w-[42ch] text-sm leading-6 text-[#706b64]">{subtitle}</p>

              <div className="mt-8">{children}</div>
            </div>

            {footer && <div className="mt-5 text-sm text-[#706b64]">{footer}</div>}
          </div>
        </section>
      </div>
    </main>
  );
}
