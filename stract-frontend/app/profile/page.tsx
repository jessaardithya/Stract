'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { getCurrentUser } from '@/lib/supabase';
import type { User } from '@/types';

export default function ProfileRoute() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (!u) {
        router.replace('/login');
        return;
      }
      setUser(u);
    }).catch(() => {
      router.replace('/login');
    }).finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#fafaf8]">
        <div className="h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return <ProfilePage user={user} />;
}
