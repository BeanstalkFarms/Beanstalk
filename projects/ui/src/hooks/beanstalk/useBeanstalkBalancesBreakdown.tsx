import { useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { AddressMap, TokenMap, ZERO_BN } from '~/constants';
import { useAppSelector } from '~/state';
import { BeanstalkSiloBalance } from '~/state/beanstalk/silo';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import useUnripeUnderlyingMap from '~/hooks/beanstalk/useUnripeUnderlying';
import { UnripeToken } from '~/state/bean/unripe';
import useSiloTokenToFiat from './useSiloTokenToFiat';
import { useTokens, useWhitelistedTokens } from './useTokens';

// -----------------
// Types and Helpers
// -----------------

const colors = BeanstalkPalette.theme.winter;

export const STATE_CONFIG = {
  pooled: [
    'Pooled',
    colors.chart.purple,
    (name: string) =>
      `${name} in all liquidity pools. Does not include Beans that make up Ripe BEAN:3CRV.`,
  ],
  deposited: [
    'Deposited',
    colors.chart.yellow,
    (name: string) => `${name} that are Deposited in the Silo.`,
  ],
  // withdrawn: [
  //   'Claimable',
  //   colors.chart.yellowLight,
  //   (name: string) =>
  //     `Legacy Claimable ${name === 'Beans' ? 'Bean' : name} Withdrawals from before Silo V3.`,
  // ],
  farmable: [
    'Farm & Circulating',
    colors.chart.green,
    (name: string) =>
      `Farm ${name} are stored in Beanstalk. Circulating ${name} are in Farmers' wallets.`,
  ],
  budget: [
    'Budget',
    colors.chart.yellowLight,
    (name: string) =>
      `Circulating ${name} in the Beanstalk Farms and Bean Sprout multisig wallets.`,
  ],
  ripe: [
    'Ripe',
    colors.primary,
    (name: string) =>
      `${name} minted when Fertilizer is sold. Ripe ${name} are the ${name} underlying Unripe ${name}. ${
        name === 'Beans'
          ? 'Does not include Beans that make up Ripe BEANETH.'
          : ''
      }`,
  ],
  ripePooled: [
    'Ripe Pooled',
    colors.chart.primaryLight,
    (name: string) => `Pooled ${name} that make up Ripe BEANETH.`,
  ],
} as const;

export type StateID = keyof typeof STATE_CONFIG;
export const STATE_IDS = Object.keys(STATE_CONFIG) as StateID[];

export type SiloTokenState = {
  [state: string]: {
    /** USD value. */
    value: BigNumber | undefined;
    /** Token amount. */
    amount: BigNumber | undefined;
  };
};

// SiloStateBreakdown
export type SiloTokenBreakdown = {
  tokens: AddressMap<{
    amount: BigNumber;
    value: BigNumber;
    byState: SiloTokenState;
  }>;
};

const _initState = (
  tokenAddresses: string[],
  siloBalances: TokenMap<BeanstalkSiloBalance>
) =>
  tokenAddresses.reduce<SiloTokenBreakdown['tokens']>((prev, address) => {
    if (siloBalances && siloBalances[address]) {
      prev[address] = {
        value: ZERO_BN,
        amount: ZERO_BN,
        byState: STATE_IDS
          // Don't show every state for every token
          // .filter((state) => siloBalances[address][state] !== undefined)
          .reduce<SiloTokenState>((_prev, state) => {
            _prev[state] = {
              value: undefined,
              amount: undefined,
            };
            return _prev;
          }, {}),
      };
    }
    return prev;
  }, {}) as SiloTokenBreakdown['tokens'];

// -----------------
// Hooks
// -----------------

/**
 * Breakdown the state of Silo Tokens.
 *
 * For each Whitelisted token, we grab the amount and value
 * of that token for each of its states.
 *
 * A token's state can be:
 * - pooled
 * - deposited
 * - withdrawn & claimable
 * - farm & circulating
 * - ripe
 * - budget
 */
export default function useBeanstalkSiloBreakdown() {
  // Constants
  const { tokenMap: WHITELIST } = useWhitelistedTokens();
  const WHITELIST_ADDRS = useMemo(() => Object.keys(WHITELIST), [WHITELIST]);
  const { BEAN: Bean, BEAN_WSTETH_WELL_LP: BeanWstETH } = useTokens();
  //
  const siloBalances = useAppSelector((s) => s._beanstalk.silo.balances);
  const getUSD = useSiloTokenToFiat();

  const poolState = useAppSelector((s) => s._bean.pools);
  const beanSupply = useAppSelector((s) => s._bean.token.supply);
  const unripeTokenState = useAppSelector((s) => s._bean.unripe);
  const multisigBalances = useAppSelector(
    (s) => s._beanstalk.governance.multisigBalances
  );

  const unripeToRipe = useUnripeUnderlyingMap('unripe');
  const ripeToUnripe = useUnripeUnderlyingMap('ripe');

  return useMemo(
    () =>
      WHITELIST_ADDRS.reduce(
        (prev, address) => {
          const TOKEN = WHITELIST[address];
          const siloBalance = siloBalances[address];

          // Ensure we've loaded a Silo Balance for this token.
          if (siloBalance) {
            let ripe: undefined | BigNumber;
            let ripePooled: undefined | BigNumber;
            let budget: undefined | BigNumber;
            let pooled: undefined | BigNumber;
            let farmable: undefined | BigNumber;

            // Handle: Ripe Tokens (Add Ripe state to BEAN and BEAN:3CRV)
            if (ripeToUnripe[address]) {
              const unripeToken: undefined | UnripeToken =
                unripeTokenState[ripeToUnripe[address].address];
              if (unripeToken) ripe = unripeToken.underlying; // "ripe" is another word for "underlying"
            }

            /// Handle: Unripe Tokens
            if (unripeToRipe[address]) {
              const unripeToken = unripeTokenState[address];
              if (unripeToken) {
                farmable = unripeToken.supply.minus(
                  siloBalance.deposited.amount
                );
              }
            }

            // Handle: BEAN
            if (TOKEN.equals(Bean)) {
              /* budget = Object.values(multisigBalances).reduce(
                (_prev, curr) => _prev.plus(curr),
                ZERO_BN
              ); */
              // const pooled = Object.values(poolState).reduce((_prev, curr) => _prev.plus(curr.reserves[0]), ZERO_BN);
              const totalPooled = Object.values(poolState).reduce(
                (_prev, curr) => _prev.plus(curr.reserves[0]),
                ZERO_BN
              );

              // Ripe Pooled = BEAN:ETH_RESERVES * (Ripe BEAN:ETH / BEAN:ETH Token Supply)
              ripePooled = new BigNumber(totalPooled).multipliedBy(
                new BigNumber(
                  unripeTokenState[ripeToUnripe[BeanWstETH.address]?.address]
                    ?.underlying || 0
                ).div(new BigNumber(poolState[BeanWstETH.address]?.supply || 0))
              );
              // pooled = new BigNumber(totalPooled).minus(ripePooled);

              farmable = beanSupply
                // .minus(budget)
                .minus(totalPooled)
                .minus(ripe || ZERO_BN)
                .minus(siloBalance.deposited.amount);
            }

            // Handle: LP Tokens
            if (poolState[address]) {
              farmable = poolState[address].supply
                .minus(siloBalance.deposited.amount)
                .minus(ripe || ZERO_BN);
            }

            const amountByState = {
              deposited: siloBalance.deposited?.amount,
              pooled: pooled,
              ripePooled: ripePooled,
              ripe: ripe,
              budget: budget,
              farmable: farmable,
            };
            const usdValueByState = {
              deposited: getUSD(TOKEN, siloBalance.deposited.amount),
              pooled: pooled ? getUSD(TOKEN, pooled) : undefined,
              ripePooled: ripePooled ? getUSD(TOKEN, ripePooled) : undefined,
              ripe: ripe ? getUSD(TOKEN, ripe) : undefined,
              budget: budget ? getUSD(TOKEN, budget) : undefined,
              farmable: farmable ? getUSD(TOKEN, farmable) : undefined,
            };

            // Aggregate value of all states.
            prev.totalValue = prev.totalValue.plus(
              STATE_IDS.reduce(
                (p, c) => p.plus(usdValueByState[c] || ZERO_BN),
                ZERO_BN
              )
            );

            // Aggregate amounts of each Token
            prev.tokens[address].amount = prev.tokens[address].amount.plus(
              STATE_IDS.reduce(
                (p, c) => p.plus(amountByState[c] || ZERO_BN),
                ZERO_BN
              )
            );
            prev.tokens[address].value = prev.tokens[address].value.plus(
              STATE_IDS.reduce(
                (p, c) => p.plus(usdValueByState[c] || ZERO_BN),
                ZERO_BN
              )
            );

            // Aggregate amounts of each State
            STATE_IDS.forEach((s) => {
              if (amountByState[s] !== undefined) {
                prev.tokens[address].byState[s].value = (
                  prev.tokens[address].byState[s].value || ZERO_BN
                ).plus(usdValueByState[s] as BigNumber);
                prev.tokens[address].byState[s].amount = (
                  prev.tokens[address].byState[s].amount || ZERO_BN
                ).plus(amountByState[s] as BigNumber);
              }
            });
          }
          return prev;
        },
        {
          /** The total USD value of all tokens in the Silo. */
          totalValue: new BigNumber(0),
          /** */
          tokens: _initState(WHITELIST_ADDRS, siloBalances),
        }
      ),
    [
      WHITELIST_ADDRS,
      siloBalances,
      WHITELIST,
      ripeToUnripe,
      unripeToRipe,
      Bean,
      BeanWstETH,
      poolState,
      getUSD,
      unripeTokenState,
      beanSupply,
    ]
  );
}
