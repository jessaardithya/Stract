'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CalendarIcon, ChevronDown } from 'lucide-react';
import { submitForm } from '@/lib/api';
import type { PublicFormData, FormField } from '@/types';

interface PublicFormRendererProps {
  form: PublicFormData;
  slug: string;
}

function PriorityField({ field, value, onChange }: { field: FormField; value: string; onChange: (v: string) => void }) {
  const opts = [
    { v: 'low', label: 'Low', style: 'border-blue-200 bg-blue-50 text-blue-700' },
    { v: 'medium', label: 'Medium', style: 'border-amber-200 bg-amber-50 text-amber-700' },
    { v: 'high', label: 'High', style: 'border-red-200 bg-red-50 text-red-700' },
  ];
  return (
    <div className="flex gap-2">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`flex-1 rounded-lg border py-2 text-[12.5px] font-semibold transition-all ${
            value === o.v ? `${o.style} border-current` : 'border-[#e4e4e0] text-[#8a8a85] hover:border-gray-300 hover:text-gray-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SelectField({ field, value, onChange }: { field: FormField; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl border border-[#e4e4e0] bg-white px-4 py-2.5 text-[13.5px] text-gray-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 pr-9"
      >
        <option value="">Select an option…</option>
        {(field.options ?? []).map((opt, i) => (
          <option key={i} value={opt}>{opt}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8a85] pointer-events-none" size={14} />
    </div>
  );
}

export default function PublicFormRenderer({ form, slug }: PublicFormRendererProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const setAnswer = (fieldId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) setErrors((prev) => { const n = { ...prev }; delete n[fieldId]; return n; });
  };

  const adjustTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const f of form.fields) {
      if (f.is_required && !answers[f.id]?.trim()) {
        newErrors[f.id] = `${f.label} is required`;
      }
      if (f.field_type === 'email' && answers[f.id] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers[f.id])) {
        newErrors[f.id] = 'Please enter a valid email address';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await submitForm(slug, { answers });
      router.push(`/f/${slug}/success`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const val = answers[field.id] ?? '';
    const err = errors[field.id];

    const fieldEl = (() => {
      switch (field.field_type) {
        case 'text':
        case 'email':
          return (
            <input
              type={field.field_type}
              value={val}
              onChange={(e) => setAnswer(field.id, e.target.value)}
              placeholder={field.placeholder ?? ''}
              className={`w-full rounded-xl border px-4 py-2.5 text-[13.5px] text-gray-800 outline-none transition-all focus:ring-2 focus:ring-violet-100 ${err ? 'border-red-300 bg-red-50 focus:border-red-400' : 'border-[#e4e4e0] bg-white focus:border-violet-400'}`}
            />
          );
        case 'textarea':
          return (
            <textarea
              ref={(el) => { textareaRefs.current[field.id] = el; }}
              value={val}
              onChange={(e) => { setAnswer(field.id, e.target.value); adjustTextarea(e.target); }}
              placeholder={field.placeholder ?? ''}
              rows={3}
              className={`w-full resize-none rounded-xl border px-4 py-2.5 text-[13.5px] text-gray-800 outline-none transition-all focus:ring-2 focus:ring-violet-100 ${err ? 'border-red-300 bg-red-50 focus:border-red-400' : 'border-[#e4e4e0] bg-white focus:border-violet-400'}`}
            />
          );
        case 'select':
          return <SelectField field={field} value={val} onChange={(v) => setAnswer(field.id, v)} />;
        case 'date':
          return (
            <div className="relative">
              <input
                type="date"
                value={val}
                onChange={(e) => setAnswer(field.id, e.target.value)}
                className={`w-full rounded-xl border px-4 py-2.5 text-[13.5px] text-gray-800 outline-none transition-all focus:ring-2 focus:ring-violet-100 ${err ? 'border-red-300 bg-red-50 focus:border-red-400' : 'border-[#e4e4e0] bg-white focus:border-violet-400'}`}
              />
            </div>
          );
        case 'priority':
          return <PriorityField field={field} value={val} onChange={(v) => setAnswer(field.id, v)} />;
        default:
          return null;
      }
    })();

    return (
      <div key={field.id} className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-gray-800">
          {field.label}
          {field.is_required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        {fieldEl}
        {err && <p className="text-[11.5px] text-red-500">{err}</p>}
      </div>
    );
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-5">
      {form.description && (
        <p className="text-[13.5px] leading-6 text-[#6b6660]">{form.description}</p>
      )}

      {form.fields.map(renderField)}

      {submitError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-600">
          {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-[13.5px] font-semibold text-white transition-all hover:bg-violet-700 disabled:opacity-70"
      >
        {isSubmitting && <Loader2 size={15} className="animate-spin" />}
        {isSubmitting ? 'Submitting…' : 'Submit'}
      </button>
    </form>
  );
}
