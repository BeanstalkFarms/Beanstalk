import React, { createContext, useMemo } from 'react';
import { BeanstalkSDK } from '@beanstalk/sdk';
import { useSigner } from '~/hooks/ledger/useSigner';

const IS_DEVELOPMENT_ENV = process.env.NODE_ENV !== 'production';

const useBeanstalkSdkContext = () => {
  const { data: signer } = useSigner();

  const sdk = useMemo(() => {
    const _sdk = new BeanstalkSDK({
      signer: signer ?? undefined,
      DEBUG: IS_DEVELOPMENT_ENV,
    });

    return _sdk;
  }, [signer]);

  return sdk;
};

export const BeanstalkSDKContext = createContext<
  ReturnType<typeof useBeanstalkSdkContext> | undefined
>(undefined);

function BeanstalkSDKProvider({ children }: { children: React.ReactNode }) {
  // use the same instance of the sdk across the app
  const sdk = useBeanstalkSdkContext();

  return (
    <BeanstalkSDKContext.Provider value={sdk}>
      {children}
    </BeanstalkSDKContext.Provider>
  );
}

export default React.memo(BeanstalkSDKProvider);
