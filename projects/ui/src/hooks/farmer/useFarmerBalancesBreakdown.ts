import { useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { useSelector } from 'react-redux';
import { AddressMap, ZERO_BN } from '~/constants';
import { AppState } from '~/state';
import useSiloTokenToFiat from '../beanstalk/useSiloTokenToFiat';
import useWhitelist from '../beanstalk/useWhitelist';
import { BeanstalkPalette } from '~/components/App/muiTheme';

// -----------------
// Types and Helpers
// -----------------

export const STATE_CONFIG = {
  deposited: [
    'Deposited',
    BeanstalkPalette.logoGreen, 
    'Assets that are Deposited in the Silo.'
  ],
  withdrawn: [
    'Withdrawn',
    '#DFB385',
    'Assets being Withdrawn from the Silo. At the end of the current Season, Withdrawn assets become Claimable.'
  ],
  claimable: [
    'Claimable',
    '#ECBCB3',
    'Assets that can be Claimed after a Withdrawal.'
  ],
  farm: [
    'Farm',
    '#F2E797',
    'Assets stored in Beanstalk. Farm assets can be used in transactions on the Farm.'
  ],
  circulating: [
    'Circulating',
    BeanstalkPalette.lightBlue, 
    'Beanstalk assets in your wallet.'
  ],
} as const;

export type StateID = keyof typeof STATE_CONFIG;
export const STATE_IDS = Object.keys(STATE_CONFIG) as StateID[];

export type SiloStateBreakdown = {
  /**
   * The aggregate USD value of tokens in this State.
   * Ex. I have $100 Deposited.
   */
  value: BigNumber;
  /** 
   * A mapping of address => { amount, value } for Tokens in this State.
   * Ex. I have a Bean deposit: 0xBEAN => { amount: 100, value: 101 } if 1 BEAN = $1.01
   */
  byToken: AddressMap<{ amount: BigNumber, value: BigNumber }>;
}

const _initState = (tokenAddresses: string[]) => ({
  value: new BigNumber(0),
  byToken: tokenAddresses.reduce<SiloStateBreakdown['byToken']>(
    (prev, curr) => { 
      prev[curr] = {
        amount: new BigNumber(0),
        value: new BigNumber(0)
      };
      return prev;
    },
    {},
  ),
} as SiloStateBreakdown);

// -----------------
// Hooks
// -----------------

/**
 * Breakdown the state of Silo Tokens.
 * 
 * A "Token State" is the state of a whitelisted Silo Token
 * within Beanstalk. 
 *  
 *    (1)--[deposited => withdrawn => claimable]-->(2)
 *    (2)--[circulating <-> farm]-->(1)
 * 
 * First we break things down by state, then by type of token.
 */
export default function useFarmerBalancesBreakdown() {
  /// Constants
  const whitelist = useWhitelist();
  const whitelistAddrs = useMemo(() => Object.keys(whitelist), [whitelist]);

  /// Balances
  const siloBalances  = useSelector<AppState, AppState['_farmer']['silo']['balances']>((state) => state._farmer.silo.balances);
  const tokenBalances = useSelector<AppState, AppState['_farmer']['balances']>((state) => state._farmer.balances);

  /// Helpers
  const getUSD = useSiloTokenToFiat();

  return useMemo(() => {
    const prev = {
      totalValue:     ZERO_BN,
      states: {
        deposited:    _initState(whitelistAddrs),
        withdrawn:    _initState(whitelistAddrs),
        claimable:    _initState(whitelistAddrs),
        farm:         _initState(whitelistAddrs), // FIXME: not a Silo state
        circulating:  _initState(whitelistAddrs), // FIXME: not a Silo state
      }
    };

    /// Silo whitelist
    whitelistAddrs.forEach((address) => {
      const token        = whitelist[address];
      const siloBalance  = siloBalances[address];
      const tokenBalance = tokenBalances[address] || ZERO_BN;

      // Ensure we've loaded a Silo Balance for this token.
      if (siloBalance) {
        const amountByState = {
          deposited:   siloBalance.deposited?.amount,
          withdrawn:   siloBalance.withdrawn?.amount,
          claimable:   siloBalance.claimable?.amount,
          farm:        tokenBalance.internal,
          circulating: tokenBalance.external,
        };
        const usdValueByState = {
          deposited:   getUSD(token, siloBalance.deposited?.amount),
          withdrawn:   getUSD(token, siloBalance.withdrawn?.amount),
          claimable:   getUSD(token, siloBalance.claimable?.amount),
          farm:        getUSD(token, tokenBalance.internal),
          circulating: getUSD(token, tokenBalance.external),
        };

        // Aggregate value of all states.
        prev.totalValue = (
          prev.totalValue
            .plus(
              STATE_IDS.reduce((p, c) => p.plus(usdValueByState[c]), ZERO_BN)
            )
        );

        // Aggregate amounts of each State
        STATE_IDS.forEach((s) => {
          prev.states[s].value                   = prev.states[s].value.plus(usdValueByState[s]);
          prev.states[s].byToken[address].amount = prev.states[s].byToken[address].amount.plus(amountByState[s]);
          prev.states[s].byToken[address].value  = prev.states[s].byToken[address].value.plus(usdValueByState[s]);
        });
      }
    });

    return prev;
  },
  [
    whitelist,
    whitelistAddrs,
    siloBalances,
    tokenBalances,
    getUSD,
  ]);
}
