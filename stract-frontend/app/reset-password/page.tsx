'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionValid(!!session);
    });
  }, []);

  const handleReset = async () => {
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => router.replace('/'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (sessionValid === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fafaf8]">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!sessionValid) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fafaf8]">
        <div className="text-center max-w-sm px-6">
          <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-lg">⚠</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Reset link expired</h1>
          <p className="text-[13px] text-gray-500 mb-6">This password reset link is no longer valid. Request a new one from the login page.</p>
          <Button
            variant="outline"
            className="h-10 rounded-lg text-[13px] border-gray-200"
            onClick={() => router.replace('/login')}
          >
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fafaf8]">
        <div className="text-center">
          <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
          <p className="text-[15px] font-semibold text-gray-900">Password updated!</p>
          <p className="text-[13px] text-gray-500 mt-1">Redirecting you to the app…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#fafaf8]">
      <div className="w-full max-w-sm px-6">
        <div className="bg-white rounded-2xl border border-[#e4e4e0] p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-950 mb-1">Set new password</h1>
          <p className="text-[13px] text-gray-500 mb-6">Choose a strong password for your account.</p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rp-new" className="text-[12px] text-gray-600">New password</Label>
              <div className="relative">
                <Input
                  id="rp-new"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="h-10 text-[13px] border-gray-200 pr-10 focus-visible:border-indigo-400 focus-visible:ring-indigo-500/10"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rp-confirm" className="text-[12px] text-gray-600">Confirm password</Label>
              <Input
                id="rp-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-10 text-[13px] border-gray-200 focus-visible:border-indigo-400 focus-visible:ring-indigo-500/10"
              />
            </div>

            {error && <p className="text-[12px] text-red-500">{error}</p>}

            <Button
              className="w-full h-10 text-[13px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              onClick={handleReset}
              disabled={loading || !password || !confirm}
            >
              {loading && <Loader2 size={13} className="animate-spin mr-2" />}
              Set new password
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
