import React, { createContext, useMemo } from 'react';
import { BeanstalkSDK } from '@beanstalk/sdk';
import { useProvider } from 'wagmi';
import { useSigner } from '~/hooks/ledger/useSigner';

// Ethereum Images
import ethIconCircled from '~/img/tokens/eth-logo-circled.svg';
import wEthIconCircled from '~/img/tokens/weth-logo-circled.svg';

// Bean Images
// import beanLogoUrl from '~/img/tokens/bean-logo.svg';
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

// ERC-20 Token Images
import crv3Logo from '~/img/tokens/crv3-logo.png';
import daiLogo from '~/img/tokens/dai-logo.svg';
import usdcLogo from '~/img/tokens/usdc-logo.svg';
import usdtLogo from '~/img/tokens/usdt-logo.svg';
import lusdLogo from '~/img/tokens/lusd-logo.svg';
import unripeBeanLogo from '~/img/tokens/unripe-bean-logo-circled.svg';
import unripeBeanWethLogoUrl from '~/img/tokens/unrip-beanweth.svg';
import useSetting from '~/hooks/app/useSetting';
import { SUBGRAPH_ENVIRONMENTS } from '~/graph/endpoints';

const IS_DEVELOPMENT_ENV = process.env.NODE_ENV !== 'production';

const useBeanstalkSdkContext = () => {
  const provider = useProvider();
  const { data: signer } = useSigner();

  const [datasource] = useSetting('datasource');
  const [subgraphEnv] = useSetting('subgraphEnv');

  const subgraphUrl =
    SUBGRAPH_ENVIRONMENTS?.[subgraphEnv]?.subgraphs?.beanstalk;

  const sdk = useMemo(() => {
    console.info(`Instantiating BeanstalkSDK`, {
      provider,
      signer,
      datasource,
      subgraphUrl,
    });

    const _sdk = new BeanstalkSDK({
      provider: provider as any,
      signer: signer ?? undefined,
      source: datasource,
      DEBUG: IS_DEVELOPMENT_ENV,
      ...(subgraphUrl ? { subgraphUrl } : {}),
    });

    _sdk.tokens.ETH.setMetadata({ logo: ethIconCircled });
    _sdk.tokens.WETH.setMetadata({ logo: wEthIconCircled });

    _sdk.tokens.BEAN.setMetadata({ logo: beanCircleLogo });
    _sdk.tokens.BEAN_CRV3_LP.setMetadata({ logo: beanCrv3LpLogo });
    _sdk.tokens.BEAN_ETH_WELL_LP.setMetadata({ logo: beanEthWellLpLogo });
    _sdk.tokens.UNRIPE_BEAN.setMetadata({ logo: unripeBeanLogo });
    _sdk.tokens.UNRIPE_BEAN_WETH.setMetadata({ logo: unripeBeanWethLogoUrl });

    _sdk.tokens.STALK.setMetadata({ logo: stalkLogo });
    _sdk.tokens.SEEDS.setMetadata({ logo: seedLogo });
    _sdk.tokens.PODS.setMetadata({ logo: podsLogo });
    _sdk.tokens.SPROUTS.setMetadata({ logo: sproutLogo });
    _sdk.tokens.RINSABLE_SPROUTS.setMetadata({ logo: rinsableSproutLogo });

    _sdk.tokens.BEAN_ETH_UNIV2_LP.setMetadata({ logo: beanEthLpLogo });

    _sdk.tokens.CRV3.setMetadata({ logo: crv3Logo });
    _sdk.tokens.DAI.setMetadata({ logo: daiLogo });
    _sdk.tokens.USDC.setMetadata({ logo: usdcLogo });
    _sdk.tokens.USDT.setMetadata({ logo: usdtLogo });
    _sdk.tokens.LUSD.setMetadata({ logo: lusdLogo });

    return _sdk;
  }, [datasource, provider, signer, subgraphUrl]);

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
