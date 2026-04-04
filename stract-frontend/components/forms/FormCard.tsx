'use client';

import React, { useState } from 'react';
import { Copy, Settings, Trash2, Globe, Lock, CheckCircle2, EyeOff } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { FormListItem } from '@/types';

interface FormCardProps {
  item: FormListItem;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => Promise<void>;
}

export function FormCard({ item, isSelected, onSelect, onDelete }: FormCardProps) {
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/f/${item.slug}`;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try { await onDelete(); }
    finally { setIsDeleting(false); }
  };

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex flex-col gap-3 rounded-xl border p-4 cursor-pointer transition-all ${
        isSelected
          ? 'border-violet-300 bg-violet-50 shadow-sm'
          : 'border-[#e7e1d8] bg-white hover:border-[#d5cfc6] hover:shadow-sm'
      }`}
    >
      {/* Delete button */}
      {isHovered && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded opacity-0 group-hover:opacity-100 text-[#8a8a85] hover:bg-red-50 hover:text-red-500 transition-all"
            >
              <Trash2 size={12} />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete form?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{item.title}" and all its submissions. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleDelete()} className="bg-red-500 hover:bg-red-600">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.is_public ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {item.is_public ? <Globe size={9} /> : <Lock size={9} />}
          {item.is_public ? 'Public' : 'Internal'}
        </span>
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-tight ${item.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {item.is_active ? <CheckCircle2 size={9} /> : <EyeOff size={9} />}
          {item.is_active ? 'LIVE' : 'DRAFT'}
        </span>
        {item.pending_count > 0 && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            {item.pending_count} pending
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-[13.5px] font-semibold text-gray-900 leading-snug pr-6">
        {item.title || 'Untitled Form'}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[11px] text-[#8a8a85]">
          {item.submission_count} submission{item.submission_count !== 1 ? 's' : ''}
        </span>
        {item.is_public && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-[#8a8a85] hover:text-violet-600 transition-colors"
          >
            {copied ? <CheckCircle2 size={11} className="text-emerald-500" /> : <Copy size={11} />}
            {copied ? 'Copied!' : 'Copy URL'}
          </button>
        )}
      </div>
    </div>
  );
}
