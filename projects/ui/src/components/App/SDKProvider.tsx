import React, { useEffect, useMemo, useState } from 'react';
import { BeanstalkSDK } from '@beanstalk/sdk';
import { useSigner } from '~/hooks/ledger/useSigner';

const IS_DEVELOPMENT_ENV = process.env.NODE_ENV !== 'production';

export const SDKContext = React.createContext<BeanstalkSDK>(new BeanstalkSDK());

export const SDKProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [address, setAddress] = useState('');
  const { data: signer } = useSigner();

  useEffect(() => {
    async function getAddress() {
      const signerAddress = await signer?.getAddress();
      setAddress(signerAddress ?? '');
    }

    getAddress();
  }, [signer]);

  const sdk = useMemo(() => {
    if (signer && address) {
      return new BeanstalkSDK({
        signer: signer,
        DEBUG: IS_DEVELOPMENT_ENV,
      });
    }
    
    return new BeanstalkSDK();
  }, [address, signer]);

  return <SDKContext.Provider value={sdk}>{children}</SDKContext.Provider>;
};
