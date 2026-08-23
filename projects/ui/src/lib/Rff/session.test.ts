import { describe, expect, it } from 'vitest';
import type { Address } from 'viem';

import { RffApiError } from './client';
import {
  assertRffSessionRequester,
  listRffRequestsForAccount,
  RffSessionAccountMismatchError,
  RffSessionManager,
} from './session';

const REQUESTER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

describe('RFF wallet session manager', () => {
  it('rejects a cookie session belonging to a different connected wallet', () => {
    expect(() =>
      assertRffSessionRequester(
        REQUESTER,
        '0x2222222222222222222222222222222222222222'
      )
    ).toThrow(RffSessionAccountMismatchError);
  });

  it('does not load private requests from another wallet session', async () => {
    let listed = false;
    await expect(
      listRffRequestsForAccount(
        {
          getSession: async () => ({
            requester:
              '0x2222222222222222222222222222222222222222' as Address,
          }),
          listRequests: async () => {
            listed = true;
            return ['private-request'];
          },
        },
        REQUESTER
      )
    ).rejects.toThrow(RffSessionAccountMismatchError);
    expect(listed).toBe(false);
  });

  it('reuses a session already attached to the connected wallet', async () => {
    const events: string[] = [];
    const manager = new RffSessionManager({
      getSession: async () => ({
        requester: REQUESTER.toLowerCase() as Address,
      }),
      createSessionChallenge: async () => {
        events.push('challenge');
        throw new Error('must not challenge');
      },
      verifySession: async () => {
        events.push('verify');
        throw new Error('must not verify');
      },
    });

    await manager.ensureSession({
      requester: REQUESTER,
      getToken: async () => {
        events.push('turnstile');
        return 'unused';
      },
      signMessage: async () => {
        events.push('sign');
        return '0x1234';
      },
    });

    expect(events).toEqual([]);
  });

  it('authenticates an expired session before request submission', async () => {
    const events: string[] = [];
    const manager = new RffSessionManager({
      getSession: async () => {
        events.push('check');
        throw new RffApiError('Authentication required', 401);
      },
      createSessionChallenge: async (requester, token) => {
        events.push(`challenge:${requester}:${token}`);
        return {
          challengeId: 'challenge-id',
          message: 'Beanstalk RFF authentication',
          expiresAt: 1_800_000_300,
        };
      },
      verifySession: async (challengeId, signature) => {
        events.push(`verify:${challengeId}:${signature}`);
        return { requester: REQUESTER, expiresAt: 1_800_003_600 };
      },
    });

    await manager.ensureSession({
      requester: REQUESTER,
      getToken: async (action) => {
        events.push(`turnstile:${action}`);
        return 'fresh-token';
      },
      signMessage: async (message) => {
        events.push(`sign:${message}`);
        return '0x1234';
      },
    });

    expect(events).toEqual([
      'check',
      'turnstile:rff_session',
      `challenge:${REQUESTER}:fresh-token`,
      'sign:Beanstalk RFF authentication',
      'verify:challenge-id:0x1234',
    ]);
  });
});
