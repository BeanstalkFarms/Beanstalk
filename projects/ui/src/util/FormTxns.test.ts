/* eslint-disable @typescript-eslint/no-use-before-define */
import {
  BeanstalkSDK,
  FarmFromMode,
  StepGenerator,
  TestUtils,
  Token,
  TokenValue,
} from '@beanstalk/sdk';

import { ethers } from 'ethers';
import { beforeAll, beforeEach, describe, it, expect } from 'vitest';
import { FormTxnBuilder, FormTxn, FormTxnBuilderInterface } from './FormTxns';

import { expectWithinBounds, FarmerTestUtil, getTestUtils } from './test-util';

const BASE_TEST_LEN = 20_000;

// utils
let chain: TestUtils.BlockchainUtils;
let sdk: BeanstalkSDK;
let account: string;
let utils: FarmerTestUtil;

/// CONSTANTS
const DEPOSIT_AND_FERT_AMOUNT = 100_000;
const WALLET_BEAN_AMOUNT = 1_000;

describe('Form Txns', async () => {
  beforeAll(async () => {
    /// Have to do this first...
    await setup.init({ resetFork: true });
    const plotIds = await utils.receiveNextHarvestablePlots();

    ///
    await setup.init({ resetFork: false });

    const { beanstalk } = sdk.contracts;
    const { BEAN, CRV3 } = sdk.tokens;

    const fertilizersPrev = await beanstalk.getFertilizers();
    await chain.setCurveLiquidity(
      BEAN.amount(50_000_000),
      CRV3.amount(50_000_000)
    );
    await chain.sunriseForward();
    await utils.prepareSiloAndFertilizer(DEPOSIT_AND_FERT_AMOUNT);
    await utils.setupSiloAndFertilizer({ amount: DEPOSIT_AND_FERT_AMOUNT });

    await chain.setCurveLiquidity(
      BEAN.amount(50_000_000),
      CRV3.amount(75_000_000)
    );
    await chain.sunriseForward();

    const fertilizerIds = await utils.getAndParseFertilizerIds(fertilizersPrev);
    await chain.setBEANBalance(
      account,
      sdk.tokens.BEAN.amount(WALLET_BEAN_AMOUNT)
    );
    await setup.cache({
      plotIds,
      depositAmount: DEPOSIT_AND_FERT_AMOUNT,
      fertilizerIds,
    });

    return async () => {
      await chain.resetFork();
    };
  }, 90_000);

  describe('Claim + Do X', async () => {
    beforeEach(async () => {
      const snap = await chain.snapshot();

      return async () => {
        await chain.revert(snap);
        await chain.mine();
        await wait();
      };
    });

    it(
      'Claim to internal + ETH (external amount) -> BEAN:SILO',
      async () => {
        const params = {
          preset: 'claim',
          primary: [FormTxn.CLAIM],
          secondary: undefined,
        };

        const { estimate, additional } = await handle.siloDeposit(
          params,
          sdk.tokens.ETH,
          sdk.tokens.BEAN,
          FarmFromMode.EXTERNAL,
          1
        );
        const bals = await utils.getBalance.siloAndToken();

        const est = sdk.tokens.BEAN.fromBlockchain(estimate);

        expectWithinBounds(bals.silo.deposited.amount, est);
        expectWithinBounds(bals.token.internal, additional);
        // expect(bals.silo.claimable.amount.eq(0)).toBe(true);
      },
      BASE_TEST_LEN
    );

    it(
      'BEAN (claimed amount + external amount) -> BEAN:SILO + PLANT, ENROOT',
      async () => {
        const params = {
          preset: 'claim',
          primary: [FormTxn.CLAIM],
          secondary: [FormTxn.PLANT, FormTxn.ENROOT],
        };

        const cache = utils.cache;
        const earnedBeansPrev = cache.amounts.getValue(FormTxn.PLANT);

        const { amountIn } = await handle.siloDeposit(
          params,
          sdk.tokens.BEAN,
          sdk.tokens.BEAN,
          FarmFromMode.INTERNAL_EXTERNAL,
          1_000
        );

        const bals = await utils.getBalance.siloAndToken();

        expect(bals.silo.claimable.amount.eq(0)).toBe(true);
        expect(
          amountIn.add(earnedBeansPrev).eq(bals.silo.deposited.amount)
        ).toBe(true);
        expect(bals.token.external.eq(0)).toBe(true);
      },
      BASE_TEST_LEN
    );

    it(
      'BEAN (claimed amount + external amount) -> BEAN:SILO',
      async () => {
        const params = {
          preset: 'claim',
          primary: [FormTxn.RINSE, FormTxn.HARVEST, FormTxn.CLAIM],
          secondary: undefined,
        };

        const { amountIn } = await handle.siloDeposit(
          params,
          sdk.tokens.BEAN,
          sdk.tokens.BEAN,
          FarmFromMode.INTERNAL_EXTERNAL,
          1_000
        );

        const bals = await utils.getBalance.siloAndToken();

        expect(bals.silo.claimable.amount.eq(0)).toBe(true);
        expect(amountIn.eq(bals.silo.deposited.amount)).toBe(true);
        expect(bals.token.external.eq(0)).toBe(true);
      },
      BASE_TEST_LEN
    );
  });

  describe('Plant + Do x', async () => {
    beforeEach(async () => {
      const snap = await chain.snapshot();

      return async () => {
        await chain.revert(snap);
        await chain.mine();
        await wait();
      };
    });

    beforeAll(async () => {
      const blockSnap = await chain.snapshot();
      const { BEAN } = sdk.tokens;

      /// update cache
      await chain.setBEANBalance(account, BEAN.amount(DEPOSIT_AND_FERT_AMOUNT));
      const tx = await sdk.silo.deposit(
        BEAN,
        BEAN,
        BEAN.amount(DEPOSIT_AND_FERT_AMOUNT),
        0.1,
        account
      );
      await tx.wait();

      /// Set cache
      const bals = await utils.getBalance.siloAndToken(BEAN);
      utils.manageCache.create('plant', { copyFrom: 'main' });
      utils.cache.silo.setValue(BEAN, bals.silo);
      utils.cache.tokens.setValue(BEAN, bals.token);

      return async () => {
        utils.manageCache.delete('plant');
        console.log('reverting block snap...');
        await chain.revert(blockSnap);
      };
    }, 30_000);

    it('PLANT => Convert => ENROOT + CLAIM', async () => {
      const params = {
        preset: 'plant',
        primary: [FormTxn.PLANT],
        secondary: [FormTxn.ENROOT, FormTxn.CLAIM],
      };

      const { BEAN, BEAN_CRV3_LP } = sdk.tokens;

      const siloBeanPrev = utils.cache.silo.getValue(BEAN);
      const siloBeanLPPrev = utils.cache.silo.getValue(BEAN_CRV3_LP);
      expect(siloBeanPrev).toBeTruthy();
      expect(siloBeanLPPrev).toBeTruthy();

      const plantAmount = utils.cache.amounts.getValue(FormTxn.PLANT);
      const amountIn = plantAmount.add(siloBeanPrev!.deposited.amount);

      const claimedAmount = help.additionalAmount(params.secondary);

      const { minAmountOut } = await handle.siloConvert(
        params,
        BEAN,
        BEAN_CRV3_LP,
        amountIn
      );

      const [siloBean, siloBeanLP, beanBalance] = await Promise.all([
        utils.getBalance.siloToken(BEAN),
        utils.getBalance.siloToken(BEAN_CRV3_LP),
        utils.getBalance.token(BEAN),
      ]);

      const estimatedDeposit =
        siloBeanLPPrev!.deposited.amount.add(minAmountOut);

      expect(siloBean.claimable.amount.eq(0)).toBe(true);
      expect(siloBeanPrev?.claimable.amount?.eq(beanBalance.internal)).toBe(
        true
      );
      expect(estimatedDeposit.lte(siloBeanLP.deposited.amount)).toBe(true);
      expect(siloBeanLPPrev?.deposited.amount?.lt(estimatedDeposit)).toBe(true);
      expect(beanBalance.internal.gte(claimedAmount)).toBe(true);
    }, 30_000);
  });
});

const handle = {
  siloDeposit: async (
    params: FormTxnBuilderInterface,
    tokenIn: Token,
    target: Token,
    from: FarmFromMode,
    _amountFromEOA: number
  ) => {
    const { BEAN } = sdk.tokens;
    const deposit = sdk.silo.buildDeposit(target, account);
    deposit.setInputToken(tokenIn, from);

    const additional = help.additionalAmount(params.primary);
    const amountFromEOA = tokenIn.amount(_amountFromEOA);

    /// only add the amounts if the token being deposited is BEAN
    const amountIn =
      BEAN.equals(tokenIn) &&
      BEAN.equals(target) &&
      from !== FarmFromMode.EXTERNAL
        ? additional.add(amountFromEOA)
        : amountFromEOA;

    await deposit.estimate(amountIn);

    const { workflow, estimate, execute } = await FormTxnBuilder.compile(
      sdk,
      params,
      (step: FormTxn) => utils.cache.steps.getValue(step),
      deposit.workflow,
      amountIn,
      0.1
    );
    const txn = await execute();
    const receipt = await txn.wait();
    // await chain.mine();

    expect(receipt.transactionHash).toBeTruthy();

    return {
      additional,
      amountFromEOA,
      amountIn,
      workflow,
      estimate,
    };
  },
  siloConvert: async (
    params: FormTxnBuilderInterface,
    tokenIn: Token,
    tokenOut: Token,
    amountIn: TokenValue
  ) => {
    const convert = sdk.silo.siloConvert;
    // we define this here b/c siloConvert expects token instances from it's own class
    const whitelist = [
      convert.Bean,
      convert.BeanCrv3,
      convert.urBean,
      convert.urBeanCrv3,
    ];

    const [inToken, outToken] = whitelist.reduce(
      (prev, curr) => {
        prev[0] = curr.equals(tokenIn) ? curr : prev[0];
        prev[1] = curr.equals(tokenOut) ? curr : prev[1];
        return prev;
      },
      [null, null] as [Token | null, Token | null]
    );

    if (!inToken || !outToken) throw new Error('conversion unavailable');

    const isConvertingBean = inToken.equals(sdk.tokens.BEAN);

    const additional = isConvertingBean
      ? help.additionalAmount(params.primary)
      : TokenValue.ZERO;

    const season = await sdk.sun.getSeason();
    const siloBal = utils.cache.silo.getValue(tokenIn);
    const depositCrates = [...(siloBal?.deposited.crates || [])];

    if (params.primary?.includes(FormTxn.PLANT) && isConvertingBean) {
      const plantData = await FormTxnBuilder.makePlantCrate(sdk, account);
      if (plantData.canPlant) {
        depositCrates.push(plantData.crate);
      }
    }
    const { beanstalk } = sdk.contracts;

    const conversion = convert.calculateConvert(
      inToken,
      outToken,
      amountIn,
      depositCrates,
      season
    );

    const amountOutBN = await beanstalk.getAmountOut(
      tokenIn.address,
      tokenOut.address,
      conversion.amount.toBigNumber()
    );

    const amountOut = outToken.fromBlockchain(amountOutBN);
    console.log('amoutOut: ', amountOut.toHuman());
    const minAmountOut = amountOut.pct(100 - 0.1);
    console.log('minAmountOut: ', minAmountOut.toHuman());

    const convertStep: StepGenerator = async (_amountInStep, _context) => ({
      name: 'convert',
      amountOut: _amountInStep,
      prepare: () => ({
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('convert', [
          convert.calculateEncoding(inToken, outToken, amountIn, minAmountOut),
          conversion.crates.map((crate) => crate.season.toString()),
          conversion.crates.map((crate) => crate.amount.toBlockchain()),
        ]),
      }),
      decode: (data: string) =>
        beanstalk.interface.decodeFunctionData('convert', data),
      decodeResult: (result: string) =>
        beanstalk.interface.decodeFunctionResult('convert', result),
    });

    const { execute, estimate, workflow } = await FormTxnBuilder.compile(
      sdk,
      params,
      (step: FormTxn) => utils.cache.steps.getValue(step),
      [convertStep],
      amountIn,
      0.1
    );

    const txn = await execute();
    const receipt = await txn.wait();
    // await chain.mine();

    expect(receipt.transactionHash).toBeTruthy();

    return {
      estimate,
      amountOut,
      minAmountOut,
      workflow,
      additional,
    };
  },
};

const help = {
  check: async () => {
    const [earned, stoken, lpSilo, token, ethBal, earnedSeeds] =
      await Promise.all([
        utils.getBalance.earnedBeans(),
        utils.getBalance.siloToken(),
        utils.getBalance.siloToken(sdk.tokens.BEAN_CRV3_LP),
        utils.getBalance.token(),
        utils.getBalance.token(sdk.tokens.ETH),
        utils.getBalance.earnedSeeds(),
      ]);

    console.table({
      earned: earned.toHuman(),
      earnedSeeds: earnedSeeds.toHuman(),
      siloDeposited: stoken.deposited.amount.toHuman(),
      siloClaimable: stoken.claimable.amount.toHuman(),
      siloLPDeposited: lpSilo.deposited.amount.toHuman(),
      beanExternal: token.external.toHuman(),
      beanInternal: token.internal.toHuman(),
      ethExternal: ethBal.external.toHuman(),
    });
  },
  additionalAmount: (formTxns: FormTxn[] | undefined) => {
    if (!formTxns) return TokenValue.ZERO;
    const cache = utils.cache.amounts;
    return formTxns.reduce<TokenValue>((prev, curr) => {
      prev = prev.add(cache.getValue(curr) || TokenValue.ZERO);
      return prev;
    }, TokenValue.ZERO);
  },
};

const setup = {
  init: async (options?: { resetFork: boolean }) => {
    const testUtil = getTestUtils();
    if (options?.resetFork) {
      await testUtil.utils.resetFork();
    }

    sdk = testUtil.sdk;
    account = testUtil.connection.account;
    chain = testUtil.utils;

    utils = new FarmerTestUtil(
      testUtil.sdk,
      testUtil.connection.account,
      testUtil.utils
    );
  },
  cache: async ({
    plotIds,
    depositAmount,
    fertilizerIds,
  }: {
    plotIds: ethers.BigNumber[];
    depositAmount: number;
    fertilizerIds: string[];
  }) => {
    const { beanstalk } = sdk.contracts;

    /// fetch all needed data
    const [
      harvestableIndex,
      rinsableSprouts,
      beanTokenBalance,
      siloBalances,
      earnedBean,
      earnedStalk,
      earnedSeeds,
      grownStalk,
    ] = await Promise.all([
      beanstalk.harvestableIndex(),
      utils.getBalance.fertilized(fertilizerIds),
      utils.getBalance.token(),
      utils.getBalance.siloWhitelist(),
      utils.getBalance.earnedBeans(),
      utils.getBalance.earnedStalk(),
      utils.getBalance.earnedSeeds(),
      utils.getBalance.grownStalk(),
    ]);

    const plotIdsStr = plotIds.map((idx) => idx.toString());

    const startIndex = plotIds.length ? plotIds[0] : undefined;
    const harvestableBN = harvestableIndex.sub(startIndex || harvestableIndex);

    const urCrates = await FormTxnBuilder.pickUnripeCratesForEnroot(
      sdk,
      siloBalances
    );

    const siloBeanBalances = siloBalances.get(sdk.tokens.BEAN);

    const seasons = siloBeanBalances?.claimable.crates.map((crate) =>
      crate.season.toString()
    );

    /// Get FormTxn Functions
    const mow = FormTxnBuilder.getFunction(FormTxn.MOW)(sdk, {
      account,
    });
    const plant = FormTxnBuilder.getFunction(FormTxn.PLANT)(sdk, {});
    const enroot = FormTxnBuilder.getFunction(FormTxn.ENROOT)(sdk, {
      crates: urCrates,
    });
    const rinse = FormTxnBuilder.getFunction(FormTxn.RINSE)(sdk, {
      tokenIds: fertilizerIds,
    });
    const harvest = FormTxnBuilder.getFunction(FormTxn.HARVEST)(sdk, {
      plotIds: plotIdsStr,
    });
    const claim = FormTxnBuilder.getFunction(FormTxn.CLAIM)(sdk, {
      seasons: seasons || [],
    });

    utils.cache.amounts.set({
      earnedStalk: earnedStalk,
      grownStalk: grownStalk,
      earnedSeeds: earnedSeeds,
      [FormTxn.HARVEST]: sdk.tokens.BEAN.fromBlockchain(harvestableBN),
      [FormTxn.CLAIM]: sdk.tokens.BEAN.fromHuman(depositAmount),
      [FormTxn.RINSE]: rinsableSprouts,
      [FormTxn.PLANT]: earnedBean,
      [FormTxn.MOW]: TokenValue.ZERO,
      [FormTxn.ENROOT]: TokenValue.ZERO,
    });
    utils.cache.ids.set({
      [FormTxn.HARVEST]: plotIdsStr,
      [FormTxn.RINSE]: fertilizerIds,
    });
    utils.cache.silo.set(siloBalances);
    utils.cache.tokens.setValue(sdk.tokens.BEAN, beanTokenBalance);
    utils.cache.steps.set({
      [FormTxn.MOW]: mow.getSteps(),
      [FormTxn.PLANT]: plant.getSteps(),
      [FormTxn.ENROOT]: enroot.getSteps(),
      [FormTxn.RINSE]: rinse.getSteps(),
      [FormTxn.HARVEST]: harvest.getSteps(),
      [FormTxn.CLAIM]: claim.getSteps(),
    });
  },
};

const wait = async (_ms?: number) => {
  const ms = _ms || 500;
  await new Promise((resolve) => setTimeout(resolve, ms));
};
