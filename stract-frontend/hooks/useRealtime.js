'use client';

import { useEffect, useRef } from 'react';

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}

const SSE_URL = 'http://localhost:8080/api/v1/stream';
const RECONNECT_DELAY = 3000;
const TRANSIENT_THRESHOLD = 5000; // don't toast errors under 5s

/**
 * useRealtime - subscribes to the SSE stream and calls onEvent for each message.
 * Reconnects silently on transient disconnects (< 5s).
 *
 * @param {(event: object) => void} onEvent
 * @param {React.MutableRefObject<boolean>} mutationInFlightRef
 *   Pass a ref that your mutation handlers set to true while a request is in-flight.
 *   Events triggered by the current tab will not cause a refetch when this is true.
 */
export function useRealtime(onEvent, mutationInFlightRef) {
  const esRef = useRef(null);
  const disconnectTimeRef = useRef(null);

  useEffect(() => {
    let reconnectTimer = null;

    function connect() {
      const token = getToken();
      if (!token) return; // no token yet, skip

      const url = `${SSE_URL}?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          const isSelf = mutationInFlightRef?.current === true;
          onEvent(event, isSelf);
        } catch {
          // malformed payload — ignore
        }
      };

      es.onopen = () => {
        disconnectTimeRef.current = null; // reset disconnect timer on reconnect
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;

        if (!disconnectTimeRef.current) {
          disconnectTimeRef.current = Date.now();
        }

        // Try to reconnect silently
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
      };
    }

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
