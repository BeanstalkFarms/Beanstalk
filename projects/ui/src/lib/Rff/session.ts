import type { Address, Hex } from 'viem';

import { RffApiError } from './client';

type SessionClient = {
  getSession: () => Promise<{ requester: Address }>;
  createSessionChallenge: (
    requester: Address,
    turnstileToken: string
  ) => Promise<{ challengeId: string; message: string; expiresAt: number }>;
  verifySession: (
    challengeId: string,
    signature: Hex
  ) => Promise<{ requester: Address; expiresAt: number }>;
};

export class RffSessionAccountMismatchError extends Error {
  constructor() {
    super('Verify the connected wallet to load its fill requests.');
    this.name = 'RffSessionAccountMismatchError';
  }
}

export function assertRffSessionRequester(
  expected: string,
  actual: string
): void {
  if (expected.toLowerCase() !== actual.toLowerCase()) {
    throw new RffSessionAccountMismatchError();
  }
}

export async function listRffRequestsForAccount<T>(
  client: {
    getSession: () => Promise<{ requester: Address }>;
    listRequests: () => Promise<T[]>;
  },
  account: string
): Promise<T[]> {
  const session = await client.getSession();
  assertRffSessionRequester(account, session.requester);
  return client.listRequests();
}

export class RffSessionManager {
  private readonly client: SessionClient;

  constructor(client: SessionClient) {
    this.client = client;
  }

  async ensureSession(input: {
    requester: Address;
    getToken: (action: string) => Promise<string>;
    signMessage: (message: string) => Promise<Hex>;
  }): Promise<void> {
    try {
      const session = await this.client.getSession();
      if (session.requester.toLowerCase() === input.requester.toLowerCase()) {
        return;
      }
    } catch (error) {
      if (!(error instanceof RffApiError) || error.status !== 401) throw error;
    }

    const token = await input.getToken('rff_session');
    const challenge = await this.client.createSessionChallenge(
      input.requester,
      token
    );
    const signature = await input.signMessage(challenge.message);
    const session = await this.client.verifySession(
      challenge.challengeId,
      signature
    );
    assertRffSessionRequester(input.requester, session.requester);
  }
}
