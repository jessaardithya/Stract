'use client';

import { useState, useEffect, useMemo } from 'react';
import { Link2, Upload, LayoutGrid, List, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AssetsList } from './AssetsList';
import { AddLinkModal } from './AddLinkModal';
import { UploadFileModal } from './UploadFileModal';
import { getAssets } from '@/lib/api';
import type { ProjectAsset } from '@/types';

type FilterTab = 'all' | 'link' | 'file' | 'pinned';
type ViewMode = 'grid' | 'list';
const VIEW_MODE_KEY = 'stract-assets-view';

interface AssetsPageProps {
  workspaceId: string;
  projectId: string;
  projectName: string;
}

export function AssetsPage({ workspaceId, projectId, projectName }: AssetsPageProps) {
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) ?? 'grid';
    }
    return 'grid';
  });
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const handleViewChange = (v: ViewMode) => {
    setView(v);
    localStorage.setItem(VIEW_MODE_KEY, v);
  };

  useEffect(() => {
    setLoading(true);
    getAssets(workspaceId, projectId)
      .then((res) => setAssets(res.data ?? []))
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, [workspaceId, projectId]);

  const filteredAssets = useMemo(() => {
    if (filter === 'pinned') return assets.filter((a) => a.pinned);
    if (filter === 'link') return assets.filter((a) => a.asset_type === 'link');
    if (filter === 'file') return assets.filter((a) => a.asset_type === 'file');
    return assets;
  }, [assets, filter]);

  const handleNew = (asset: ProjectAsset) => {
    setAssets((prev) => {
      // Insert pinned at top, unpinned after pinned
      if (asset.pinned) return [asset, ...prev];
      const firstUnpinnedIdx = prev.findIndex((a) => !a.pinned);
      if (firstUnpinnedIdx === -1) return [...prev, asset];
      return [...prev.slice(0, firstUnpinnedIdx), asset, ...prev.slice(firstUnpinnedIdx)];
    });
  };

  const handleUpdate = (updated: ProjectAsset) => {
    setAssets((prev) => {
      const list = prev.map((a) => (a.id === updated.id ? updated : a));
      // Re-sort: pinned first
      return [...list.filter((a) => a.pinned), ...list.filter((a) => !a.pinned)];
    });
  };

  const handleDelete = (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  };

  const TABS: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'link', label: 'Links' },
    { id: 'file', label: 'Files' },
    { id: 'pinned', label: 'Pinned' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-[#e4e4e0] bg-white px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-950">Assets</h1>
            <p className="mt-0.5 text-[13px] text-gray-500">{projectName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-[13px] border-gray-200 text-gray-700 hover:bg-gray-50"
              onClick={() => setAddLinkOpen(true)}
            >
              <Link2 size={14} className="mr-1.5" />
              Add Link
            </Button>
            <Button
              size="sm"
              className="h-8 rounded-lg text-[13px] bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => setUploadOpen(true)}
            >
              <Upload size={14} className="mr-1.5" />
              Upload File
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          {/* Filter Tabs */}
          <div className="flex items-center gap-0.5 bg-gray-100/80 rounded-lg p-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
                  filter === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-0.5 bg-gray-100/80 rounded-lg p-0.5">
            <button
              onClick={() => handleViewChange('grid')}
              className={`p-1.5 rounded-md transition-colors ${view === 'grid' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-700'}`}
              title="Grid view"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => handleViewChange('list')}
              className={`p-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-700'}`}
              title="List view"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-[#fafaf8] p-6">
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 size={20} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <AssetsList assets={filteredAssets} view={view} filter={filter} onUpdate={handleUpdate} onDelete={handleDelete} />
        )}
      </div>

      <AddLinkModal
        open={addLinkOpen}
        onOpenChange={setAddLinkOpen}
        workspaceId={workspaceId}
        projectId={projectId}
        onSuccess={(asset) => { setAddLinkOpen(false); handleNew(asset); }}
      />
      <UploadFileModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        workspaceId={workspaceId}
        projectId={projectId}
        onSuccess={(asset) => { setUploadOpen(false); handleNew(asset); }}
      />
    </div>
  );
}
