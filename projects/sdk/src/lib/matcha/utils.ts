import Bottleneck from "bottleneck";

export interface RequestWithId<T> {
  id: string;
  request: () => Promise<T>;
}

export interface FetchWithLimiterOptions {
  allowFailure?: boolean;
}

interface FetchWithLimiterError {
  id: string;
  error: any;
  status: "failure";
}

interface FetchWithLimiterSuccess<T> {
  id: string;
  result: T;
  status: "success";
}

export type FetchWithLimiterResult<T> = FetchWithLimiterSuccess<T> | FetchWithLimiterError;

export async function fetchWithBottleneckLimiter<T>(
  limiter: Bottleneck,
  requests: RequestWithId<T>[],
  options?: FetchWithLimiterOptions
) {
  const allowFailure = options?.allowFailure ?? false;

  const scheduledRequests = requests.map<Promise<FetchWithLimiterResult<T>>>(({ id, request }) =>
    // Schedule the request with the limiter and assign the id
    limiter.schedule({ id }, request).then(
      (result) => ({ id, result, status: "success" }),
      (error) => {
        return { id, error, status: "failure" };
      }
    )
  );

  // Wait for all the scheduled requests to complete
  const results = await Promise.all(scheduledRequests);

  // Process results
  const finalResults: T[] = [];
  const errors: Array<{ id: string | number; error: any }> = [];

  for (const res of results) {
    if (res.status === "failure") {
      errors.push({ id: res.id, error: res.error });
    } else {
      finalResults.push(res.result);
    }
  }

  if (errors.length > 0) {
    console.error("Some requests failed:", errors);
    if (allowFailure === false) {
      throw new Error("Swap requests failed. Check console for details.");
    }
  }

  return finalResults;
}

export function isRateLimitError(error: any) {
  if ("message" in error && typeof error.message === "string") {
    return error.message.toLowerCase().includes("rate limit");
  }
  return false;
}
