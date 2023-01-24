import { FarmFromMode, FarmToMode, TokenValue } from '@beanstalk/sdk';
import { useCallback, useMemo } from 'react';

import useSdk from '~/hooks/sdk';
import { useFetchFarmerBarn } from '~/state/farmer/barn/updater';
import { useFetchFarmerField } from '~/state/farmer/field/updater';
import { useFetchFarmerSilo } from '~/state/farmer/silo/updater';
import useFarmerFertilizer from '~/hooks/farmer/useFarmerFertilizer';
import useFarmerField from '~/hooks/farmer/useFarmerField';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import { ClaimableBeanToken } from '../farmer/useFarmerClaimableBeanAssets';

type ClaimAndDoXConfig = {
  toMode?: FarmToMode;
  fertilizer?: Boolean;
  field?: Boolean;
  silo?: Boolean;
};

type GetRedeemTokenStep = (toMode: FarmToMode) => string | undefined;

export default function useClaimAndDoX(whitelistedTokenAddress: string) {
  const sdk = useSdk();

  // farmer
  const farmerBarn = useFarmerFertilizer();
  const farmerField = useFarmerField();
  const farmerSilo = useFarmerSilo();

  const [refetchFarmerBarn] = useFetchFarmerBarn();
  const [refetchFarmerField] = useFetchFarmerField();
  const [refetchFarmerSilo] = useFetchFarmerSilo();

  const refetch = useCallback(
    async ({ fertilizer, field, silo }: ClaimAndDoXConfig) => {
      const promises = [];
      if (fertilizer) promises.push(refetchFarmerBarn);
      if (field) promises.push(refetchFarmerField);
      if (silo) promises.push(refetchFarmerSilo);

      await Promise.all(promises.map(async (promise) => promise()));
    },
    [refetchFarmerBarn, refetchFarmerField, refetchFarmerSilo]
  );

  const getClaimFertilizedSteps = useCallback((toMode: FarmToMode): string | undefined => {
      try {
        const claimingIds = farmerBarn.balances.map((bal) =>
          bal.token.id.toString()
        );
        const fn = sdk.contracts.beanstalk.interface.encodeFunctionData('claimFertilized', [claimingIds, toMode]);
        return fn;
      } catch (err) {
        console.error(err);
      }
    },
    [farmerBarn.balances, sdk.contracts.beanstalk.interface]
  );

  const getHarvestSteps = useCallback((toMode: FarmToMode): string | undefined => {
      try {
        const harvestable = Object.keys(farmerField.harvestablePlots);
        if (!harvestable.length) return undefined;
        const harvesting = harvestable.map((harvestIndex) =>
          sdk.tokens.PODS.fromHuman(harvestIndex).toBlockchain()
        );
        const fn = sdk.contracts.beanstalk.interface.encodeFunctionData('harvest', [harvesting, toMode]);
        return fn;
      } catch (err) {
        console.error(err);
      }
    },
    [farmerField.harvestablePlots, sdk.contracts.beanstalk.interface, sdk.tokens.PODS]
  );

  const getClaimWithdrawnSteps = useCallback((toMode: FarmToMode): string | undefined => {
      try {
        const claimable =
          farmerSilo.balances[whitelistedTokenAddress].claimable;
        const crates = claimable.crates;
        if (!crates.length) return undefined;

        const fn = crates.length > 1 
          ? sdk.contracts.beanstalk.interface.encodeFunctionData('claimWithdrawals', [
              whitelistedTokenAddress,
              crates.map((crate) => crate.season.toString()),
              toMode
            ]) 
          : sdk.contracts.beanstalk.interface.encodeFunctionData('claimWithdrawal', [
              whitelistedTokenAddress,
              crates[0].season.toString(),
              toMode,
            ]);
        return fn;
      } catch (error) {
        console.error(error);
      }
    },
    [farmerSilo.balances, sdk.contracts.beanstalk.interface, whitelistedTokenAddress]
  );

  const transferExcess = useCallback(async (amount: TokenValue) => {
    try {
      const account = await sdk.getAccount();
      const token = await sdk.tokens.findByAddress(whitelistedTokenAddress);

      if (!token) {
        throw new Error('Whitelisted token not found');
      }
      if (!account) {
        throw new Error('Account was not defined. Wallet connection required');
      }

      return sdk.contracts.beanstalk.interface.encodeFunctionData(
        'transferToken',
        [
          token.address,
          account,
          amount.toBigNumber(),
          FarmFromMode.INTERNAL,
          FarmToMode.EXTERNAL,
        ]
      );
    } catch (error) {
      console.error(error);
    }
  }, [sdk, whitelistedTokenAddress]);

  const getEncodedSteps: Record<string, GetRedeemTokenStep> = useMemo(
    () => ({
      [ClaimableBeanToken.SPROUTS]: getClaimFertilizedSteps,
      [ClaimableBeanToken.PODS]: getHarvestSteps,
      [ClaimableBeanToken.BEAN]: getClaimWithdrawnSteps,
    }),
    [getClaimFertilizedSteps, getClaimWithdrawnSteps, getHarvestSteps]
  );

  return {
    getEncodedSteps,
    transferExcess,
    refetch,
  };
}

/**
 * to rinse sprouts,
 * - array of fertilizer ids
 * - farmToMode
 *
 * fn: await .claimFertilized()
 */

/**
 * to harvest,
 * - Object.keys(plots).map((harvestableIndex) => toStringBaseUnitBN(harvestableIndex, 6)),
 * - farmToMode
 * - fn: await .harvest
 */

/**
 * to claim Beans
 *
 *
 * claimable crates[]
 *
 *
 * token.address,
 * crate.season.str() | create.season.str()[]
 * farmToMode
 *
 * crates.len > 1 ? claimWithdrawals : claimWithdrawal
 *
 *
 *
 */
