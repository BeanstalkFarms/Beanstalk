import { readCachedMigrationSource } from './events';

type RequestToken = {
  id: number;
  key: string;
};

export const createRequestScope = () => {
  let activeRequest: RequestToken | undefined;
  let nextId = 0;

  return {
    begin(key: string) {
      if (activeRequest?.key === key) return undefined;

      nextId += 1;
      activeRequest = { id: nextId, key };
      return activeRequest;
    },
    isCurrent(request: RequestToken) {
      return activeRequest === request;
    },
    finish(request: RequestToken) {
      if (activeRequest === request) activeRequest = undefined;
    },
  };
};

export const readStoredMigrationSource = (
  readStorage: () => string | null,
  receiver?: string
) => {
  try {
    return readCachedMigrationSource(readStorage(), receiver);
  } catch {
    return undefined;
  }
};

type MigrationFetcher = (
  input: string,
  init?: { signal?: AbortSignal }
) => Promise<{
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
}>;

type L2MigrationData = {
  deposits: unknown;
  fertilizer: unknown;
  plots: unknown;
  farmBalance: unknown;
};

export const fetchL2MigrationData = async (
  sourceAccount: string,
  signal?: AbortSignal,
  fetcher: MigrationFetcher = fetch
) => {
  const response = await fetcher(
    `/.netlify/functions/l2migration?account=${sourceAccount}`,
    { signal }
  );

  if (!response.ok) {
    throw new Error(`L2 migration API request failed with ${response.status}`);
  }

  return response.json() as Promise<L2MigrationData>;
};
