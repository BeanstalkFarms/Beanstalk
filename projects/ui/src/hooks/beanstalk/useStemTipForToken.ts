import { Token } from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { useMemo } from 'react';
import useSilo from '~/hooks/beanstalk/useSilo';

export default function useStemTipForToken(
  token: Token
): ethers.BigNumber | null {
  const silo = useSilo();
  return useMemo(
    () => silo.balances[token.address]?.stemTip ?? null,
    [silo, token.address]
  );
}
