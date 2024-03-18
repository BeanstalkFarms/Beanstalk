import BigNumber from 'bignumber.js';
import { DateTime } from 'luxon';
import { useCallback } from 'react';
import { useEthersProvider } from '~/util/wagmi/ethersAdapter';

export type BlockInfo = {
  blockNumber: BigNumber;
  timestamp: DateTime;
};

export default function useFetchLatestBlock() {
  const provider = useEthersProvider();

  const fetch = useCallback(async (): Promise<BlockInfo> => {
    const block = await provider.getBlock('latest');
    return {
      blockNumber: new BigNumber(block.number),
      timestamp: DateTime.fromSeconds(block.timestamp),
    };
  }, [provider]);

  return [fetch] as const;
}
