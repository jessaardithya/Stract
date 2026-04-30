'use client';

import { Paperclip, Link2, File } from 'lucide-react';
import { AssetCard } from './AssetCard';
import type { ProjectAsset } from '@/types';

type FilterTab = 'all' | 'link' | 'file' | 'pinned';

interface AssetsListProps {
  assets: ProjectAsset[];
  view: 'grid' | 'list';
  filter: FilterTab;
  onUpdate: (updated: ProjectAsset) => void;
  onDelete: (id: string) => void;
}

const EMPTY_STATES: Record<FilterTab, { icon: React.ReactNode; title: string; description: string }> = {
  all: {
    icon: <Paperclip size={32} className="text-gray-300" />,
    title: 'No assets yet',
    description: 'Save links or upload files to build your project asset library.',
  },
  link: {
    icon: <Link2 size={32} className="text-gray-300" />,
    title: 'No links saved yet',
    description: 'Save links to Google Drive, Figma, GitHub, Notion, or any URL.',
  },
  file: {
    icon: <File size={32} className="text-gray-300" />,
    title: 'No files uploaded yet',
    description: 'Upload images, PDFs, documents, and more.',
  },
  pinned: {
    icon: <Paperclip size={32} className="text-gray-300" />,
    title: 'No pinned assets',
    description: 'Pin important assets to keep them at the top of the list.',
  },
};

export function AssetsList({ assets, view, filter, onUpdate, onDelete }: AssetsListProps) {
  if (assets.length === 0) {
    const { icon, title, description } = EMPTY_STATES[filter];
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4">{icon}</div>
        <p className="text-[15px] font-semibold text-gray-800">{title}</p>
        <p className="mt-1 text-[13px] text-gray-400 max-w-xs">{description}</p>
      </div>
    );
  }

  if (view === 'list') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y-0">
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} view="list" onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {assets.map((asset) => (
        <AssetCard key={asset.id} asset={asset} view="grid" onUpdate={onUpdate} onDelete={onDelete} />
      ))}
    </div>
  );
}
