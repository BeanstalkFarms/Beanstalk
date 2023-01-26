import React, { createContext, useMemo } from 'react';
import { BeanstalkSDK } from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { useSigner } from '~/hooks/ledger/useSigner';
import useChainId from '~/hooks/chain/useChainId';
import { SupportedChainId, TESTNET_RPC_ADDRESSES } from '~/constants';
import { BEAN, BEAN_CRV3_LP, CRV3, DAI, ETH, PODS, SPROUTS, UNRIPE_BEAN, UNRIPE_BEAN_CRV3, USDC, USDT, WETH } from '~/constants/tokens';

const useBeanstalkSdkContext = () => {
  const { data: signer } = useSigner();
  const chainId = useChainId();

  const sdk = useMemo(() => {
    let provider: ethers.providers.JsonRpcProvider | undefined;
    if (chainId === SupportedChainId.MAINNET) {
      provider = new ethers.providers.AlchemyProvider(
        chainId,
        import.meta.env.VITE_ALCHEMY_API_KEY
      );
    } else if (TESTNET_RPC_ADDRESSES[chainId]) {
      provider = new ethers.providers.WebSocketProvider('ws://localhost:8545');
      // provider = new ethers.providers.JsonRpcProvider(
      //   TESTNET_RPC_ADDRESSES[chainId]
      // );
    } else {
      provider = undefined;
    }

    const _provider = new ethers.providers.WebSocketProvider(
      'ws://localhost:8545'
    );

    const _sdk = new BeanstalkSDK({
      signer: signer ?? undefined,
      provider: _provider,
    });
    // set metadata
    _sdk.tokens.ETH.setMetadata({ logo: ETH[1].logo });
    _sdk.tokens.WETH.setMetadata({ logo: WETH[1].logo });

    _sdk.tokens.BEAN.setMetadata({ logo: BEAN[1].logo });
    _sdk.tokens.BEAN_CRV3_LP.setMetadata({ logo: BEAN_CRV3_LP[1].logo });
    _sdk.tokens.UNRIPE_BEAN.setMetadata({ logo: UNRIPE_BEAN[1].logo });
    _sdk.tokens.UNRIPE_BEAN_CRV3.setMetadata({ logo: UNRIPE_BEAN_CRV3[1].logo });

    _sdk.tokens.SPROUTS.setMetadata({ logo: SPROUTS.logo });
    _sdk.tokens.PODS.setMetadata({ logo: PODS.logo });
    
    _sdk.tokens.DAI.setMetadata({ logo: DAI[1].logo });
    _sdk.tokens.USDC.setMetadata({ logo: USDC[1].logo });
    _sdk.tokens.USDT.setMetadata({ logo: USDT[1].logo });
    _sdk.tokens.CRV3.setMetadata({ logo: CRV3[1].logo });

    return _sdk;
  }, [chainId, signer]);

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
