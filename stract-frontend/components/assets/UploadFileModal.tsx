'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Loader2, FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAssetUpload } from '@/hooks/useAssetUpload';
import type { ProjectAsset } from '@/types';

interface UploadFileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  projectId: string;
  onSuccess: (asset: ProjectAsset) => void;
}

export function UploadFileModal({ open, onOpenChange, workspaceId, projectId, onSuccess }: UploadFileModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, progress, uploading, error, setError } = useAssetUpload(workspaceId, projectId);

  const reset = () => {
    setFile(null);
    setTitle('');
    setDescription('');
    setIsDragOver(false);
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (uploading) return; // prevent closing during upload
    if (!next) reset();
    onOpenChange(next);
  };

  const selectFile = (selected: File) => {
    setFile(selected);
    // Auto-fill title from filename (strip extension)
    const name = selected.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
    setTitle(name);
    setError(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) selectFile(dropped);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) selectFile(selected);
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) return;
    const asset = await upload(file, { title: title.trim(), description: description.trim() || undefined });
    if (asset) {
      onSuccess(asset);
      handleOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[460px] rounded-xl border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-semibold">Upload a file</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragOver ? 'border-indigo-400 bg-indigo-50/50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileInput} />
            <Upload size={24} className={`mx-auto mb-2 ${isDragOver ? 'text-indigo-500' : 'text-gray-400'}`} />
            <p className="text-[13px] font-medium text-gray-700">Drag & drop or click to browse</p>
            <p className="text-[12px] text-gray-400 mt-1">Max 50MB · Images, PDFs, Word docs, text files</p>
          </div>

          {/* Selected file */}
          {file && (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
              <FileIcon size={16} className="text-gray-500 shrink-0" />
              <span className="text-[13px] text-gray-700 truncate flex-1">{file.name}</span>
              <button onClick={() => { setFile(null); setTitle(''); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={14} />
              </button>
            </div>
          )}

          {error && <p className="text-[12px] text-red-500">{error}</p>}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="file-title" className="text-[12px] uppercase tracking-wide font-semibold text-gray-500">
              Title <span className="text-red-400">*</span>
            </Label>
            <Input
              id="file-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="File title"
              className="h-10 text-[13px] border-gray-200 focus-visible:border-indigo-400 focus-visible:ring-indigo-500/10"
              disabled={uploading}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="file-desc" className="text-[12px] uppercase tracking-wide font-semibold text-gray-500">
              Description
            </Label>
            <Textarea
              id="file-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional note about this file"
              className="text-[13px] border-gray-200 focus-visible:border-indigo-400 focus-visible:ring-indigo-500/10 resize-none min-h-[72px]"
              disabled={uploading}
            />
          </div>

          {/* Progress bar */}
          {uploading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[12px] text-gray-500">
                <span>Uploading…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" className="h-9 text-[13px] text-gray-600 hover:text-gray-900" onClick={() => handleOpenChange(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button
              className="h-9 px-4 text-[13px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              onClick={handleUpload}
              disabled={uploading || !file || !title.trim()}
            >
              {uploading ? <Loader2 size={13} className="animate-spin mr-2" /> : <Upload size={13} className="mr-2" />}
              Upload
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
