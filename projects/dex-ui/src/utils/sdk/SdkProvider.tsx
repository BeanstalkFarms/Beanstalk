import React, { createContext, useMemo } from "react";
import { BeanstalkSDK } from "@beanstalk/sdk";
import { useAccount, useProvider, useSigner } from "wagmi";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Signer } from "ethers";

const IS_DEVELOPMENT_ENV = process.env.NODE_ENV !== "production";

const getSDK = (provider?: JsonRpcProvider, signer?: Signer) => {
  return new BeanstalkSDK({
    signer: signer,
    provider: provider,
    DEBUG: IS_DEVELOPMENT_ENV
  });
};

// const useBeanstalkSdkContext = () => {
//   const { isConnected } = useAccount();
//   const { data: signer, isSuccess } = useSigner();
//   const provider = useProvider();
//   console.log(isSuccess, signer);

//   const sdk = useMemo(() => getSDK(provider as JsonRpcProvider, signer ?? undefined), [provider, signer, isSuccess]);

//   console.log("Returning SDK.");

//   return sdk;
// };

export const BeanstalkSDKContext = createContext<BeanstalkSDK>(new BeanstalkSDK());

function BeanstalkSDKProvider({ children }: { children: React.ReactNode }) {
  const { data: signer, isSuccess } = useSigner();
  const provider = useProvider();
  const sdk = useMemo(() => getSDK(provider as JsonRpcProvider, signer ?? undefined), [provider, signer, isSuccess]);
  if (isSuccess && signer){
    // @ts-ignore
    sdk.isReady = true;
  }

  return <BeanstalkSDKContext.Provider value={sdk}>{children}</BeanstalkSDKContext.Provider>;
}


export const SdkProvider = React.memo(BeanstalkSDKProvider);
