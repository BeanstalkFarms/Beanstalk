import React, { useEffect } from "react";

import { JsonRpcProvider } from "@ethersproject/providers";
import { Signer } from "ethers";
import { atom, createStore, useAtom } from "jotai";

import { BeanstalkSDK, ChainId } from "@beanstalk/sdk";

import { isDEV } from "src/settings";
import { Log } from "src/utils/logger";
import { useEthersProvider, useEthersSigner } from "src/utils/wagmi/ethersAdapter";
import { getRpcUrl } from "src/utils/wagmi/urls";

export const sdkAtom = atom<BeanstalkSDK | null>(null);
sdkAtom.debugLabel = "sdk";

const sdkStore = createStore();
sdkStore.set(sdkAtom, null);

const getSDK = (provider?: JsonRpcProvider, signer?: Signer, chainId?: number) => {
  const sdk = new BeanstalkSDK({
    rpcUrl: getRpcUrl(chainId as ChainId),
    signer: signer,
    provider: provider,
    DEBUG: isDEV
  });

  Log.module("sdk").debug("sdk initialized", sdk);
  return sdk;
};

function BeanstalkSdkSetter({ children }: { children: React.ReactNode }) {
  const [sdk, setSdk] = useAtom(sdkAtom);
  const signer = useEthersSigner();
  const provider = useEthersProvider();
  const chainId = provider.network.chainId;

  useEffect(() => {
    setSdk(getSDK(provider as JsonRpcProvider, signer, chainId));
  }, [provider, signer, chainId, setSdk]);

  if (!sdk || !chainId || !provider) return null;

  return <>{children}</>;
}

export const SdkProvider = React.memo(({ children }: { children: React.ReactNode }) => (
  <>
    <BeanstalkSdkSetter>{children}</BeanstalkSdkSetter>
  </>
));
