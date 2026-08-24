import { useQuery } from '@tanstack/react-query';

import { rffApi } from '~/lib/Rff/runtime';
import {
  listRffRequestsForAccount,
} from '~/lib/Rff/session';

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
