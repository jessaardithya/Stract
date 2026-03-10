'use client';

import { useState } from 'react';
import { Loader2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createWorkspace } from '@/lib/api';
import { deriveSlug } from '@/utils/slug';
import { useApp } from '@/context/AppContext';

export default function CreateWorkspace() {
  const { addWorkspace } = useApp();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugError, setSlugError] = useState('');

  const handleNameChange = (e) => {
    setName(e.target.value);
    if (!slugManuallyEdited) {
      setSlug(deriveSlug(e.target.value));
      setSlugError('');
    }
  };

  const handleSlugChange = (e) => {
    setSlugManuallyEdited(true);
    setSlug(deriveSlug(e.target.value));
    setSlugError('');
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();
    if (!trimmedName || !trimmedSlug) return;
    setIsSubmitting(true);
    setSlugError('');
    try {
      const result = await createWorkspace({ name: trimmedName, slug: trimmedSlug });
      await addWorkspace(result.data);
    } catch (err) {
      if (err.message?.toLowerCase().includes('slug') || err.message?.toLowerCase().includes('taken') || err.message?.includes('409')) {
        setSlugError('This URL is already taken');
      } else {
        setSlugError(err.message || 'Something went wrong');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const canSubmit = name.trim() && slug.trim() && !isSubmitting;

  return (
    <div className="min-h-screen bg-[#fafaf8] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-[#e4e4e0] shadow-sm p-10 w-full max-w-md">
        {/* Logo / Icon */}
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 mb-6 shadow-lg shadow-violet-200">
          <span className="text-white text-xl font-bold">S</span>
        </div>

        <h1 className="text-xl font-semibold text-gray-900">Welcome to Stract</h1>
        <p className="text-sm text-gray-500 mt-1 mb-8">Set up your first workspace to get started</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Workspace name */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              Workspace name
            </label>
            <Input
              autoFocus
              value={name}
              onChange={handleNameChange}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Acme Corp"
              disabled={isSubmitting}
              className="border-[#e4e4e0] focus-visible:ring-violet-300 focus-visible:border-violet-400"
            />
          </div>

          {/* Workspace URL / Slug */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              Workspace URL
            </label>
            <div className="flex items-center gap-0 rounded-lg border border-[#e4e4e0] overflow-hidden focus-within:ring-2 focus-within:ring-violet-300 focus-within:border-violet-400 transition-all">
              <div className="flex items-center gap-1.5 pl-3 pr-2 py-2 bg-[#f4f4f2] border-r border-[#e4e4e0] shrink-0">
                <Globe size={13} className="text-[#8a8a85]" />
                <span className="text-sm text-gray-400 whitespace-nowrap">stract.app /</span>
              </div>
              <input
                value={slug}
                onChange={handleSlugChange}
                placeholder="acme-corp"
                disabled={isSubmitting}
                className="flex-1 px-3 py-2 text-sm bg-transparent outline-none text-gray-900 placeholder:text-gray-400"
              />
            </div>
            {slugError && (
              <p className="text-sm text-red-500 mt-1.5">{slugError}</p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-[#1a1a1a] hover:bg-[#333] text-white h-10 mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="mr-2 animate-spin" />
                Creating…
              </>
            ) : (
              'Create Workspace →'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
