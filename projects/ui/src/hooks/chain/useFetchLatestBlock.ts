import BigNumber from 'bignumber.js';
import { DateTime } from 'luxon';
import { useCallback } from 'react';
import { useProvider } from 'wagmi';

export default function useFetchLatestBlock() {
  const provider = useProvider();

  const fetch = useCallback(async () => {
    const block = await provider.getBlock('latest');
    return {
      blockNumber: new BigNumber(block.number),
      timestamp: DateTime.fromSeconds(block.timestamp),
    };
  }, [provider]);

  return [fetch] as const;
}
