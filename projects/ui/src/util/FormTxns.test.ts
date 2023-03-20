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
import {
  beforeAll,
  beforeEach,
  describe,
  it,
  afterEach,
  afterAll,
  expect,
} from 'vitest';
import { FormTxnBuilder, FormTxn, FormTxnBuilderInterface } from './FormTxns';

import { expectWithinBounds, FarmerTestUtil, getTestUtils } from './test-util';

const BASE_TEST_LEN = 15_000;
const MAX_TEST_LEN = 25_000;

// utils
let chain: TestUtils.BlockchainUtils;
let sdk: BeanstalkSDK;
let account: string;
let utils: FarmerTestUtil;
let initSnap: number;

/// CONSTANTS
const DEPOSIT_AND_FERT_AMOUNT = 100_000;
const WALLET_BEAN_AMOUNT = 1_000;

beforeAll(async () => {
  /// Have to do this first...
  await setup.init({ resetFork: true });
  const plotIds = await utils.receiveNextHarvestablePlots();
  initSnap = await chain.snapshot();

  ///
  await setup.init({ resetFork: false });

  /// Convenience
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
}, 90_000);

afterAll(async () => {
  await chain.revert(initSnap);
});

describe('Form Txns', () => {
  describe('Claim + Do X', () => {
    let claimSnap: number | undefined;

    beforeEach(async () => {
      if (claimSnap) {
        chain.revert(claimSnap);
      }
      claimSnap = await chain.snapshot();
    });

    afterEach(async () => {
      if (claimSnap) {
        chain.revert(claimSnap);
        claimSnap = undefined;
      }
    });

    it.skip(
      'BEAN (claimed amount) -> BEAN:SILO',
      async () => {
        const params = {
          preset: 'claim',
          primary: [FormTxn.RINSE, FormTxn.HARVEST, FormTxn.CLAIM],
          secondary: undefined,
        };

        const { amountIn, additional } = await testSiloDeposit(
          params,
          sdk.tokens.BEAN,
          sdk.tokens.BEAN,
          FarmFromMode.INTERNAL_TOLERANT,
          0
        );

        const bals = await utils.getBalance.siloAndToken();

        const cache = utils.cache.tokens;
        const prevBalance = cache.getValue(sdk.tokens.BEAN);

        expect(amountIn.eq(additional)).toBe(true);
        expect(bals.silo.claimable.amount.eq(0)).toBe(true);
        expect(amountIn.eq(bals.silo.deposited.amount)).toBe(true);
        expect(prevBalance?.external.eq(bals.token.external)).toBe(true);
      },
      BASE_TEST_LEN
    );

    it.skip(
      'BEAN (claimed amount + external amount) -> BEAN:SILO',
      async () => {
        const params = {
          preset: 'claim',
          primary: [FormTxn.CLAIM],
          secondary: undefined,
        };

        const { amountIn } = await testSiloDeposit(
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

    it(
      'BEAN (claimed amount + external amount) -> BEAN:SILO + PLANT, ENROOT',
      async () => {
        const params = {
          preset: 'claim',
          primary: [FormTxn.RINSE, FormTxn.HARVEST, FormTxn.CLAIM],
          secondary: [FormTxn.PLANT, FormTxn.ENROOT],
        };

        const cache = utils.cache;
        const earnedBeansPrev = cache.amounts.getValue(FormTxn.PLANT);

        const { amountIn } = await testSiloDeposit(
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

    it.skip(
      'claim to internal + ETH (external amount) -> BEAN:SILO',
      async () => {
        const params = {
          preset: 'claim',
          primary: [FormTxn.CLAIM],
          secondary: undefined,
        };

        const { estimate, additional } = await testSiloDeposit(
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
        expect(bals.silo.claimable.amount.eq(0)).toBe(true);
      },
      MAX_TEST_LEN
    );
  });

  describe('Plant + Do x', () => {
    let blockSnap: number;
    let plantSnap: number | undefined;

    beforeAll(async () => {
      blockSnap = await chain.snapshot();
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
    }, 60_000);

    afterAll(async () => {
      utils.manageCache.delete('plant');
      await chain.revert(blockSnap);
    });

    beforeEach(async () => {
      if (plantSnap) {
        chain.revert(plantSnap);
      }
      plantSnap = await chain.snapshot();
    });

    afterEach(async () => {
      if (plantSnap) {
        chain.revert(plantSnap);
        plantSnap = undefined;
      }
    });

    it.skip(
      'PLANT => Convert',
      async () => {
        const params = {
          preset: 'plant',
          primary: [FormTxn.PLANT],
          secondary: undefined,
        };

        const { BEAN, BEAN_CRV3_LP } = sdk.tokens;

        const siloBeanPrev = utils.cache.silo.getValue(BEAN)?.deposited.amount;
        const siloBeanLPPrev =
          utils.cache.silo.getValue(BEAN_CRV3_LP)?.deposited.amount;

        expect(siloBeanPrev).toBeTruthy();
        expect(siloBeanLPPrev).toBeTruthy();

        const plantAmount = utils.cache.amounts.getValue(FormTxn.PLANT);
        const plantAmountNum = parseFloat(plantAmount.toHuman());
        const totalAmountIn = DEPOSIT_AND_FERT_AMOUNT + plantAmountNum;

        const { minAmountOut } = await testSiloConvert(
          params,
          BEAN,
          BEAN_CRV3_LP,
          totalAmountIn
        );

        const [siloBean, siloBeanLP] = await Promise.all([
          utils.getBalance.siloToken(BEAN),
          utils.getBalance.siloToken(BEAN_CRV3_LP),
        ]);

        const esimatedDeposit = siloBeanLPPrev!.add(minAmountOut);

        expect(siloBeanPrev?.gt(siloBean.deposited.amount)).toBe(true);
        expect(esimatedDeposit?.lte(siloBeanLP.deposited.amount)).toBe(true);
        expect(siloBeanLPPrev?.lt(esimatedDeposit)).toBe(true);
      },
      MAX_TEST_LEN
    );

    it(
      'PLANT => Convert + CLAIM',
      async () => {
        const params = {
          preset: 'plant',
          primary: [FormTxn.PLANT],
          secondary: [FormTxn.CLAIM],
        };

        const { BEAN, BEAN_CRV3_LP } = sdk.tokens;

        const siloBeanPrev = utils.cache.silo.getValue(BEAN);
        const siloBeanLPPrev = utils.cache.silo.getValue(BEAN_CRV3_LP);

        expect(siloBeanPrev).toBeTruthy();
        expect(siloBeanLPPrev).toBeTruthy();

        const plantAmount = utils.cache.amounts.getValue(FormTxn.PLANT);
        const plantAmountNum = parseFloat(plantAmount.toHuman());
        const totalAmountIn = DEPOSIT_AND_FERT_AMOUNT + plantAmountNum;

        const { minAmountOut } = await testSiloConvert(
          params,
          BEAN,
          BEAN_CRV3_LP,
          totalAmountIn
        );

        const [siloBean, siloBeanLP, beanBalance] = await Promise.all([
          utils.getBalance.siloToken(BEAN),
          utils.getBalance.siloToken(BEAN_CRV3_LP),
          utils.getBalance.token(BEAN),
        ]);

        const esimatedDeposit =
          siloBeanLPPrev!.deposited.amount.add(minAmountOut);

        expect(siloBean.claimable.amount.eq(0)).toBe(true);
        expect(siloBeanPrev?.claimable.amount?.eq(beanBalance.internal)).toBe(
          true
        );
        expect(esimatedDeposit.lte(siloBeanLP.deposited.amount)).toBe(true);
        expect(siloBeanLPPrev?.deposited.amount?.lt(esimatedDeposit)).toBe(
          true
        );
      },
      MAX_TEST_LEN
    );
  });
});

async function testSiloDeposit(
  params: FormTxnBuilderInterface,
  tokenIn: Token,
  target: Token,
  from: FarmFromMode,
  _amountFromEOA: number
) {
  try {
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

    expect(receipt.transactionHash).toBeTruthy();

    return {
      additional,
      amountFromEOA,
      amountIn,
      workflow,
      estimate,
    };
  } catch (err: any) {
    console.log(err);
    throw new Error(err);
  }
}

async function testSiloConvert(
  params: FormTxnBuilderInterface,
  tokenIn: Token,
  tokenOut: Token,
  _amountIn: number
) {
  try {
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
    const amountIn = inToken.amount(_amountIn);

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
    const minAmountOut = amountOut.pct(100 - 0.1);

    const seasons = conversion.crates.map((crate) => crate.season.toString());
    const amounts = conversion.crates.map((crate) =>
      crate.amount.toBlockchain()
    );

    const callData = beanstalk.interface.encodeFunctionData('convert', [
      convert.calculateEncoding(inToken, outToken, amountIn, minAmountOut),
      seasons,
      amounts,
    ]);

    const convertStep: StepGenerator = async (_amountInStep, _context) => ({
      name: 'convert',
      amountOut: _amountInStep,
      prepare: () => ({
        target: beanstalk.address,
        callData: callData,
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
    expect(receipt.transactionHash).toBeTruthy();

    return {
      estimate,
      amountOut,
      minAmountOut,
      workflow,
      additional,
    };
  } catch (err: any) {
    console.log(err);
    throw new Error(err);
  }
}

const help = {
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
