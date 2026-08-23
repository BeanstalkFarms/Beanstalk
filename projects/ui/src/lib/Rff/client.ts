import type { Address, Hex } from 'viem';

import type { BalanceMode, RffSwapRequest } from './request';

type Fetch = typeof fetch;
type FetchInit = Parameters<Fetch>[1];

export class RffApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'RffApiError';
  }
}

export type RffQuote = {
  amountOut: bigint;
  reserveBean: bigint;
  reserveWsteth: bigint;
  blockNumber: bigint;
  expiresAt: number;
};

export type CreateRffRequestResponse = {
  requestId: Hex;
  estimatedAmountIn: bigint;
  created: boolean;
};

export type RffRuntimeConfig = {
  chainId: number;
  safeAddress: Address;
  beanAddress: Address;
  wstethAddress: Address;
  turnstileSiteKey: string;
};

export type RffRequestStatus =
  | 'OPEN'
  | 'LOCKED'
  | 'SAFE_PROPOSED'
  | 'EXECUTED'
  | 'CANCELLED'
  | 'EXPIRED';

export type RffRequestRecord = RffSwapRequest & {
  id: Hex;
  signature: Hex;
  status: RffRequestStatus;
  lockedBy: string | null;
  lockedAt: number | null;
  safeTxHash: Hex | null;
  actualAmountIn: bigint | null;
  actualAmountOut: bigint | null;
  scaledMinAmountOut: bigint | null;
  quoteBlock: bigint | null;
  executedTxHash: Hex | null;
  createdAt: number;
  updatedAt: number;
};

function integer(value: unknown, field: string): bigint {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(`RFF service returned an invalid ${field}`);
  }
  return BigInt(value);
}

function nullableInteger(value: unknown, field: string): bigint | null {
  return value === null ? null : integer(value, field);
}

export class RffApiClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly fetchImpl: Fetch = fetch
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(path: string, init?: FetchInit): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
    const body = (await response.json()) as T & { error?: unknown };
    if (!response.ok) {
      throw new RffApiError(
        typeof body.error === 'string'
          ? body.error
          : 'RFF service request failed',
        response.status
      );
    }
    return body;
  }

  getConfig(): Promise<RffRuntimeConfig> {
    return this.request('/v1/config');
  }

  createSessionChallenge(
    requester: Address,
    turnstileToken: string
  ): Promise<{ challengeId: string; message: string; expiresAt: number }> {
    return this.request('/v1/session/challenge', {
      method: 'POST',
      body: JSON.stringify({ requester, turnstileToken }),
    });
  }

  verifySession(
    challengeId: string,
    signature: Hex
  ): Promise<{ requester: Address; expiresAt: number }> {
    return this.request('/v1/session/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeId, signature }),
    });
  }

  async getQuote(
    tokenIn: Address,
    tokenOut: Address,
    amountIn: bigint,
    turnstileToken: string
  ): Promise<RffQuote> {
    const response = await this.request<{
      amountOut: string;
      reserveBean: string;
      reserveWsteth: string;
      blockNumber: string;
      expiresAt: number;
    }>('/v1/quote', {
      method: 'POST',
      body: JSON.stringify({
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        turnstileToken,
      }),
    });

    return {
      amountOut: integer(response.amountOut, 'amountOut'),
      reserveBean: integer(response.reserveBean, 'reserveBean'),
      reserveWsteth: integer(response.reserveWsteth, 'reserveWsteth'),
      blockNumber: integer(response.blockNumber, 'blockNumber'),
      expiresAt: response.expiresAt,
    };
  }

  async createRequest(
    request: RffSwapRequest,
    signature: Hex,
    turnstileToken: string
  ): Promise<CreateRffRequestResponse> {
    const response = await this.request<{
      requestId: Hex;
      estimatedAmountIn: string;
      created: boolean;
    }>('/v1/requests', {
      method: 'POST',
      body: JSON.stringify({
        request: {
          ...request,
          requestedAmountIn: request.requestedAmountIn.toString(),
          minAmountOutAtRequestedIn:
            request.minAmountOutAtRequestedIn.toString(),
          nonce: request.nonce.toString(),
          deadline: request.deadline.toString(),
        },
        signature,
        turnstileToken,
      }),
    });

    return {
      ...response,
      estimatedAmountIn: integer(
        response.estimatedAmountIn,
        'estimatedAmountIn'
      ),
    };
  }

  async listRequests(): Promise<RffRequestRecord[]> {
    const response = await this.request<{
      requests: Array<
        Omit<
          RffRequestRecord,
          | 'requestedAmountIn'
          | 'minAmountOutAtRequestedIn'
          | 'nonce'
          | 'deadline'
          | 'actualAmountIn'
          | 'actualAmountOut'
          | 'scaledMinAmountOut'
          | 'quoteBlock'
        > & {
          requestedAmountIn: string;
          minAmountOutAtRequestedIn: string;
          nonce: string;
          deadline: string;
          sourceMode: BalanceMode;
          actualAmountIn: string | null;
          actualAmountOut: string | null;
          scaledMinAmountOut: string | null;
          quoteBlock: string | null;
        }
      >;
    }>('/v1/requests');

    return response.requests.map((request) => ({
      ...request,
      requestedAmountIn: integer(
        request.requestedAmountIn,
        'requestedAmountIn'
      ),
      minAmountOutAtRequestedIn: integer(
        request.minAmountOutAtRequestedIn,
        'minAmountOutAtRequestedIn'
      ),
      nonce: integer(request.nonce, 'nonce'),
      deadline: integer(request.deadline, 'deadline'),
      actualAmountIn: nullableInteger(request.actualAmountIn, 'actualAmountIn'),
      actualAmountOut: nullableInteger(
        request.actualAmountOut,
        'actualAmountOut'
      ),
      scaledMinAmountOut: nullableInteger(
        request.scaledMinAmountOut,
        'scaledMinAmountOut'
      ),
      quoteBlock: nullableInteger(request.quoteBlock, 'quoteBlock'),
    }));
  }

  cancelRequest(
    requestId: Hex,
    deadline: bigint,
    signature: Hex
  ): Promise<{ requestId: Hex; status: 'CANCELLED' }> {
    return this.request(`/v1/requests/${requestId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ deadline: deadline.toString(), signature }),
    });
  }
}
