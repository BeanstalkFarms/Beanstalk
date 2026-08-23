import { useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

import { rffApi } from '~/lib/Rff/runtime';
import {
  listRffRequestsForAccount,
} from '~/lib/Rff/session';
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
    queryFn: async () => {
      if (!account) return [];
      return listRffRequestsForAccount(rffApi, account);
    },
    enabled: enabled && !!account,
    retry: false,
    refetchInterval: 30_000,
  });
}

export function useRffTurnstile(siteKey?: string) {
  const containerNodeRef = useRef<HTMLDivElement | null>(null);
  const brokerRef = useRef<TurnstileTokenBroker | null>(null);
  const siteKeyRef = useRef(siteKey);
  siteKeyRef.current = siteKey;

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (containerNodeRef.current === node) return;
    brokerRef.current?.dispose();
    brokerRef.current = null;
    containerNodeRef.current = node;
  }, []);

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
      if (!containerNodeRef.current) {
        throw new Error('Request security is still loading.');
      }
      const container = containerNodeRef.current;
      const requestedSiteKey = siteKey;
      if (!brokerRef.current) {
        const api = await loadTurnstileApi();
        if (
          containerNodeRef.current !== container ||
          siteKeyRef.current !== requestedSiteKey
        ) {
          throw new Error('Request security was reset. Try again.');
        }
        if (!brokerRef.current) {
          brokerRef.current = new TurnstileTokenBroker(
            api,
            container,
            requestedSiteKey
          );
        }
      }
      return brokerRef.current.getToken(action);
    },
    [siteKey]
  );

  return { containerRef, getToken };
}
