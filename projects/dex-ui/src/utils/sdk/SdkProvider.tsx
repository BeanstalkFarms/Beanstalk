import React, { createContext, useEffect, useMemo } from "react";
import { BeanstalkSDK, ChainId } from "@beanstalk/sdk";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Signer } from "ethers";
import { Log } from "../logger";
import { useEthersProvider, useEthersSigner } from "../wagmi/ethersAdapter";
import { isDEV } from "src/settings";
import { atom, useAtom, Provider as JotaiProvider, createStore } from "jotai";
import { getRpcUrl } from "../wagmi/urls";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, signer, chainId]);

  if (!sdk) return null;

  return <>{children}</>;
}

export const SdkProvider = React.memo(({ children }: { children: React.ReactNode }) => (
  <>
    <JotaiProvider store={sdkStore}>
      <BeanstalkSdkSetter>{children}</BeanstalkSdkSetter>
    </JotaiProvider>
  </>
));
