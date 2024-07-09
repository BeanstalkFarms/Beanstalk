import { FarmFromMode } from '@beanstalk/sdk';

import BigNumber from 'bignumber.js';
import { useEffect, useState } from 'react';
import copy from '~/constants/copy';
import useFarmerBalances from '../farmer/useFarmerBalances';
import { ZERO_BN } from '../../constants';
import { Balance } from '../../state/farmer/balances';

export type IUseBalancesUsedBySource = {
  tokenAddress: string;
  amount: BigNumber | undefined;
  mode: FarmFromMode;
};

export type BalanceBySource = {
  internal: BigNumber;
  external: BigNumber;
};

export default function useBalancesUsedBySource({
  tokenAddress,
  amount,
  mode,
}: IUseBalancesUsedBySource) {
  const [sourceAmounts, setSourceAmounts] = useState<BalanceBySource>({
    internal: ZERO_BN,
    external: ZERO_BN,
  });

  const balances = useFarmerBalances();

  useEffect(() => {
    const balance: Balance | null = balances[tokenAddress];
    if (!balance || !amount || amount.lte(0)) return;

    let internal = ZERO_BN;
    let external = ZERO_BN;

    if (mode === FarmFromMode.EXTERNAL) {
      external = amount;
    }
    if (mode === FarmFromMode.INTERNAL) {
      internal = amount;
    }

    if (mode === FarmFromMode.INTERNAL_EXTERNAL) {
      if (balance.internal.gte(amount)) {
        internal = amount;
      } else {
        // the amount the external balance has to cover.
        const amtLeft = amount.minus(balance.internal);

        console.log('amtLeft: ', amtLeft.toNumber());

        // If the balance.external < amtLeft, the action cannot be performed.
        if (balance.external.gte(amtLeft)) {
          internal = balance.internal;
          external = amtLeft;
        }
      }
    }

    setSourceAmounts({ internal, external });
  }, [amount, balances, mode, tokenAddress]);

  useEffect(() => {
    console.log({
      mode: copy.FROM[mode],
      internal: sourceAmounts.internal.toNumber(),
      external: sourceAmounts.external.toNumber(),
    });
  }, [sourceAmounts, mode]);

  return sourceAmounts;
}
