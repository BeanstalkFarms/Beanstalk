import { FarmFromMode } from '@beanstalk/sdk';

import BigNumber from 'bignumber.js';
import { useCallback } from 'react';
import { displayTokenAmount, getTokenIndex } from '~/util';
import useFarmerBalances from '../farmer/useFarmerBalances';
import { ZERO_BN } from '../../constants';
import { Balance } from '../../state/farmer/balances';
import { TokenInstance } from './useTokens';

// Define partial types to avoid clashing between sdk & UI token types
type TokenIsh = { address: string; symbol: string };
type TokenIshFormValues = { token: TokenIsh; amount: BigNumber | undefined };

export type IUseBalancesUsedBySource = {
  tokens: TokenIshFormValues[];
  mode: FarmFromMode;
};

export type AmountsBySource = {
  internal: BigNumber;
  external: BigNumber;
};

/**
 * @param amounts
 * @param token
 * @param betweenStr
 * @param ownerStr
 * @returns a string for internal & external if the amount is defined & gt 0 in the order of {amount} {betweenStr | ""} {owner} Farm/Circulating Balance
 */
export const displayAmountsBySource = (
  amounts: AmountsBySource,
  token: TokenInstance,
  between?: string, // inject a str between amounts and owner
  owner?: string // defaults to 'your'
) => {
  const middle = between ? ` ${between} ` : ' ';
  const ownerStr = owner || 'your';

  const internal = amounts.internal.gt(0)
    ? `${displayTokenAmount(amounts.internal, token, { showName: false, showSymbol: true })}${middle}from ${ownerStr} Farm Balance`
    : undefined;
  const external = amounts.external.gt(0)
    ? `${displayTokenAmount(amounts.external, token, { showName: false, showSymbol: true })}${middle}from ${ownerStr} Circulating Balance`
    : undefined;

  const combined = `${internal || ''}${internal && external ? ' and ' : ''}${external || ''}`;

  return {
    internal,
    external,
    combined,
  };
};

export default function useGetBalancesUsedBySource({
  tokens,
  mode,
}: IUseBalancesUsedBySource) {
  const balances = useFarmerBalances();

  const getBalancesUsedBySource = useCallback(() => {
    const bySource = tokens.reduce<AmountsBySource[]>((prev, curr) => {
      const tokenIndex = getTokenIndex(curr.token);
      const balance: Balance | null = balances[tokenIndex];
      const struct = { internal: ZERO_BN, external: ZERO_BN };
      const amount = curr.amount;

      if (
        !balance ||
        !balance.external ||
        !balance.internal ||
        !amount ||
        amount.lte(0)
      ) {
        prev.push(struct);
        return prev;
      }

      if (mode === FarmFromMode.EXTERNAL) {
        struct.external = amount;
      }
      if (mode === FarmFromMode.INTERNAL) {
        struct.internal = amount;
      }
      if (mode === FarmFromMode.INTERNAL_EXTERNAL) {
        if (balance.internal.gte(amount)) {
          struct.internal = amount;
        } else {
          // the amount the external balance has to cover.
          const amtLeft = amount.minus(balance.internal);

          struct.internal = balance.internal;
          // If the balance.external < amtLeft, the action cannot be performed.
          if (balance.external.gte(amtLeft)) {
            struct.external = amtLeft;
          } else {
            struct.external = balance.external;
          }
        }
      }

      prev.push(struct);
      return prev;
    }, []);

    return bySource;
  }, [tokens, balances, mode]);

  return [getBalancesUsedBySource] as const;
}
