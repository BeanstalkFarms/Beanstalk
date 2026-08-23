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
    if (session.requester.toLowerCase() !== input.requester.toLowerCase()) {
      throw new Error('RFF session was created for a different wallet.');
    }
  }
}
