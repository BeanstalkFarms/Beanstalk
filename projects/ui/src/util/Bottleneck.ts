import Bottleneck from 'bottleneck';

export interface BottleneckOptions {
  /**
   * Number of requests allow per interval
   * @defaults to 5
   */
  reservoir?: number;
  /**
   * Interval at which the reservoir is refreshed
   * @defaults to 750ms. If all other options are kept, this will allow roughly 6-7 requests / interval (1 second)
   */
  reservoirRefreshInterval?: number;
  /**
   * Number of requests to refresh the reservoir by
   * @defaults 5 requests / interval
   */
  reservoirRefreshAmount?: number;
  /**
   * Maximum number of concurrent requests
   * @defaults to 5
   */
  maxConcurrent?: number;
  /**
   * Minimum time between requests
   * @defaults 100ms
   */
  minTime?: number;
  /**
   * The number of milliseconds to retry after failure
   */
  retryAfter?: number;
  /**
   * Maximum number of retries per request
   */
  maxRetries?: number;
}

export interface RequestWithId<T> {
  id: string;
  request: () => Promise<T>;
}

export interface AwaitedRequestResult<T> {
  id: string;
  result: T;
}

const DEFAULT_BOTTLENECK_OPTIONS: BottleneckOptions = {
  reservoir: 4,
  reservoirRefreshInterval: 500,
  reservoirRefreshAmount: 4,
  maxConcurrent: 4,
  minTime: 100,
};

/**
 * Creates a Bottleneck rate limiter instance.
 *
 * Bottleneck is used to limit the number of concurrent requests to a resource,
 * spacing out concurrent requests over a given interval.
 *
 * retries are not automatically implemented.
 *
 * @see https://github.com/SGrondin/bottleneck
 */
export function createBottleneck(options?: BottleneckOptions) {
  const limiter = new Bottleneck({
    ...DEFAULT_BOTTLENECK_OPTIONS,
    ...options,
  });

  return limiter;
}

export interface FetchWithBottleneckLimiterOptions {
  throws?: boolean;
  partialData?: boolean;
  errorMessage?: string;
}

export async function fetchWithBottleneckLimiter<T>(
  limiter: Bottleneck,
  requests: Array<RequestWithId<T>>,
  options?: FetchWithBottleneckLimiterOptions
): Promise<T[]> {
  // Schedule all the requests at once, assigning the id
  const scheduledPromises = requests.map(({ id, request }) =>
    // Schedule the request with the limiter and assign the id
    limiter.schedule({ id }, request).then(
      (result) => ({ id, result }),
      (error) => {
        // Handle failure
        error.requestId = id;
        if (!isRateLimitError(error)) {
          console.debug(`[Request ${id} failed]:`, error);
          // Instead of throwing, return an object indicating the error
          return { id, error };
        }
        // For rate limit errors, Bottleneck retries, so we might not reach here
        return { id, error };
      }
    )
  );

  // Wait for all the scheduled requests to complete
  const results = await Promise.all(scheduledPromises);

  // Process results
  const finalResults: T[] = [];
  const errors: Array<{ id: string | number; error: any }> = [];

  for (const res of results) {
    if ('error' in res) {
      // Collect the error
      errors.push({ id: res.id, error: res.error });
    } else {
      finalResults.push(res.result);
    }
  }

  const throws = options?.throws ?? true;
  const partialData = options?.partialData ?? false;

  if (errors.length > 0) {
    console.error('Some requests failed:', errors);
    if (throws) {
      throw new Error(options?.errorMessage ?? 'Requests failed');
    }
    if (partialData) {
      return finalResults;
    }
    return [] as T[];
  }

  return finalResults;
}

const RETRY_AFTER_MS = 500;

const zeroXLimiter = createBottleneck({
  retryAfter: RETRY_AFTER_MS,
  maxRetries: 3,
});

zeroXLimiter.on('failed', (error) => {
  if (isRateLimitError(error)) {
    console.debug('[0x quote failed]: ... retrying id: ', error.requestId);
    return RETRY_AFTER_MS; // retry after 500ms
  }

  // non rate limit errors are not retried
  return null;
});

zeroXLimiter.on('retry', (error, info) => {
  if (isRateLimitError(error)) {
    console.debug('[0x quote retry]: ... retrying...', info);
  }
});

export async function fetch0xWithLimiter<T>(requests: Array<RequestWithId<T>>) {
  return fetchWithBottleneckLimiter(zeroXLimiter, requests);
}

function isRateLimitError(error: any) {
  if ('message' in error && typeof error.message === 'string') {
    return error.message?.toLowerCase().includes('rate limit');
  }
  return false;
}

/**
 *
 * max 25 requests / 250ms
 * 10ms between requests
 */
const apolloLimiter = new Bottleneck({
  reservoir: 50,
  reservoirRefreshAmount: 50,
  reservoirRefreshInterval: 250,
  maxConcurrent: 50,
  minTime: 5,
});

apolloLimiter.on('failed', (error, info) => {
  if (info.retryCount < 8) {
    console.debug('[Apollo Limiter] retrying', info, error);
    return 50;
  }
  console.debug('[Apollo Limiter] too many retries, giving up', info, error);
  return null;
});

export async function fetchApolloWithLimiter<T>(
  requests: Array<RequestWithId<T>>,
  options?: FetchWithBottleneckLimiterOptions
) {
  return fetchWithBottleneckLimiter(apolloLimiter, requests, options);
}
