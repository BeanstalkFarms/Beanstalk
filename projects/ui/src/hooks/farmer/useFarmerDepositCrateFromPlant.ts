import { useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import useAccount from '~/hooks/ledger/useAccount';
import useSdk from '~/hooks/sdk';
import useSeason from '../beanstalk/useSeason';
import useFarmerSilo from './useFarmerSilo';
import { DepositCrate } from '~/state/farmer/silo';
import { tokenValueToBN } from '~/util';

/// Returns the deposit crate which will be created via calling 'plant'
export default function useFarmerDepositCrateFromPlant() {
  ///
  const sdk = useSdk();
  const account = useAccount();

  /// Beanstalk
  const season = useSeason();

  /// Farmer
  const farmerSilo = useFarmerSilo();

  const makeDepositCrate = useCallback(async () => {
    if (!account) throw new Error('Account not found');

    const { contracts, sun, tokens } = sdk;
    const { STALK, BEAN } = tokens;

    const [_earnedBeans, currSeason] = await Promise.all([
      contracts.beanstalk.balanceOfEarnedBeans(account),
      sun.getSeason(),
    ]);

    const amount = BEAN.fromBlockchain(_earnedBeans);

    const stalk = BEAN.getStalk(amount);
    const seeds = BEAN.getSeeds(amount);
    // no stalk is grown yet as it is a new deposit from the current season
    const grownStalk = STALK.amount(0);

    console.log('stalk: ', stalk.toHuman());
    console.log('seeds: ', seeds.toHuman());

    return {
      season: ethers.BigNumber.from(currSeason.toString()),
      amount: amount,
      bdv: amount,
      stalk,
      baseStalk: stalk,
      grownStalk,
      seeds,
    };
  }, [account, sdk]);

  // TODO: refactor this to use the same logic as makeDepositCrate
  const crate = useMemo(() => {
    const { STALK, BEAN } = sdk.tokens;
    const earned = farmerSilo.beans.earned;
    const earnedTV = BEAN.amount(earned.toString());

    const stalk = BEAN.getStalk(earnedTV);
    const seeds = BEAN.getSeeds(earnedTV);
    // no stalk is grown yet as it is a new deposit from the current season
    const grownStalk = STALK.amount(0);

    // asBN => as DepositCrate from UI;
    const asBN: DepositCrate = {
      season,
      amount: earned,
      bdv: earned,
      stalk: tokenValueToBN(stalk),
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
  }, [farmerSilo.beans.earned, sdk.tokens, season]);

  return {
    crate,
    makeCrate: makeDepositCrate,
  };
}
