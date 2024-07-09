import React, { createContext, useMemo } from 'react';
import { BeanstalkSDK } from '@beanstalk/sdk';

// Ethereum Images
import ethIconCircled from '~/img/tokens/eth-logo-circled.svg';
import wEthIconCircled from '~/img/tokens/weth-logo-circled.svg';

// Bean Images
import beanCircleLogo from '~/img/tokens/bean-logo-circled.svg';
import beanCrv3LpLogo from '~/img/tokens/bean-crv3-logo.svg';

// Beanstalk Token Logos
import stalkLogo from '~/img/beanstalk/stalk-icon-winter.svg';
import seedLogo from '~/img/beanstalk/seed-icon-winter.svg';
import podsLogo from '~/img/beanstalk/pod-icon-winter.svg';
import sproutLogo from '~/img/beanstalk/sprout-icon-winter.svg';
import rinsableSproutLogo from '~/img/beanstalk/rinsable-sprout-icon.svg';
import beanEthLpLogo from '~/img/tokens/bean-eth-lp-logo.svg';
import beanEthWellLpLogo from '~/img/tokens/bean-eth-well-lp-logo.svg';
import beathWstethWellLPLogo from '~/img/tokens/bean-wsteth-logo.svg';

// ERC-20 Token Images
import crv3Logo from '~/img/tokens/crv3-logo.png';
import daiLogo from '~/img/tokens/dai-logo.svg';
import usdcLogo from '~/img/tokens/usdc-logo.svg';
import usdtLogo from '~/img/tokens/usdt-logo.svg';
import lusdLogo from '~/img/tokens/lusd-logo.svg';
import stethLogo from '~/img/tokens/steth-logo.svg';
import wstethLogo from '~/img/tokens/wsteth-logo.svg';
import unripeBeanLogo from '~/img/tokens/unripe-bean-logo-circled.svg';
import unripeBeanWethLogoUrl from '~/img/tokens/unrip-beanweth.svg';
import useSetting from '~/hooks/app/useSetting';
import { SUBGRAPH_ENVIRONMENTS } from '~/graph/endpoints';
import { useEthersProvider } from '~/util/wagmi/ethersAdapter';
import { useSigner } from '~/hooks/ledger/useSigner';
import { useDynamicSeeds } from '~/hooks/sdk';

const IS_DEVELOPMENT_ENV = process.env.NODE_ENV !== 'production';

const setTokenMetadatas = (sdk: BeanstalkSDK) => {
  // Beanstalk tokens
  sdk.tokens.STALK.setMetadata({ logo: stalkLogo });
  sdk.tokens.SEEDS.setMetadata({ logo: seedLogo });
  sdk.tokens.PODS.setMetadata({ logo: podsLogo });
  sdk.tokens.SPROUTS.setMetadata({ logo: sproutLogo });
  sdk.tokens.RINSABLE_SPROUTS.setMetadata({ logo: rinsableSproutLogo });
  sdk.tokens.BEAN_ETH_UNIV2_LP.setMetadata({ logo: beanEthLpLogo });

  // ETH-like tokens
  sdk.tokens.ETH.setMetadata({ logo: ethIconCircled });
  sdk.tokens.WETH.setMetadata({ logo: wEthIconCircled });
  sdk.tokens.STETH.setMetadata({ logo: stethLogo });
  sdk.tokens.WSTETH.setMetadata({ logo: wstethLogo });

  // ERC-20 LP tokens
  sdk.tokens.BEAN_CRV3_LP.setMetadata({ logo: beanCrv3LpLogo });
  sdk.tokens.BEAN_ETH_WELL_LP.setMetadata({ logo: beanEthWellLpLogo });
  sdk.tokens.BEAN_WSTETH_WELL_LP.setMetadata({
    logo: beathWstethWellLPLogo,
  });
  sdk.tokens.UNRIPE_BEAN_WETH.setMetadata({ logo: unripeBeanWethLogoUrl });

  // ERC-20 tokens
  sdk.tokens.BEAN.setMetadata({ logo: beanCircleLogo });
  sdk.tokens.UNRIPE_BEAN.setMetadata({ logo: unripeBeanLogo });
  sdk.tokens.CRV3.setMetadata({ logo: crv3Logo });
  sdk.tokens.DAI.setMetadata({ logo: daiLogo });
  sdk.tokens.USDC.setMetadata({ logo: usdcLogo });
  sdk.tokens.USDT.setMetadata({ logo: usdtLogo });
  sdk.tokens.LUSD.setMetadata({ logo: lusdLogo });
};

const useBeanstalkSdkContext = () => {
  const { data: signer } = useSigner();
  const provider = useEthersProvider();

  const [datasource] = useSetting('datasource');
  const [subgraphEnv] = useSetting('subgraphEnv');

  const subgraphUrl =
    SUBGRAPH_ENVIRONMENTS?.[subgraphEnv]?.subgraphs?.beanstalk;

  return useMemo(() => {
    console.debug(`Instantiating BeanstalkSDK`, {
      provider,
      signer,
      datasource,
      subgraphUrl,
    });

    const sdk = new BeanstalkSDK({
      provider: provider as any,
      readProvider: provider as any,
      signer: signer ?? undefined,
      source: datasource,
      DEBUG: IS_DEVELOPMENT_ENV,
      ...(subgraphUrl ? { subgraphUrl } : {}),
    });

    setTokenMetadatas(sdk);
    return sdk;
  }, [datasource, provider, signer, subgraphUrl]);
};

export const BeanstalkSDKContext = createContext<
  ReturnType<typeof useBeanstalkSdkContext> | undefined
>(undefined);

function BeanstalkSDKProvider({ children }: { children: React.ReactNode }) {
  const sdk = useBeanstalkSdkContext();
  const ready = useDynamicSeeds(sdk);

  return (
    <>
      {ready && (
        <BeanstalkSDKContext.Provider value={sdk}>
          {children}
        </BeanstalkSDKContext.Provider>
      )}
    </>
  );
}

export default React.memo(BeanstalkSDKProvider);
