'use client';

import { useState } from 'react';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AvatarUpload } from './AvatarUpload';
import { ProfileForm } from './ProfileForm';
import { PasswordForm } from './PasswordForm';
import { DangerZone } from './DangerZone';
import type { User } from '@/types';

interface ProfilePageProps {
  user: User;
}

export function ProfilePage({ user: initialUser }: ProfilePageProps) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleUserUpdate = (updates: Partial<Pick<User, 'name' | 'avatar_url'>>) => {
    setUser((prev) => ({ ...prev, ...updates }));
  };

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[13px] text-gray-500 hover:text-gray-800 transition-colors mb-8"
        >
          <ArrowLeft size={15} />
          Back
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-950">Profile</h1>
          <p className="mt-1 text-[13px] text-gray-500">Manage your personal account settings</p>
        </div>

        <div className="space-y-4">
          <AvatarUpload
            user={user}
            onSuccess={showToast}
            onAvatarUpdate={(avatarUrl) => handleUserUpdate({ avatar_url: avatarUrl ?? undefined })}
          />

          <ProfileForm
            user={user}
            onSuccess={showToast}
            onUserUpdate={handleUserUpdate}
          />

          <PasswordForm
            provider={user.provider}
            onSuccess={showToast}
          />

          <DangerZone />
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-3 bg-gray-900 text-white text-[13px] rounded-xl shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
          <CheckCircle size={14} className="text-green-400" />
          {toast}
        </div>
      )}
    </div>
  );
}
