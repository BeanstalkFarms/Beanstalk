// @vitest-environment jsdom
import React from 'react';
import BigNumber from 'bignumber.js';
import { TokenValue } from '@beanstalk/sdk';
import { ThemeProvider } from '@mui/material/styles';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { vi } from 'vitest';
import theme from '~/components/App/muiTheme';
import { BEAN_ADDRESS, WSTETH_ADDRESS } from '~/lib/Rff/request';
import { RffApiError } from '~/lib/Rff/client';
import RffRequestDialog from './RffRequestDialog';

const account = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const token = (address: string, symbol: string, decimals: number) => ({
  address,
  symbol,
  decimals,
  displayDecimals: 6,
  equals: (other: { address: string }) => other.address === address,
  fromHuman: (amount: string) => TokenValue.fromHuman(amount, decimals),
  fromBlockchain: (amount: bigint) =>
    TokenValue.fromBlockchain(amount.toString(), decimals),
});
const sdk = {
  tokens: {
    BEAN: token(BEAN_ADDRESS, 'BEAN', 6),
    WSTETH: token(WSTETH_ADDRESS, 'wstETH', 18),
  },
};
const events: string[] = [];
let failOracle = false;
let failVerification = false;
const createRequest = vi.fn(async () => {
  events.push('create');
  return { requestId: '0x1234' };
});
const signer = {
  signMessage: async () => {
    events.push('sign-session');
    return '0x1234';
  },
  _signTypedData: async () => {
    events.push('sign-request');
    return '0x5678';
  },
};
const api = {
  getSession: async () => {
    events.push('session');
    throw new RffApiError('Authentication required', 401);
  },
  createSessionChallenge: async (_account: string, token: string) => {
    events.push(`challenge:${token}`);
    return {
      challengeId: 'challenge',
      message: 'Authenticate',
      expiresAt: 2_000_000_000,
    };
  },
  verifySession: async () => {
    events.push('verify-session');
    return { requester: account };
  },
  createRequest,
};
vi.mock('~/hooks/sdk', () => ({ default: () => sdk }));
vi.mock('~/hooks/ledger/useAccount', () => ({ default: () => account }));
vi.mock('~/hooks/ledger/useSigner', () => ({
  useSigner: () => ({ data: signer }),
}));
vi.mock('wagmi', () => ({
  useAccount: () => ({ chainId: 42161 }),
  useSwitchChain: () => ({}),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('~/hooks/farmer/useFarmerBalances', () => ({
  default: () => ({
    [BEAN_ADDRESS]: {
      external: new BigNumber(10),
      internal: new BigNumber(0),
      total: new BigNumber(10),
    },
  }),
}));
vi.mock('~/hooks/rff/useRffApproval', () => ({
  default: () => ({ isApproved: true, isCorrectChain: true }),
}));
vi.mock('~/hooks/rff/useRff', () => ({
  useRffConfig: () => ({
    data: {
      chainId: 42161,
      safeAddress: '0x1111111111111111111111111111111111111111',
      turnstileSiteKey: 'key',
    },
  }),
  rffQueryKeys: { requests: () => ['requests'] },
}));
vi.mock('~/hooks/rff/useRffTurnstile', () => ({
  default: () => ({
    containerRef: { current: null },
    getToken: async () => {
      if (failVerification)
        throw new Error(
          'Unable to load verification. Check your connection or content blocker and try again.'
        );
      const token = `token-${events.filter((e) => e.startsWith('token-')).length + 1}`;
      events.push(token);
      return token;
    },
  }),
}));
vi.mock('~/lib/Rff/runtime', () => ({
  get rffApi() {
    return api;
  },
}));
vi.mock('~/lib/Rff/oracle', () => ({
  fetchInstantTokenUsdPrices: async () => {
    if (failOracle)
      throw new Error('Price unavailable for BEAN. Please try again.');
    return [new BigNumber('0.25'), new BigNumber('2500')];
  },
}));
vi.mock('~/components/Common/Dialog', () => ({
  StyledDialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  StyledDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  StyledDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock('~/components/Common/Form/TokenSelectDialog', () => ({
  TokenSelectMode: { SINGLE: 'single' },
}));
vi.mock('~/components/Common/Form/BalanceFromRow', () => ({
  BalanceFrom: { EXTERNAL: 'external', INTERNAL: 'internal' },
}));
vi.mock('~/components/Common/Form', () => ({
  TokenAdornment: () => null,
  TokenSelectDialog: () => null,
}));
vi.mock('~/components/Common/Connection/WalletButton', () => ({
  default: () => null,
}));
vi.mock('./RffRequestInfo', () => ({
  default: () => null,
  RffMinimumReceivedLabel: () => <span>Minimum received</span>,
}));
vi.mock('~/util', () => ({
  getTokenIndex: (t: { address: string }) => t.address,
  displayFullBN: (n: BigNumber) => n.toString(),
}));

beforeEach(() => {
  events.length = 0;
  failOracle = false;
  failVerification = false;
  createRequest.mockClear();
});
afterEach(cleanup);
function openDialog() {
  render(
    <ThemeProvider theme={theme}>
      <RffRequestDialog
        open
        onClose={vi.fn()}
        announcementUrl="https://bean.money"
      />
    </ThemeProvider>
  );
  fireEvent.change(screen.getByPlaceholderText('0'), {
    target: { value: '1' },
  });
}
it('authenticates before submission and uses a new token after signing the request', async () => {
  openDialog();
  const submit = screen.getByRole('button', {
    name: 'Request for Fill',
  }) as HTMLButtonElement;
  await waitFor(() => expect(submit.disabled).toBe(false));
  fireEvent.click(submit);
  await screen.findByText('Request submitted');
  expect(events).toEqual([
    'session',
    'token-1',
    'challenge:token-1',
    'sign-session',
    'verify-session',
    'sign-request',
    'token-2',
    'create',
  ]);
  expect(createRequest).toHaveBeenCalledWith(
    expect.objectContaining({ requestedAmountIn: 1_000_000n }),
    '0x5678',
    'token-2'
  );
});
it('shows an unavailable-price error and stops the estimate spinner', async () => {
  failOracle = true;
  openDialog();
  await screen.findByText('Price unavailable for BEAN. Please try again.');
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(
    (
      screen.getByRole('button', {
        name: 'Request for Fill',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  expect(createRequest).not.toHaveBeenCalled();
});

it('preserves actionable verification errors and does not submit', async () => {
  failVerification = true;
  openDialog();
  const submit = screen.getByRole('button', {
    name: 'Request for Fill',
  }) as HTMLButtonElement;
  await waitFor(() => expect(submit.disabled).toBe(false));
  fireEvent.click(submit);
  await screen.findByText(
    'Unable to load verification. Check your connection or content blocker and try again.'
  );
  expect(createRequest).not.toHaveBeenCalled();
  expect(submit.disabled).toBe(false);
});
