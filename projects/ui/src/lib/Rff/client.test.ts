import { describe, expect, it } from 'vitest';

import { RffApiClient, RffApiError } from './client';
import { BalanceMode, BEAN_ADDRESS, WSTETH_ADDRESS } from './request';

const REQUEST = {
  requester: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  recipient: '0x2222222222222222222222222222222222222222',
  tokenIn: BEAN_ADDRESS,
  tokenOut: WSTETH_ADDRESS,
  requestedAmountIn: 1_000_000n,
  minAmountOutAtRequestedIn: 300_000_000_000_000n,
  sourceMode: BalanceMode.EXTERNAL,
  destinationMode: BalanceMode.EXTERNAL,
  nonce: 12_345n,
  deadline: 2_000_000_000n,
} as const;

describe('RFF API client', () => {
  it('loads the public runtime contract configuration', async () => {
    const client = new RffApiClient('https://rff.bean.money', async () =>
      Response.json({
        chainId: 42161,
        safeAddress: '0x1111111111111111111111111111111111111111',
        beanAddress: BEAN_ADDRESS,
        wstethAddress: WSTETH_ADDRESS,
        turnstileSiteKey: '0x4AAAA-test',
      })
    );

    await expect(client.getConfig()).resolves.toEqual({
      chainId: 42161,
      safeAddress: '0x1111111111111111111111111111111111111111',
      beanAddress: BEAN_ADDRESS,
      wstethAddress: WSTETH_ADDRESS,
      turnstileSiteKey: '0x4AAAA-test',
    });
  });

  it('creates and verifies a wallet session using the service challenge', async () => {
    const captured: Request[] = [];
    const responses = [
      Response.json({
        challengeId: '0x1234',
        message: 'Beanstalk RFF authentication\nAddress: 0xf39F...',
        expiresAt: 1_800_000_300,
      }),
      Response.json({
        requester: REQUEST.requester,
        expiresAt: 1_800_003_600,
      }),
    ];
    const client = new RffApiClient(
      'https://rff.bean.money',
      async (input, init) => {
        captured.push(new Request(input, init));
        return responses.shift()!;
      }
    );

    const challenge = await client.createSessionChallenge(
      REQUEST.requester,
      'turnstile-token'
    );
    await client.verifySession(challenge.challengeId, '0x1234');

    expect(JSON.parse(await captured[0]!.text())).toEqual({
      requester: REQUEST.requester,
      turnstileToken: 'turnstile-token',
    });
    expect(JSON.parse(await captured[1]!.text())).toEqual({
      challengeId: '0x1234',
      signature: '0x1234',
    });
  });

  it('reads the wallet attached to the active opaque session', async () => {
    const client = new RffApiClient('https://rff.bean.money', async () =>
      Response.json({ requester: REQUEST.requester.toLowerCase() })
    );

    await expect(client.getSession()).resolves.toEqual({
      requester: REQUEST.requester.toLowerCase(),
    });
  });

  it('submits decimal-string integers with credentialed browser requests', async () => {
    let captured: Request | undefined;
    const client = new RffApiClient(
      'https://rff.bean.money',
      async (input, init) => {
        captured = new Request(input, init);
        return Response.json(
          {
            requestId:
              '0xf4407ae307bc07d1f2ae1bcdd562c29366041352dac7654c5ccbb591b1476b23',
            estimatedAmountIn: '750000',
            created: true,
          },
          { status: 201 }
        );
      }
    );

    const response = await client.createRequest(
      REQUEST,
      '0x1234',
      'turnstile-token'
    );
    const payload = JSON.parse(await captured!.text());

    expect(captured!.url).toBe('https://rff.bean.money/v1/requests');
    expect(captured!.credentials).toBe('include');
    expect(payload.request.requestedAmountIn).toBe('1000000');
    expect(payload.request.minAmountOutAtRequestedIn).toBe('300000000000000');
    expect(payload.request.nonce).toBe('12345');
    expect(payload.request.deadline).toBe('2000000000');
    expect(response.estimatedAmountIn).toBe(750_000n);
  });

  it('parses quote integer fields without losing precision', async () => {
    const client = new RffApiClient('https://rff.bean.money/', async () =>
      Response.json({
        amountOut: '123456789012345678901234',
        reserveBean: '9000000000000',
        reserveWsteth: '321000000000000000000',
        blockNumber: '285000001',
        expiresAt: 1_800_000_030,
      })
    );

    const quote = await client.getQuote(
      BEAN_ADDRESS,
      WSTETH_ADDRESS,
      1_000_000n,
      'turnstile-token'
    );

    expect(quote.amountOut).toBe(123_456_789_012_345_678_901_234n);
    expect(quote.blockNumber).toBe(285_000_001n);
    expect(quote.expiresAt).toBe(1_800_000_030);
  });

  it('surfaces the service error and status for an actionable UI message', async () => {
    const client = new RffApiClient('https://rff.bean.money', async () =>
      Response.json({ error: 'Authentication required' }, { status: 401 })
    );

    await expect(client.listRequests()).rejects.toMatchObject({
      name: 'RffApiError',
      message: 'Authentication required',
      status: 401,
    } satisfies Partial<RffApiError>);
  });

  it('parses request records and preserves nullable execution fields', async () => {
    const client = new RffApiClient('https://rff.bean.money', async () =>
      Response.json({
        requests: [
          {
            id: '0xf4407ae307bc07d1f2ae1bcdd562c29366041352dac7654c5ccbb591b1476b23',
            ...REQUEST,
            requestedAmountIn: '1000000',
            minAmountOutAtRequestedIn: '300000000000000',
            nonce: '12345',
            deadline: '2000000000',
            signature: '0x1234',
            status: 'OPEN',
            lockedBy: null,
            lockedAt: null,
            safeTxHash: null,
            actualAmountIn: null,
            actualAmountOut: null,
            scaledMinAmountOut: null,
            quoteBlock: null,
            executedTxHash: null,
            createdAt: 1_700_000_000,
            updatedAt: 1_700_000_000,
          },
        ],
      })
    );

    const [request] = await client.listRequests();

    expect(request.requestedAmountIn).toBe(1_000_000n);
    expect(request.actualAmountIn).toBeNull();
    expect(request.deadline).toBe(2_000_000_000n);
    expect(request.status).toBe('OPEN');
  });

  it('submits a signed cancellation deadline as a decimal string', async () => {
    let captured: Request | undefined;
    const client = new RffApiClient(
      'https://rff.bean.money',
      async (input, init) => {
        captured = new Request(input, init);
        return Response.json({ requestId: '0xabc', status: 'CANCELLED' });
      }
    );

    await client.cancelRequest('0xabc', 2_000_000_300n, '0x1234');

    expect(captured!.url).toBe(
      'https://rff.bean.money/v1/requests/0xabc/cancel'
    );
    expect(JSON.parse(await captured!.text())).toEqual({
      deadline: '2000000300',
      signature: '0x1234',
    });
  });
});
