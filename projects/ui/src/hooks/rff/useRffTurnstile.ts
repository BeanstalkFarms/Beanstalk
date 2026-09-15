import { useCallback, useEffect, useRef } from 'react';
import { requestTurnstileToken } from '~/lib/Rff/turnstile';

export default function useRffTurnstile(siteKey?: string, enabled = true) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pending = useRef<AbortController>();
  useEffect(() => () => pending.current?.abort(), [enabled, siteKey]);

  const getToken = useCallback(async () => {
    if (!enabled || !containerRef.current)
      throw new Error('Open the request screen to verify your wallet.');
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    try {
      return await requestTurnstileToken(
        containerRef.current,
        siteKey || '',
        controller.signal
      );
    } finally {
      if (pending.current === controller) pending.current = undefined;
    }
  }, [enabled, siteKey]);

  return { containerRef, getToken };
}
