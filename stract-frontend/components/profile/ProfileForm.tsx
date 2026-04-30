'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types';

interface ProfileFormProps {
  user: User;
  onSuccess: (message: string) => void;
  onUserUpdate: (updates: Partial<Pick<User, 'name'>>) => void;
}

export function ProfileForm({ user, onSuccess, onUserUpdate }: ProfileFormProps) {
  const [name, setName] = useState(user.name ?? '');
  const [email, setEmail] = useState(user.email);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailInfo, setEmailInfo] = useState<string | null>(null);

  const nameChanged = name.trim() !== (user.name ?? '');
  const emailChanged = email.trim() !== user.email;
  const hasChanges = nameChanged || emailChanged;

  const handleSave = async () => {
    setError(null);
    setEmailInfo(null);
    setLoading(true);

    try {
      if (nameChanged) {
        const { error } = await supabase.auth.updateUser({
          data: { full_name: name.trim() },
        });
        if (error) throw error;
        onUserUpdate({ name: name.trim() });
      }

      if (emailChanged) {
        const { error } = await supabase.auth.updateUser({ email: email.trim() });
        if (error) throw error;
        setEmailInfo('A confirmation email has been sent to your new address.');
      }

      if (nameChanged && !emailChanged) {
        onSuccess('Profile updated successfully');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#e4e4e0] p-6">
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-6">
        Personal Info
      </h2>

      <div className="space-y-4 max-w-sm">
        <div className="space-y-1.5">
          <Label htmlFor="display-name" className="text-[12px] text-gray-600">Display name</Label>
          <Input
            id="display-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 text-[13px] border-gray-200 focus-visible:border-indigo-400 focus-visible:ring-indigo-500/10"
            placeholder="Your name"
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[12px] text-gray-600">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 text-[13px] border-gray-200 focus-visible:border-indigo-400 focus-visible:ring-indigo-500/10"
            placeholder="email@example.com"
            disabled={loading}
          />
          {emailInfo && <p className="text-[12px] text-indigo-600">{emailInfo}</p>}
        </div>

        {error && <p className="text-[12px] text-red-500">{error}</p>}

        <Button
          className="h-9 px-4 text-[13px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
          onClick={handleSave}
          disabled={loading || !hasChanges}
        >
          {loading && <Loader2 size={13} className="animate-spin mr-2" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
