'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, XCircle, Loader2, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { approveSubmission, rejectSubmission } from '@/lib/api';
import { useApp } from '@/context/AppContext';
import type { FormSubmission, FormField } from '@/types';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-600 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
};

interface SubmissionRowProps {
  submission: FormSubmission;
  fields: FormField[];
  workspaceId: string;
  projectId: string;
  formId: string;
  onUpdate: (updated: Partial<FormSubmission> & { id: string }) => void;
}

export function SubmissionRow({ submission, fields, workspaceId, projectId, formId, onUpdate }: SubmissionRowProps) {
  const { openTask } = useApp();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const res = await approveSubmission(workspaceId, projectId, formId, submission.id);
      onUpdate({ id: submission.id, status: 'approved', task_id: res.data.task_id });
    } catch (e) {
      console.error(e);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await rejectSubmission(workspaceId, projectId, formId, submission.id);
      onUpdate({ id: submission.id, status: 'rejected' });
    } catch (e) {
      console.error(e);
    } finally {
      setIsRejecting(false);
    }
  };

  // Summary: first non-empty answer
  const firstAnswer = fields.reduce<string | null>((acc, f) => {
    if (acc) return acc;
    const v = submission.answers[f.id];
    return v ? v : null;
  }, null);

  return (
    <div className="rounded-xl border border-[#e7e1d8] bg-white overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Left */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12.5px] font-medium text-gray-900">
              {submission.submitter_name ?? submission.submitter_email ?? 'Anonymous'}
            </span>
            {submission.submitter_email && submission.submitter_name && (
              <span className="text-[11px] text-[#8a8a85]">({submission.submitter_email})</span>
            )}
            <span className={`border text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[submission.status]}`}>
              {submission.status}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-[#8a8a85]">
            {formatDistanceToNow(new Date(submission.created_at), { addSuffix: true })}
            {firstAnswer && ` · ${firstAnswer.slice(0, 60)}${firstAnswer.length > 60 ? '…' : ''}`}
          </p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          {submission.status === 'pending' && (
            <>
              <button
                onClick={() => void handleApprove()}
                disabled={isApproving}
                className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
              >
                {isApproving ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={11} />}
                Approve
              </button>
              <button
                onClick={() => void handleReject()}
                disabled={isRejecting}
                className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100 disabled:opacity-60"
              >
                {isRejecting ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={11} />}
                Reject
              </button>
            </>
          )}
          {submission.task_id && (
            <button
              onClick={() => openTask(submission.task_id!)}
              className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-600 hover:bg-violet-100"
            >
              View Task <ExternalLink size={9} />
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[#8a8a85] hover:text-gray-700"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded answers */}
      {expanded && (
        <div className="border-t border-[#f0ede8] px-4 py-3 space-y-2">
          {fields.map((f) => {
            const val = submission.answers[f.id];
            if (!val) return null;
            return (
              <div key={f.id}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#a0988e]">{f.label}</p>
                <p className="text-[12.5px] text-gray-800 mt-0.5">{val}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
