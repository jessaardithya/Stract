'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';

interface PasswordFormProps {
  provider: 'email' | 'google';
  onSuccess: (message: string) => void;
}

export function PasswordForm({ provider, onSuccess }: PasswordFormProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [nextError, setNextError] = useState<string | null>(null);

  if (provider === 'google') {
    return (
      <div className="bg-white rounded-xl border border-[#e4e4e0] p-6">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
          Password
        </h2>
        <p className="text-[13px] text-gray-500">
          Password change is not available for Google accounts. Sign in with Google is managed by Google.
        </p>
      </div>
    );
  }

  const isValid = current && next.length >= 8 && next === confirm;

  const handleSubmit = async () => {
    setCurrentError(null);
    setNextError(null);

    if (next.length < 8) {
      setNextError('Password must be at least 8 characters');
      return;
    }
    if (next !== confirm) {
      setNextError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      // Verify current password
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No email');

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current,
      });
      if (verifyError) {
        setCurrentError('Incorrect password');
        return;
      }

      // Update password
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;

      setCurrent('');
      setNext('');
      setConfirm('');
      onSuccess('Password updated successfully');
    } catch (err) {
      setCurrentError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#e4e4e0] p-6">
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-6">
        Password
      </h2>

      <div className="space-y-4 max-w-sm">
        <div className="space-y-1.5">
          <Label htmlFor="current-password" className="text-[12px] text-gray-600">Current password</Label>
          <div className="relative">
            <Input
              id="current-password"
              type={showCurrent ? 'text' : 'password'}
              value={current}
              onChange={(e) => { setCurrent(e.target.value); setCurrentError(null); }}
              className="h-10 text-[13px] border-gray-200 pr-10 focus-visible:border-indigo-400 focus-visible:ring-indigo-500/10"
              disabled={loading}
            />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {currentError && <p className="text-[12px] text-red-500">{currentError}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-password" className="text-[12px] text-gray-600">New password</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showNext ? 'text' : 'password'}
              value={next}
              onChange={(e) => { setNext(e.target.value); setNextError(null); }}
              className="h-10 text-[13px] border-gray-200 pr-10 focus-visible:border-indigo-400 focus-visible:ring-indigo-500/10"
              placeholder="Minimum 8 characters"
              disabled={loading}
            />
            <button type="button" onClick={() => setShowNext(!showNext)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showNext ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-password" className="text-[12px] text-gray-600">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setNextError(null); }}
            className="h-10 text-[13px] border-gray-200 focus-visible:border-indigo-400 focus-visible:ring-indigo-500/10"
            disabled={loading}
          />
          {nextError && <p className="text-[12px] text-red-500">{nextError}</p>}
          {confirm && next !== confirm && !nextError && (
            <p className="text-[12px] text-red-500">Passwords do not match</p>
          )}
        </div>

        <Button
          className="h-9 px-4 text-[13px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
          onClick={handleSubmit}
          disabled={loading || !isValid}
        >
          {loading && <Loader2 size={13} className="animate-spin mr-2" />}
          Update Password
        </Button>
      </div>
    </div>
  );
}
