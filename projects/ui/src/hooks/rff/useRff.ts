import { useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

import { rffApi } from '~/lib/Rff/runtime';
import { loadTurnstileApi, TurnstileTokenBroker } from '~/lib/Rff/turnstile';

export const rffQueryKeys = {
  config: ['rff', 'config'] as const,
  requests: (account?: string) => ['rff', 'requests', account] as const,
};

export function useRffConfig(enabled = true) {
  return useQuery({
    queryKey: rffQueryKeys.config,
    queryFn: () => rffApi.getConfig(),
    enabled,
    staleTime: 5 * 60 * 1_000,
    retry: 1,
  });
}

export function useRffRequests(account?: string, enabled = true) {
  return useQuery({
    queryKey: rffQueryKeys.requests(account),
    queryFn: () => rffApi.listRequests(),
    enabled: enabled && !!account,
    retry: false,
    refetchInterval: 30_000,
  });
}

export function useRffTurnstile(siteKey?: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const brokerRef = useRef<TurnstileTokenBroker | null>(null);

  useEffect(
    () => () => {
      brokerRef.current?.dispose();
      brokerRef.current = null;
    },
    [siteKey]
  );

  const getToken = useCallback(
    async (action: string) => {
      if (!siteKey) throw new Error('Request security is not configured.');
      if (!containerRef.current) {
        throw new Error('Request security is still loading.');
      }
      if (!brokerRef.current) {
        const api = await loadTurnstileApi();
        brokerRef.current = new TurnstileTokenBroker(
          api,
          containerRef.current,
          siteKey
        );
      }
      return brokerRef.current.getToken(action);
    },
    [siteKey]
  );

  return { containerRef, getToken };
}
