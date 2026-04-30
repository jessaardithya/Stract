'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { registerFile } from '@/lib/api';
import type { ProjectAsset } from '@/types';

const ALLOWED_MIME_TYPES = [
  'image/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'text/',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface UploadMeta {
  title: string;
  description?: string;
}

export function useAssetUpload(workspaceId: string, projectId: string) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds 50MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
    }
    const isAllowed = ALLOWED_MIME_TYPES.some((type) => file.type.startsWith(type));
    if (!isAllowed) {
      return `File type not allowed. Allowed: images, PDF, Word docs, text files.`;
    }
    return null;
  };

  const upload = async (file: File, meta: UploadMeta): Promise<ProjectAsset | null> => {
    setError(null);
    setProgress(0);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return null;
    }

    setUploading(true);
    abortRef.current = false;

    const storagePath = `${workspaceId}/${projectId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    try {
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('stract-assets')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      setProgress(80);

      // Register metadata in backend
      const result = await registerFile(workspaceId, projectId, {
        title: meta.title,
        description: meta.description,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || `application/octet-stream`,
      });

      setProgress(100);
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);

      // Clean up the partially uploaded file
      await supabase.storage.from('stract-assets').remove([storagePath]);
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, progress, uploading, error, setError };
}
