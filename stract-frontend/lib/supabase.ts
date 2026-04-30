import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@/types';

export const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const meta = user.user_metadata as Record<string, string | undefined>;
  const identities = user.identities ?? [];
  const provider = identities.some((i) => i.provider === 'google') ? 'google' : 'email';
  return {
    id: user.id,
    email: user.email ?? '',
    name: meta?.full_name ?? null,
    avatar_url: meta?.avatar_url ?? null,
    provider,
  };
}
