'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AssetSourceIcon } from './AssetSourceIcon';
import { saveLink, fetchUrlTitle } from '@/lib/api';
import type { ProjectAsset, SourceType } from '@/types';

function detectSourceType(url: string): SourceType {
  const lower = url.toLowerCase();
  if (lower.includes('drive.google.com')) return 'gdrive';
  if (lower.includes('figma.com')) return 'figma';
  if (lower.includes('github.com')) return 'github';
  if (lower.includes('notion.so')) return 'notion';
  return 'generic';
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  gdrive: 'Google Drive',
  figma: 'Figma',
  github: 'GitHub',
  notion: 'Notion',
  generic: 'Website',
};

interface AddLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  projectId: string;
  onSuccess: (asset: ProjectAsset) => void;
}

export function AddLinkModal({ open, onOpenChange, workspaceId, projectId, onSuccess }: AddLinkModalProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetchingTitle, setFetchingTitle] = useState(false);

  const detectedSourceType = url && isValidUrl(url) ? detectSourceType(url) : null;

  const reset = () => {
    setUrl('');
    setTitle('');
    setDescription('');
    setUrlError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!saving) {
      if (!next) reset();
      onOpenChange(next);
    }
  };

  const handleUrlBlur = async () => {
    if (!url) return;
    if (!isValidUrl(url)) {
      setUrlError('Please enter a valid URL (must start with http:// or https://)');
      return;
    }
    setUrlError(null);

    if (!title) {
      setFetchingTitle(true);
      try {
        const result = await fetchUrlTitle(url);
        if (result.title) setTitle(result.title);
      } catch {
        // silent — user fills manually
      } finally {
        setFetchingTitle(false);
      }
    }
  };

  const handleSave = async () => {
    if (!isValidUrl(url)) {
      setUrlError('Please enter a valid URL');
      return;
    }
    if (!title.trim()) return;

    setSaving(true);
    try {
      const result = await saveLink(workspaceId, projectId, {
        url,
        title: title.trim(),
        description: description.trim() || undefined,
      });
      onSuccess(result.data);
      handleOpenChange(false);
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Failed to save link');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[460px] rounded-xl border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-semibold">Save a link</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="link-url" className="text-[12px] uppercase tracking-wide font-semibold text-gray-500">
              URL <span className="text-red-400">*</span>
            </Label>
            <Input
              id="link-url"
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError(null); }}
              onBlur={handleUrlBlur}
              placeholder="https://..."
              className="h-10 text-[13px] border-gray-200 focus-visible:border-indigo-400 focus-visible:ring-indigo-500/10"
            />
            {urlError && <p className="text-[12px] text-red-500">{urlError}</p>}
            {detectedSourceType && !urlError && (
              <div className="flex items-center gap-2 text-[12px] text-gray-500">
                <AssetSourceIcon sourceType={detectedSourceType} size={14} />
                <span><strong className="text-gray-700">{SOURCE_TYPE_LABELS[detectedSourceType]}</strong> detected</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="link-title" className="text-[12px] uppercase tracking-wide font-semibold text-gray-500">
              Title <span className="text-red-400">*</span>
            </Label>
            <div className="relative">
              <Input
                id="link-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Page title"
                className="h-10 text-[13px] border-gray-200 focus-visible:border-indigo-400 focus-visible:ring-indigo-500/10 pr-8"
              />
              {fetchingTitle && (
                <Loader2 size={12} className="animate-spin text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="link-desc" className="text-[12px] uppercase tracking-wide font-semibold text-gray-500">
              Description
            </Label>
            <Textarea
              id="link-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional note about this link"
              className="text-[13px] border-gray-200 focus-visible:border-indigo-400 focus-visible:ring-indigo-500/10 resize-none min-h-[80px]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" className="h-9 text-[13px] text-gray-600 hover:text-gray-900" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              className="h-9 px-4 text-[13px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              onClick={handleSave}
              disabled={saving || !url.trim() || !title.trim() || !!urlError}
            >
              {saving && <Loader2 size={13} className="animate-spin mr-2" />}
              Save Link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
