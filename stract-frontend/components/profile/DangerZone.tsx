'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DangerZone() {
  return (
    <div className="bg-white rounded-xl border border-red-200 p-6">
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-4">
        Danger Zone
      </h2>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[14px] font-medium text-gray-900">Delete account</p>
          <p className="mt-0.5 text-[13px] text-gray-500">Account deletion is not available yet.</p>
        </div>
        <Button
          disabled
          variant="outline"
          className="h-9 rounded-lg border-red-200 text-red-400 hover:bg-red-50 opacity-50 cursor-not-allowed shrink-0"
        >
          <AlertTriangle size={14} className="mr-2" />
          Delete Account
        </Button>
      </div>
    </div>
  );
}
