'use client';

import { useState, useRef } from 'react';
import { Loader2, Camera, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types';

interface AvatarUploadProps {
  user: User;
  onSuccess: (message: string) => void;
  onAvatarUpdate: (avatarUrl: string | null) => void;
}

export function AvatarUpload({ user, onSuccess, onAvatarUpdate }: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayUrl = preview ?? user.avatar_url;
  const initials = (user.name ?? user.email).charAt(0).toUpperCase();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      return;
    }

    // Preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);
    setProgress(20);

    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const storagePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('stract-avatar')
        .upload(storagePath, file, { upsert: true, cacheControl: '0' });

      if (uploadError) throw uploadError;
      setProgress(80);

      const { data: urlData } = supabase.storage.from('stract-avatar').getPublicUrl(storagePath);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });
      if (updateError) throw updateError;

      setProgress(100);
      setPreview(publicUrl);
      onAvatarUpdate(publicUrl);
      onSuccess('Avatar updated');
    } catch (err) {
      console.error('[AvatarUpload]', err);
      setPreview(null);
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      // 1. List files in user's avatar folder
      const { data: files } = await supabase.storage
        .from('stract-avatar')
        .list(user.id);

      // 2. Delete those files if they exist
      if (files && files.length > 0) {
        const paths = files.map(f => `${user.id}/${f.name}`);
        await supabase.storage.from('stract-avatar').remove(paths);
      }

      // 3. Clear user metadata
      const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } });
      if (error) throw error;

      setPreview(null);
      onAvatarUpdate(null);
      onSuccess('Avatar removed and file deleted');
    } catch (err) {
      console.error('[AvatarUpload] remove error:', err);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#e4e4e0] p-6">
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-6">
        Avatar
      </h2>

      <div className="flex items-center gap-5">
        <div className="relative">
          <Avatar className="h-20 w-20 border-2 border-gray-100">
            {displayUrl && <AvatarImage src={displayUrl} />}
            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-2xl font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {uploading && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-white" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg border-gray-200 text-[13px] text-gray-700 hover:bg-gray-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || removing}
          >
            <Camera size={13} className="mr-2" />
            Upload photo
          </Button>

          {(user.avatar_url || preview) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg text-[13px] text-gray-500 hover:text-red-500 hover:bg-red-50 flex items-center gap-1.5"
              onClick={handleRemove}
              disabled={uploading || removing}
            >
              {removing ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
              Remove
            </Button>
          )}

          <p className="text-[11px] text-gray-400">JPG, PNG, GIF, or WebP · Max 2MB</p>

          {uploading && (
            <div className="h-1 w-32 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
