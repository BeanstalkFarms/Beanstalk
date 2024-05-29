import * as React from 'react';

// import type { GetContractArgs, GetContractResult } from '@wagmi/core'
// import { getContract } from '@wagmi/core';
// import type { Abi } from 'abitype';

import { Contract as EthersContract } from 'ethers';

export function useContract({
  // @ts-ignore
  address,
  // @ts-ignore
  abi,
  // @ts-ignore
  signerOrProvider,
}) {
  return React.useMemo(() => {
    if (!address || !abi) return null;
    return new EthersContract(address, abi, signerOrProvider);
  }, [address, abi, signerOrProvider]);
}
