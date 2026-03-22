import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { API_BASE } from '@/lib/api';

type RealtimeEvent = {
  action: 'created' | 'moved' | 'deleted' | 'updated' | 'comment';
  task_id: string;
  task_title: string;
  user_id: string;
  from: string;
  to: string;
  ts: string;
};

export function useRealtime(
  onEvent: (event: RealtimeEvent, isSelf: boolean) => void,
  mutationInFlightRef?: React.RefObject<boolean>
): void {
  useEffect(() => {
    let es: EventSource | null = null;
    let ignore = false;

    const connect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || ignore) return;

      const token = session.access_token;
      const url = `${API_BASE}/stream?token=${encodeURIComponent(token)}`;
      es = new EventSource(url);

      es.onmessage = (e: MessageEvent) => {
        try {
          const event: RealtimeEvent = JSON.parse(e.data as string);
          const isSelf = mutationInFlightRef?.current || false;
          onEvent(event, isSelf);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          console.error('[SSE] parse/callback error:', message, e.data);
        }
      };

      es.onerror = (err: Event) => {
        console.error('[SSE] connection error:', err);
      };
    };

    connect();

    return () => {
      ignore = true;
      if (es) {
        es.close();
      }
    };
  }, [onEvent, mutationInFlightRef]);
}
