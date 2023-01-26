import { useCallback, useMemo } from 'react';
import { FarmFromMode, FarmToMode, FarmWorkflow, Token } from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { ZERO_BN } from '~/constants';
import { FarmWithClaimFormState } from '~/components/Common/Form';
import useSdk, { createLocalOnlyStep } from '~/hooks/sdk';
import { useFetchFarmerBarn } from '~/state/farmer/barn/updater';
import { useFetchFarmerField } from '~/state/farmer/field/updater';
import useFarmerFertilizer from '~/hooks/farmer/useFarmerFertilizer';
import useFarmerField from '~/hooks/farmer/useFarmerField';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import { ClaimableBeanToken } from '../farmer/useFarmerClaimableBeanAssets';

type GetOrBuildWorkflowProps = FarmWithClaimFormState & { 
  tokenIn: Token;
  amountIn: BigNumber;
};

export default function useClaimAndDoX() {
  // Helpers
  const sdk = useSdk();

  /// Convenience variable
  const beanstalk = useMemo(() => sdk.contracts.beanstalk,[sdk.contracts.beanstalk]);

  // Farmer
  const farmerBarn = useFarmerFertilizer();
  const farmerField = useFarmerField();
  const farmerSilo = useFarmerSilo();

  // Refetch functions
  const [refetchFarmerBarn] = useFetchFarmerBarn();
  const [refetchFarmerField] = useFetchFarmerField();

  /**
   * @param claiming the assets being claimed from the FormState
   * refetches the the farmer's barn and/or field based on the assets being claimed
   */
  const refetch = useCallback(
    async (claiming: ClaimableBeanToken[]) => {
      const promises: (() => Promise<void>)[] = [];

      if (!claiming.length) return;
      claiming.forEach((k) => {
        k === ClaimableBeanToken.SPROUTS && promises.push(refetchFarmerBarn);
        k === ClaimableBeanToken.PODS && promises.push(refetchFarmerField);
      });

      await Promise.all(promises.map(async (promise) => promise()));
    },
    [refetchFarmerBarn, refetchFarmerField]
  );

  /**
   * @param toMode the mode to claim to
   * returns a workflow step to claim fertilized plots if there are fertilized plots
   */
  const getClaimFertilizedSteps = useCallback((toMode: FarmToMode) => {
      try {
        const claimingIds = farmerBarn.balances.map((bal) => bal.token.id.toString());
        if (!claimingIds.length) return undefined;

        // eslint-disable-next-line unused-imports/no-unused-vars
        const claimFertilizedStep = async (_amountInStep: ethers.BigNumber, context: any) => ({
          name: 'claimFertilized',
          amountOut: _amountInStep,
          prepare: () => ({
              target: beanstalk.address,
              callData: beanstalk.interface.encodeFunctionData('claimFertilized', [claimingIds, toMode])
            }),
          decode: (data: string) => beanstalk.interface.decodeFunctionData('claimFertilized', data),
          decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('claimFertilized', result),
        });

        return claimFertilizedStep;
      } catch (err) {
        console.error(err);
      }
    },
    [farmerBarn.balances, beanstalk.address, beanstalk.interface]
  );

  /**
   * @param toMode the mode to claim to
   * returns a workflow step to claim harvested plots if there are harvestable plots
   */
  const getHarvestSteps = useCallback((toMode: FarmToMode) => {
      try {
        const harvestable = Object.keys(farmerField.harvestablePlots);
        if (!harvestable.length) return undefined;
  
        const harvesting = harvestable.map((harvestIndex) =>
          sdk.tokens.PODS.fromHuman(harvestIndex).toBlockchain()
        );

        // eslint-disable-next-line unused-imports/no-unused-vars
        const harvestStep = async (_amountInStep: ethers.BigNumber, context: any) => ({
          name: 'harvest',
          amountOut: _amountInStep,
          prepare: () => ({
            target: beanstalk.address,
            callData: beanstalk.interface.encodeFunctionData('harvest', [harvesting, toMode]),
          }),
          decode: (data: string) => beanstalk.interface.decodeFunctionData('harvest', data),
          decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('harvest', result),
        });

        return harvestStep;
      } catch (err) {
        console.error(err);
        return undefined;
      }
    },
    [beanstalk.address, beanstalk.interface, farmerField.harvestablePlots, sdk.tokens.PODS]
  );

  /**
   * @param toMode the mode to claim to
   * returns a workflow step to claim BEAN withdrawn from the silo
   * Currently only supports claimable beans and not any other whitelisted silo token
   */
  const getClaimWithdrawnSteps = useCallback((toMode: FarmToMode) => {
      try {
        const crates = farmerSilo.balances[sdk.tokens.BEAN.address]?.claimable?.crates;
        if (!crates?.length) return undefined;

        if (crates.length > 1) {
          return new sdk.farm.actions.ClaimWithdrawals(
            sdk.tokens.BEAN.address,
            crates.map((crate) => crate.season.toString()),
            toMode
          );
        }

        // eslint-disable-next-line unused-imports/no-unused-vars
        const claimWithdrawn = async (_amountInStep: ethers.BigNumber, context: any) => ({
          name: 'claimWithdrawal',
          amountOut: _amountInStep,
          prepare: () => ({
            target: beanstalk.address,
            callData: beanstalk.interface.encodeFunctionData('claimWithdrawal', [
              sdk.tokens.BEAN.address,
              crates[0].season.toString(),
              toMode,
            ])
          }),
          decode: (data: string) => beanstalk.interface.decodeFunctionData('claimWithdrawal', data),
          decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('claimWithdrawal', result),
        });

        return claimWithdrawn;
      } catch (error) {
        console.error(error);
        return undefined;
      }
    },
    [
      beanstalk.address, 
      beanstalk.interface, 
      farmerSilo.balances, 
      sdk.farm.actions.ClaimWithdrawals, 
      sdk.tokens.BEAN.address
    ]
  );
  
  /**
   * @returns a workflow step to transfer excess BEAN to an user's external wallet
   */
  const getTransferExcessStep = useCallback(async () => {
    try {
      const account = await sdk.getAccount();
      const token = sdk.tokens.BEAN;

      // should never get to this point but needed to unwrap optional
      if (!account) throw new Error('Account was not defined. Wallet connection required');

      return new sdk.farm.actions.TransferToken(
        token.address,
        account,
        FarmFromMode.INTERNAL,
        FarmToMode.EXTERNAL
      );
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }, [sdk]);

  const claimFunctions = useMemo(
    () => ({
      [ClaimableBeanToken.SPROUTS]: getClaimFertilizedSteps,
      [ClaimableBeanToken.PODS]: getHarvestSteps,
      [ClaimableBeanToken.BEAN]: getClaimWithdrawnSteps,
    }),
    [getClaimFertilizedSteps, getClaimWithdrawnSteps, getHarvestSteps]
  );

  /**
   * @param beansClaiming - mapping of bean-redeemable tokens to claim and their amounts
   * @param maxBeansClaimable - the maximum amount of beans that can be claimed
   * @param tokenIn - the token being used to perform the subsequent transaction
   * @param amountIn - the amount of the token being used
   * @param destination - FarmToMode
   * @param whitelistedToken - silo whitelisted token being deposited
   * @returns a FarmWorkflow and Error
   * 
   * if there are no beans to claim, returns an empty workflow
   */
  const getOrBuildWorkflow = useCallback(async (
    { beansClaiming, maxBeansClaimable, tokenIn, amountIn, destination }: GetOrBuildWorkflowProps
  ): Promise<{
    workflow: FarmWorkflow<{ slippage: number } & Record<string, any>>;
    error: Error | null;
  }> => {
    const work = sdk.farm.create();

    try {
      const beansRedeemed = Object.values(beansClaiming).reduce(
        (acc, curr) => acc.plus(curr.amount), 
        ZERO_BN
      );
      const isRedeeming = beansRedeemed.gt(0) && maxBeansClaimable.gt(0);

      // if there are no beans to redeem, return an empty workflow
      if (!isRedeeming) {
        return { 
          workflow: work, 
          error: null 
        };
      }
      
      /*
       * 'surplus': the amount of beans redeemed that are not being used in a subsequent transaction
       * 'claimTo': the FarmToMode the surplus beans will Claimed To
       * 
       * If the surplus beans are being used & the next txn and the tokenIn is BEAN, claimTo will be INTERNAL
       * This is only valid for now until we add support to use claimable beans in conjunction w/ other tokens. 
       *
       * - cBean = BEAN from claimable balance (harvestable pods, fertilizable sprouts, claimable bean)
       * - destination = FarmToMode of surplus beans at the end of the txn in the form data
       *===============================================================================================*
       * TokenIn  | Silo Token  |       input + cBean | claim amt | surplus | total used | claimToMode *
       *----------|-------------|---------------------|-----------|---------|------------|-------------*
       *          |             | 100 BEAN + 50 cBEAN |   50 BEAN |  0 BEAN |   150 BEAN |    INTERNAL *
       *   BEAN   |     BEAN    |  100 BEAN + 1 cBEAN |   50 BEAN | 49 BEAN |   101 BEAN |    INTERNAL *
       *          |             |  100 BEAN + 0 cBEAN |   50 BEAN | 50 BEAN |   100 BEAN | destination *
       *-----------------------------------------------------------------------------------------------*
       *          |             | 100 BEAN + 50 cBEAN |   50 BEAN |  0 BEAN |   150 BEAN |    INTERNAL *
       *   BEAN   |  BEAN:3CRV  |  100 BEAN + 1 cBEAN |   50 BEAN | 49 BEAN |   101 BEAN |    INTERNAL *
       *          |             |  100 BEAN + 0 cBEAN |   50 BEAN | 50 BEAN |   100 BEAN | destination *
       *-----------------------------------------------------------------------------------------------*
       * ETH      | BEAN        |               1 ETH |   50 BEAN | 50 BEAN |      1 ETH | destination *
       *===============================================================================================*
       */
      let surplus: BigNumber = ZERO_BN;
      let claimTo: FarmToMode = destination;

      /**
       * calculate the surplus beans
       */
      if (sdk.tokens.BEAN.equals(tokenIn)) {
        if (amountIn?.lt(beansRedeemed)) {
          surplus = beansRedeemed.minus(amountIn);
          claimTo = FarmToMode.INTERNAL;
        }
      } else {
        surplus = beansRedeemed;
      }

      /* 
      * Add the claim bean steps to the workflow
      */
      for (const k of Object.keys(beansClaiming)) {
        const step = claimFunctions[k as keyof typeof claimFunctions]?.(claimTo);
        step && work.add(step);
      }

      /**
       * if destination is the circulating balance, we add a step to transfer beans to EOA
       * otherwise, we don't add anything here b/c the beans will be transferred to the internal balance in the claim step
       */
      if (surplus.gt(0) && destination === FarmToMode.EXTERNAL) {
        const _surplus = sdk.tokens.BEAN.fromHuman(surplus.toString());
        // generate a local-only step to inject the transfer amount into the workflow
        const preTransferStep = createLocalOnlyStep('pre-transfer', _surplus);
        const transferStep = await getTransferExcessStep();
        if (transferStep) {
          work.add(preTransferStep, { onlyLocal: true });
          work.add(transferStep);
        }
      }
      
      /**
       * generate a local-only step to inject the 'amountOut' parameter needed for the subsequent transaction
       */ 
      const postClaimAndDoXStep = createLocalOnlyStep('pre-claim-and-do-x', tokenIn.fromHuman(amountIn.toString()));
      work.add(postClaimAndDoXStep, { onlyLocal: true });

      return { workflow: work, error: null };
    } catch (e) {
      return { workflow: work, error: e as Error };
    }
  }, [claimFunctions, getTransferExcessStep, sdk.farm, sdk.tokens]);

  return {
    getOrBuildWorkflow,
    refetch
  };
}
