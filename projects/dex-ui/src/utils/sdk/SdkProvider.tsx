import React, { createContext, useMemo } from "react";
import { BeanstalkSDK } from "@beanstalk/sdk";
import { useProvider, useSigner } from "wagmi";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Signer } from "ethers";
import { Log } from "../logger";

const IS_DEVELOPMENT_ENV = process.env.NODE_ENV !== "production";

const getSDK = (provider?: JsonRpcProvider, signer?: Signer) => {
  const sdk = new BeanstalkSDK({
    signer: signer,
    provider: provider,
    DEBUG: IS_DEVELOPMENT_ENV
  });
  Log.module("sdk").debug("sdk initialized", sdk);
  return sdk;
};

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const RPC_URL = IS_DEVELOPMENT_ENV ? "http://localhost:8545" : `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

export const BeanstalkSDKContext = createContext<BeanstalkSDK>(new BeanstalkSDK({ rpcUrl: RPC_URL, DEBUG: import.meta.env.DEV }));

function BeanstalkSDKProvider({ children }: { children: React.ReactNode }) {
  const { data: signer, isSuccess } = useSigner();
  const provider = useProvider();
  const sdk = useMemo(() => getSDK(provider as JsonRpcProvider, signer ?? undefined), [provider, signer, isSuccess]);

  return <BeanstalkSDKContext.Provider value={sdk}>{children}</BeanstalkSDKContext.Provider>;
}

export const SdkProvider = React.memo(BeanstalkSDKProvider);
