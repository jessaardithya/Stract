import { GeistSans } from 'geist/font/sans';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { AppContextProvider } from '@/context/AppContext';
import BootGate from '@/components/BootGate';
import TaskDetailModal from '@/components/tasks/TaskDetailModal';
import "./globals.css";

export const metadata = {
  title: "Stract — Kanban Board",
  description: "A premium task management Kanban board",
};

import { StatusProvider } from '@/context/StatusContext';

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="font-sans antialiased bg-[#fafaf8] text-[#1a1a1a]">
        <TooltipProvider delayDuration={300}>
          <AppContextProvider>
            <StatusProvider>
              <BootGate>
                {children}
                <TaskDetailModal />
              </BootGate>
            </StatusProvider>
            <Toaster
              position="bottom-right"
              duration={3500}
              richColors
              toastOptions={{
                style: { fontFamily: 'var(--font-geist-sans)', fontSize: '14px' },
              }}
            />
          </AppContextProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
