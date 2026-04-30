'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Pin, PinOff, Trash2, ExternalLink, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AssetSourceIcon } from './AssetSourceIcon';
import { updateAsset, deleteAsset } from '@/lib/api';
import type { ProjectAsset } from '@/types';

interface AssetCardProps {
  asset: ProjectAsset;
  view: 'grid' | 'list';
  onUpdate: (updated: ProjectAsset) => void;
  onDelete: (id: string) => void;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AssetCard({ asset, view, onUpdate, onDelete }: AssetCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const openUrl = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  const handleOpen = () => {
    const url = asset.asset_type === 'link' ? asset.url : asset.download_url;
    if (url) openUrl(url);
  };

  const handlePin = async () => {
    setPinning(true);
    try {
      const result = await updateAsset(asset.workspace_id, asset.project_id, asset.id, { pinned: !asset.pinned });
      onUpdate(result.data);
    } catch {
      // silent
    } finally {
      setPinning(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAsset(asset.workspace_id, asset.project_id, asset.id);
      onDelete(asset.id);
    } catch {
      // silent
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const initials = (asset.creator_name ?? '?').charAt(0).toUpperCase();
  const timeAgo = formatDistanceToNow(new Date(asset.created_at), { addSuffix: true });

  if (view === 'list') {
    return (
      <>
        <div className={`flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 hover:bg-gray-50/50 transition-colors group ${asset.pinned ? 'border-l-2 border-l-violet-500' : ''}`}>
          <div className="size-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
            <AssetSourceIcon
              sourceType={asset.asset_type === 'file' ? 'file' : asset.source_type}
              mimeType={asset.mime_type}
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-gray-900 truncate">{asset.title}</p>
            {asset.description && (
              <p className="text-[12px] text-gray-500 truncate">{asset.description}</p>
            )}
          </div>

          <span className="text-[12px] text-gray-400 shrink-0 hidden sm:block">{asset.creator_name ?? 'Unknown'}</span>
          <span className="text-[12px] text-gray-400 shrink-0 hidden md:block">{timeAgo}</span>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700" onClick={handleOpen} title="Open">
              <ExternalLink size={13} />
            </Button>
            <Button size="sm" variant="ghost" className={`h-7 w-7 p-0 transition-colors ${asset.pinned ? 'text-violet-600' : 'text-gray-400 hover:text-violet-600'}`} onClick={handlePin} disabled={pinning} title={asset.pinned ? 'Unpin' : 'Pin'}>
              {asset.pinned ? <PinOff size={13} /> : <Pin size={13} />}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => setConfirmDelete(true)} title="Delete">
              <Trash2 size={13} />
            </Button>
          </div>
        </div>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete asset?</AlertDialogTitle>
              <AlertDialogDescription>
                "{asset.title}" will be permanently deleted. {asset.asset_type === 'file' && 'The file will also be removed from storage.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-500 hover:bg-red-600">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <div className={`bg-white rounded-xl border group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden ${asset.pinned ? 'border-violet-300 shadow-sm shadow-violet-100' : 'border-gray-200'}`}>
        {asset.pinned && <div className="h-0.5 w-full bg-gradient-to-r from-violet-500 to-indigo-400" />}

        {/* Preview / Icon Area */}
        <div className="flex-1 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="size-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
              <AssetSourceIcon
                sourceType={asset.asset_type === 'file' ? 'file' : asset.source_type}
                mimeType={asset.mime_type}
                size={20}
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem onClick={handlePin} disabled={pinning}>
                  {asset.pinned ? <PinOff size={13} className="mr-2" /> : <Pin size={13} className="mr-2" />}
                  {asset.pinned ? 'Unpin' : 'Pin'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConfirmDelete(true)} className="text-red-500 focus:text-red-600 focus:bg-red-50">
                  <Trash2 size={13} className="mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-4">
            <p className="text-[14px] font-semibold text-gray-900 leading-snug line-clamp-2">{asset.title}</p>
            {asset.description && (
              <p className="mt-1 text-[12px] text-gray-500 line-clamp-2">{asset.description}</p>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Avatar className="h-5 w-5">
              {asset.creator_avatar && <img src={asset.creator_avatar} alt="" className="rounded-full" />}
              <AvatarFallback className="text-[9px] bg-violet-100 text-violet-700">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-[11px] text-gray-400">{asset.creator_name ?? 'Unknown'} · {timeAgo}</span>
            {asset.file_size && (
              <span className="text-[11px] text-gray-400 ml-auto">{formatBytes(asset.file_size)}</span>
            )}
          </div>
        </div>

        {/* Action footer */}
        <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50/50">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[12px] rounded-md border-gray-200 text-gray-700 hover:bg-white"
            onClick={handleOpen}
          >
            <ExternalLink size={12} className="mr-1.5" />
            Open
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className={`h-7 text-[12px] rounded-md transition-colors ${asset.pinned ? 'text-violet-600 hover:text-violet-700' : 'text-gray-400 hover:text-violet-600'}`}
            onClick={handlePin}
            disabled={pinning}
          >
            {asset.pinned ? <PinOff size={12} className="mr-1.5" /> : <Pin size={12} className="mr-1.5" />}
            {asset.pinned ? 'Unpin' : 'Pin'}
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete asset?</AlertDialogTitle>
            <AlertDialogDescription>
              "{asset.title}" will be permanently deleted. {asset.asset_type === 'file' && 'The file will also be removed from storage.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
