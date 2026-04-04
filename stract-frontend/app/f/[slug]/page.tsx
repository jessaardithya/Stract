'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, FileInput, AlertCircle, LogIn } from 'lucide-react';
import { getPublicForm } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import PublicFormRenderer from '@/components/forms/PublicFormRenderer';
import type { PublicFormData } from '@/types';

export default function PublicFormPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';

  const [form, setForm] = useState<PublicFormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Check session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled) setHasSession(Boolean(session));

      try {
        const res = await getPublicForm(slug);
        if (!cancelled) {
          const data = res.data;
          if (!data.is_public && !session) {
            setNeedsAuth(true);
          } else {
            setForm(data);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Form not found');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [slug]);

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

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[#e4e4e0] bg-white p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-[#d0cbc3]" />
            <h2 className="text-[16px] font-semibold text-gray-800">This form is no longer available</h2>
            <p className="mt-1 text-[13px] text-[#8a8a85]">The form may have been deactivated or removed.</p>
          </div>
        ) : needsAuth ? (
          <div className="rounded-2xl border border-[#e4e4e0] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50">
              <LogIn size={20} className="text-violet-600" />
            </div>
            <h2 className="text-[16px] font-semibold text-gray-800">Sign in to access this form</h2>
            <p className="mt-1 text-[13px] text-[#8a8a85]">This is an internal form for workspace members only.</p>
            <Link
              href={`/login?next=/f/${slug}`}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-violet-700"
            >
              <LogIn size={14} />
              Sign in
            </Link>
          </div>
        ) : form ? (
          <div className="rounded-2xl border border-[#e4e4e0] bg-white p-7 shadow-sm">
            <h1 className="text-[22px] font-bold tracking-tight text-gray-900">{form.title}</h1>
            <div className="mt-6">
              <PublicFormRenderer form={form} slug={slug} />
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
