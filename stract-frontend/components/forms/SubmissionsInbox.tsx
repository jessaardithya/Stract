'use client';

import React, { useEffect, useState } from 'react';
import { Inbox } from 'lucide-react';
import { getSubmissions } from '@/lib/api';
import { SubmissionRow } from './SubmissionRow';
import type { FormSubmission, FormField } from '@/types';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

interface SubmissionsInboxProps {
  workspaceId: string;
  projectId: string;
  formId: string;
  fields: FormField[];
}

const TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const EMPTY_MESSAGES: Record<StatusFilter, string> = {
  all: 'No submissions yet',
  pending: 'No pending submissions',
  approved: 'No approved submissions',
  rejected: 'No rejected submissions',
};

export function SubmissionsInbox({ workspaceId, projectId, formId, fields }: SubmissionsInboxProps) {
  const [activeTab, setActiveTab] = useState<StatusFilter>('all');
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const status = activeTab === 'all' ? undefined : activeTab;
    getSubmissions(workspaceId, projectId, formId, status)
      .then((res) => { if (!cancelled) setSubmissions(res.data || []); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [workspaceId, projectId, formId, activeTab]);

  const handleUpdate = (updated: Partial<FormSubmission> & { id: string }) => {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-[#e7e1d8] px-4 pb-0 pt-3">
        {TABS.map((tab) => {
          const count = tab.key === 'all'
            ? undefined
            : submissions.filter((s) => s.status === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-violet-500 text-violet-700'
                  : 'border-transparent text-[#8a8a85] hover:text-gray-700'
              }`}
            >
              {tab.label}
              {count !== undefined && count > 0 && (
                <span className={`rounded-full px-1.5 py-0 text-[10px] font-bold ${activeTab === tab.key ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-500'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isLoading ? (
          [1, 2, 3].map((k) => (
            <div key={k} className="h-16 animate-pulse rounded-xl border border-[#e7e1d8] bg-[#f5f2ee]" />
          ))
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50">
              <Inbox size={18} className="text-[#a0988e]" />
            </div>
            <p className="text-[12.5px] text-[#8a8a85]">{EMPTY_MESSAGES[activeTab]}</p>
          </div>
        ) : (
          submissions.map((sub) => (
            <SubmissionRow
              key={sub.id}
              submission={sub}
              fields={fields}
              workspaceId={workspaceId}
              projectId={projectId}
              formId={formId}
              onUpdate={handleUpdate}
            />
          ))
        )}
      </div>
    </div>
  );
}
