import { useMemo } from 'react';
import { ethers } from 'ethers';
import useSdk from '~/hooks/sdk';
import useSeason from '../beanstalk/useSeason';
import useFarmerSilo from './useFarmerSilo';
import { LegacyDepositCrate } from '~/state/farmer/silo';
import { tokenValueToBN } from '~/util';
import { ZERO_BN } from '~/constants';
import useStemTipForToken from '~/hooks/beanstalk/useStemTipForToken';

/// Returns the deposit crate which will be created via calling 'plant'
export default function useFarmerDepositCrateFromPlant() {
  ///
  const sdk = useSdk();

  /// Beanstalk
  const season = useSeason();
  const stemTip = useStemTipForToken(sdk.tokens.BEAN);

  /// Farmer
  const farmerSilo = useFarmerSilo();

  const crate = useMemo(() => {
    const { STALK, BEAN } = sdk.tokens;
    const earned = farmerSilo.beans.earned;
    const earnedTV = BEAN.amount(earned.toString());

    const stalk = BEAN.getStalk(earnedTV);
    const seeds = BEAN.getSeeds(earnedTV);
    // no stalk is grown yet as it is a new deposit from the current season
    const grownStalk = STALK.amount(0);

    if (!stemTip) throw new Error('No stem tip loaded for BEAN');

    // asBN => as DepositCrate from UI;
    const asBN: LegacyDepositCrate = {
      stem: stemTip,
      amount: earned,
      bdv: earned,
      stalk: {
        total: tokenValueToBN(stalk),
        base: tokenValueToBN(stalk),
        grown: ZERO_BN,
      },
      seeds: tokenValueToBN(seeds),
    };

    // asTV => as DepositCrate<TokenValue> from SDK;
    const asTV = {
      season: ethers.BigNumber.from(season.toString()),
      amount: earnedTV,
      bdv: earnedTV,
      stalk,
      baseStalk: stalk,
      grownStalk,
      seeds,
    };

    return {
      asBN,
      asTV,
    };
  }, [farmerSilo.beans.earned, sdk.tokens, season, stemTip]);

  return {
    crate,
  };
}
