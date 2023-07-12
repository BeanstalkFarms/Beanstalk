import { useMemo } from 'react';

import BigNumberJS from 'bignumber.js';
import { PlantAndDoX } from '~/lib/Txn';

import useSdk from '~/hooks/sdk';
import useStemTipForToken from '~/hooks/beanstalk/useStemTipForToken';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';

export default function usePlantAndDoX(): {
  plantAction: PlantAndDoX | undefined;
  earnedBeans: BigNumberJS;
  crate: {
    tv: ReturnType<PlantAndDoX['makePlantCrate']> | undefined;
    bn: ReturnType<PlantAndDoX['makePlantCrateBN']> | undefined;
  };
} {
  const sdk = useSdk();
  const farmerSilo = useFarmerSilo();
  const beanStem = useStemTipForToken(sdk.tokens.BEAN);

  const earnedBeans = farmerSilo.beans.earned;

  return useMemo(() => {
    if (earnedBeans.lte(0) || !beanStem || beanStem?.lte(0)) {
      return {
        plantAction: undefined,
        earnedBeans,
        crate: {
          tv: undefined,
          bn: undefined,
        },
      };
    }

    const _earnedBeans = sdk.tokens.BEAN.amount(earnedBeans.toString());
    const plantAndDoX = new PlantAndDoX(sdk, _earnedBeans, beanStem);

    return {
      plantAction: plantAndDoX,
      earnedBeans,
      crate: {
        tv: plantAndDoX.makePlantCrate(),
        bn: plantAndDoX.makePlantCrateBN(),
      },
    };
  }, [beanStem, earnedBeans, sdk]);
}
