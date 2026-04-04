'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, FileInput, RotateCcw } from 'lucide-react';

export default function FormSuccessPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';

  return (
    <main className="min-h-screen bg-[#fafaf8] px-4 py-10 md:px-6 md:py-16">
      <div className="mx-auto max-w-lg">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white">
            <FileInput size={16} />
          </div>
          <span className="text-[14px] font-bold text-gray-900">Stract</span>
        </div>

        <div className="rounded-2xl border border-[#e4e4e0] bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h1 className="text-[22px] font-bold text-gray-900">You're all set!</h1>
          <p className="mt-2 text-[14px] text-[#7a756e]">Your submission has been received.</p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <Link
              href={`/f/${slug}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#e4e4e0] bg-[#f9f7f4] px-5 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-[#f1ede7] transition-colors"
            >
              <RotateCcw size={13} />
              Submit another response
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
