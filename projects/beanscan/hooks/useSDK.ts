import { BeanstalkSDK } from '@beanstalk/sdk';
import { useMemo } from 'react';
import { useProvider, useSigner } from 'wagmi';

export default function useSDK() {
  const provider = useProvider({ chainId: 1 });
  const { data: signer } = useSigner({ chainId: 1 });
  
  return useMemo(() => 
    new BeanstalkSDK({
      provider,
      signer,
    }),
    [provider, signer]
  )
}