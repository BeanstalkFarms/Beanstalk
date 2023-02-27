import {
  BeanstalkSDK,
  FarmToMode,
  TokenValue,
  FarmWorkflow,
} from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { DepositCrate } from '~/state/farmer/silo';
 
export enum ClaimPlantAction {
  MOW = 'MOW',
  PLANT = 'PLANT',
  ENROOT = 'ENROOT',
  HARVEST = 'HARVEST',
  RINSE = 'RINSE',
  CLAIM = 'CLAIM',
}

export type ClaimPlantActionData = {
  /**
   * workflow steps to execute
   */
  workflow: FarmWorkflow
  /**
   * function to estimate gas of the transaction
   */
  estimateGas: () => Promise<ethers.BigNumber>;
}

type ClaimBeansParams<T> = {
  amount?: TokenValue;
  toMode?: FarmToMode;
} & T;

type ClaimPlantActionParamMap = {
  [ClaimPlantAction.HARVEST]: ClaimBeansParams<{ plotIds: string[] }>;
  [ClaimPlantAction.CLAIM]: ClaimBeansParams<{ seasons: string[] }>;
  [ClaimPlantAction.RINSE]: ClaimBeansParams<{ tokenIds: string[] }>;
  [ClaimPlantAction.MOW]: { account: string };
  [ClaimPlantAction.PLANT]: {};
  [ClaimPlantAction.ENROOT]: { crates: { [addr: string]: DepositCrate[] } };
}

export type ClaimPlantActionMap = {
  [action in ClaimPlantAction]: (...params: (Partial<ClaimPlantActionParamMap[action]>)[]) => ClaimPlantActionData 
}

export type ClaimPlantActionDataMap = Partial<{ [action in ClaimPlantAction]: ClaimPlantActionData }>;

type ClaimPlantFunction<T extends ClaimPlantAction> = (
  sdk: BeanstalkSDK, ...parameters: (ClaimPlantActionParamMap[T])[]
) => ClaimPlantActionData;

const harvest: ClaimPlantFunction<ClaimPlantAction.HARVEST> = (sdk, { plotIds, amount, toMode }) => {
  const { beanstalk } = sdk.contracts;

  const farm = sdk.farm.create('Harvest');
  farm.add(async (_amountInStep: ethers.BigNumber) => ({
    name: 'harvest',
    amountOut: amount?.toBigNumber() || _amountInStep,
    prepare: () => ({
      target: beanstalk.address,
      callData: beanstalk.interface.encodeFunctionData('harvest', [
        plotIds,
        toMode || FarmToMode.INTERNAL,
      ]),
    }),
    decode: (data: string) => beanstalk.interface.decodeFunctionData('harvest', data),
    decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('harvest', result),
  }));

  return {
    workflow: farm.copy(),
    estimateGas: () => beanstalk.estimateGas.harvest(plotIds, toMode || FarmToMode.INTERNAL)
  };
};

const claim: ClaimPlantFunction<ClaimPlantAction.CLAIM> = (sdk, { seasons, toMode }) => {
  const { beanstalk } = sdk.contracts;
  const { BEAN } = sdk.tokens;
  const farm = sdk.farm.create('ClaimWithdrawal');

  if (seasons.length === 1) {
    farm.add(new sdk.farm.actions.ClaimWithdrawal(
      sdk.tokens.BEAN.address,
      seasons[0],
      toMode || FarmToMode.INTERNAL,
    ));

    return { 
      workflow: farm.copy(),
      estimateGas: () => beanstalk.estimateGas.claimWithdrawal(BEAN.address, seasons[0], toMode || FarmToMode.INTERNAL),
    };
  } 
  farm.add(new sdk.farm.actions.ClaimWithdrawals(
    sdk.tokens.BEAN.address,
    seasons,
    toMode || FarmToMode.INTERNAL
  ));

  return {
    workflow: farm.copy(),
    estimateGas: () => beanstalk.estimateGas.claimWithdrawals(BEAN.address, seasons, toMode || FarmToMode.INTERNAL),
  };
};

const rinse: ClaimPlantFunction<ClaimPlantAction.RINSE> = (sdk, { tokenIds, amount, toMode }) => {
  const { beanstalk } = sdk.contracts;
  const farm = sdk.farm.create('ClaimFertilized');

  farm.add(async (_amountInStep: ethers.BigNumber) => ({
    name: 'claimFertilized',
    amountOut: amount?.toBigNumber() || _amountInStep,
    prepare: () => ({
      target: beanstalk.address,
      callData: beanstalk.interface.encodeFunctionData('claimFertilized', [
        tokenIds,
        toMode || FarmToMode.INTERNAL,
      ])
    }),
    decode: (data: string) => beanstalk.interface.decodeFunctionData('claimFertilized', data),
    decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('claimFertilized', result),
  }));
 
  return {
    workflow: farm.copy(),
    estimateGas: () => beanstalk.estimateGas.claimFertilized(tokenIds, toMode || FarmToMode.INTERNAL)
  };
};

const mow: ClaimPlantFunction<ClaimPlantAction.MOW> = (sdk, { account }) => {
  const { beanstalk } = sdk.contracts;
  const farm = sdk.farm.create('Mow');

  farm.add(async (_amountInStep: ethers.BigNumber) => ({
    name: 'update',
    amountOut: _amountInStep,
    prepare: () => ({
      target: beanstalk.address,
      callData: beanstalk.interface.encodeFunctionData('update', [
        account
      ]),
    }),
    decode: (data: string) => beanstalk.interface.decodeFunctionData('update', data),
    decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('update', result),
  }));

  return {
    workflow: farm.copy(),
    estimateGas: () => beanstalk.estimateGas.update(account)
  };
};

const plant: ClaimPlantFunction<ClaimPlantAction.PLANT> = (sdk) => {
  const { beanstalk } = sdk.contracts;
  const farm = sdk.farm.create('Plant');

  farm.add(async (_amountInStep: ethers.BigNumber) => ({
    name: 'plant',
    amountOut: _amountInStep,
    prepare: () => ({
      target: beanstalk.address,
      callData: beanstalk.interface.encodeFunctionData('plant', undefined),
    }),
    decode: (data: string) => beanstalk.interface.decodeFunctionData('plant', data),
    decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('plant', result),
  }));
  return {
    workflow: farm.copy(),
    estimateGas: () => beanstalk.estimateGas.plant()
  };
};

const enroot: ClaimPlantFunction<ClaimPlantAction.ENROOT> = (sdk, { crates }) => {
  const { beanstalk } = sdk.contracts;
  const callData: string[] = [];
  const farm = sdk.farm.create('EnrootDeposit(s)');

  [...sdk.tokens.unripeTokens].forEach((urToken) => {
    const _crates = crates[urToken.address];
    if (_crates.length === 1) {
      const encoded = beanstalk.interface.encodeFunctionData('enrootDeposit', [
        urToken.address,
        _crates[0].season.toString(),
        urToken.fromHuman(_crates[0].amount.toString()).toBlockchain(),
      ]);

      farm.add(async (_amountInStep: ethers.BigNumber) => ({
        name: 'enrootDeposit',
        amountOut: _amountInStep,
        prepare: () => ({ 
          target: beanstalk.address,
          callData: encoded
        }),
        decode: (data: string) => beanstalk.interface.decodeFunctionData('enrootDeposit', data),
        decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('enrootDeposit', result),
      }));
      callData.push(encoded);
    } else if (_crates.length > 1) {
      const encoded = beanstalk.interface.encodeFunctionData('enrootDeposits', [
        urToken.address,
        _crates.map((crate) => crate.season.toString()),
        _crates.map((crate) => urToken.fromHuman(crate.amount.toString()).toBlockchain())
      ]);

      farm.add(async (_amountInStep: ethers.BigNumber) => ({
        name: 'enrootDeposits',
        amountOut: _amountInStep,
        prepare: () => ({ 
          target: beanstalk.address,
          callData: encoded
        }),
        decode: (data: string) => beanstalk.interface.decodeFunctionData('enrootDeposits', data),
        decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('enrootDeposits', result)
      }));
      callData.push(encoded);
    }
  });

  return {
    workflow: farm.copy(),
    estimateGas: () => beanstalk.estimateGas.farm([
      ...callData
    ])
  };
};

export type ClaimPlantResult = {
  estimate: ethers.BigNumber,
  execute: () => Promise<ethers.ContractTransaction>,
  actionsPerformed: Set<ClaimPlantAction>,
}

// -------------------------------------------------------------------------

class ClaimPlant {
  private static actionsMap: { [key in ClaimPlantAction]: ClaimPlantFunction<key> } = {
    [ClaimPlantAction.RINSE]: rinse,
    [ClaimPlantAction.HARVEST]: harvest,
    [ClaimPlantAction.CLAIM]: claim,
    [ClaimPlantAction.MOW]: mow,
    [ClaimPlantAction.PLANT]: plant,
    [ClaimPlantAction.ENROOT]: enroot,
  }

  static getAction(action: ClaimPlantAction) {
    return ClaimPlant.actionsMap[action] as ClaimPlantFunction<typeof action>;
  }

  static presets = {
    rinseAndHarvest: [
      ClaimPlantAction.RINSE,
      ClaimPlantAction.HARVEST,
    ],
    claimBeans: [
      ClaimPlantAction.RINSE,
      ClaimPlantAction.HARVEST,
      ClaimPlantAction.CLAIM
    ],
    plant: [
      ClaimPlantAction.PLANT,
    ],
    none: [],
  }

  private static deduplicate(
    primaryActions: ClaimPlantActionDataMap,
    _secondaryActions: ClaimPlantActionDataMap,
    filterMow?: boolean
  ) {
    const actionsPerformed = new Set<ClaimPlantAction>([
      ...Object.keys(primaryActions), 
      ...Object.keys(_secondaryActions)
    ] as ClaimPlantAction[]);
  
    /// --- Deduplicate actions --- 
    // If the same action exists in both primary and secondary, we use the one in primary
    const set = new Set<ClaimPlantAction>();
    Object.keys(_secondaryActions).forEach((key) => set.add(key as ClaimPlantAction));
    Object.keys(primaryActions).forEach((key) => set.delete(key as ClaimPlantAction));
  
    const secondaryActions = [...set].reduce<ClaimPlantActionDataMap>((prev, curr) => {
      prev[curr] = _secondaryActions[curr];
      return prev;
    }, {});
  
     /**
     * Make sure that if we are calling 'enroot' or 'plant', we are not also calling mow.
     * 'Mow' is executed by default if enrooting or planting on the contract side.
     */
     const enrooting = ClaimPlantAction.ENROOT in primaryActions || ClaimPlantAction.ENROOT in secondaryActions;
     const planting = ClaimPlantAction.PLANT in primaryActions || ClaimPlantAction.PLANT in secondaryActions;
     const claimingWithdrawals = ClaimPlantAction.CLAIM in primaryActions || ClaimPlantAction.CLAIM in secondaryActions;
  
    if (enrooting || planting || claimingWithdrawals || filterMow) {
      if (ClaimPlantAction.MOW in primaryActions) delete primaryActions[ClaimPlantAction.MOW];
      if (ClaimPlantAction.MOW in secondaryActions) delete secondaryActions[ClaimPlantAction.MOW];
      actionsPerformed.delete(ClaimPlantAction.MOW);
    }

    return {
      primaryActions,
      secondaryActions,
      actionsPerformed,
    };
  }

  static async build(
    /** */
    sdk: BeanstalkSDK,
    /** 
     * ClaimPlantActions required to precede any arbitrary function call when calling Farm
     */
    _primaryActions: ClaimPlantActionDataMap,
    /** 
     * Additional ClaimPlantActions that don't affect the main operation
     */
    _secondaryActions: ClaimPlantActionDataMap,
    /** 
     * workflow that executes some function call if performed in isolation
     * Ex: if performing a deposit, pass in FarmWorkflow with only the steps to perform a deposit
     */
    operation: FarmWorkflow,
    /** */
    amountIn: TokenValue,
    /** */
    options: {
      slippage: number
      value?: ethers.BigNumber
    },
    filterMow?: boolean,
  ): Promise<ClaimPlantResult> {
    const { 
      primaryActions, 
      secondaryActions, 
      actionsPerformed 
    } = ClaimPlant.deduplicate(_primaryActions, _secondaryActions, filterMow);
  
    /// --- Construct workflow ---
    const farm = sdk.farm.create();

    Object.values(secondaryActions).forEach(({ workflow }) => { 
      farm.add(workflow.copy());
    });
    const primary = Object.values(primaryActions);
    primary.forEach(({ workflow }) => {
      farm.add(workflow.copy());
    });
  
    if (primary.length > 1) {
      farm.add(ClaimPlant.injectOnlyLocal('pre-x', amountIn), { onlyLocal: true });
    }
    farm.add(operation.copy());
    
    const estimate = await farm.estimate(amountIn);
    
    const summary = farm.summarizeSteps();
    const mapped = summary.map((step) => ({
      name: step.name,
      amountOut: step.amountOut.toString(),
    }));
    console.table(mapped);
    console.log(farm.generators);
  
    const execute = () => farm.execute(amountIn, options);
  
    return { 
      estimate, 
      execute, 
      actionsPerformed
    };
  }

  static injectOnlyLocal(name: string, amount: TokenValue) {
    return () => ({
      name,
      amountOut: amount.toBigNumber(),
      prepare: () => ({ target: '', callData: '' }),
      decode: () => undefined,
      decodeResult: () => undefined,
    });
  }

  static injectOnlyLocalAndAddAmount(name: string, amount: TokenValue) {
    return async (_amountInStep: ethers.BigNumber, _context: any) => {
      const total = ethers.BigNumber.from(amount.toBlockchain()).add(_amountInStep);
      return {
        name,
        amountOut: total,
        prepare: () => ({ target: '', callData: '' }),
        decode: () => undefined,
        decodeResult: () => undefined,
      };
    };
  }
}

export default ClaimPlant;

// import { BeanstalkSDK, DataSource } from "src/lib/BeanstalkSDK";
// import { TokenValue } from "src/TokenValue";
// import { BlockchainUtils } from "src/utils/TestUtils";
// import { getTestUtils, getTestUtilsWithAccount, setupConnection } from "src/utils/TestUtils/provider";

// import { FarmFromMode, FarmToMode, Token, TokenBalance } from "src/index";
// import { Crate, TokenSiloBalance } from "../silo/types";
// import { FarmWorkflow } from "./farm";
// import chalk from "chalk";
// import { assert } from "chai";

// jest.setTimeout(180_000); // 3 mins
// const MAX_TIMEOUT = 30_000;

// // utils
// let account: string;
// let sdk: BeanstalkSDK;
// let util: BlockchainUtils;

// /// Cached Values
// // Silo
// let crates: Crate<TokenValue>[];
// let depositValue: TokenValue;

// // Field
// let harvestablePods: TokenValue;
// let plotId: string;
// let plotIndex: string;

// // Barn
// let fertilizerId: string;
// let rinsableSprouts: TokenValue;

// // Beanstalk
// let seasonCurr: number;
// let beanBalancePrev: TokenBalance;

// const BEAN_BALANCE_START = 100_000;
// const USDC_AMOUNT = 50_000;
// const SLIPPAGE_PRECISION = 10 ** 6;

// beforeAll(async () => {
//   // do this first so it doesn't mess w/ the rest of the test.
//   // otherwise the test will fail because of different sdk instances
//   const plot = await recievePlotTransfer();
//   assert(plot !== undefined, "plot is undefined");
//   expect(plot.fullyHarvested).toBe(false);
//   plotId = plot.id;
//   console.log("plot: ", plotId);
//   plotIndex = plot.index;
//   log.cyan("[BEFORE ALL]: start");
//   log.cyan("\t[BEFORE ALL]: setting up sdk and utils...");
//   // Set up
//   const { signer, provider, account: _account } = await setupConnection();
//   sdk = new BeanstalkSDK({
//     provider: provider,
//     signer: signer,
//     DEBUG: false
//   });
//   account = _account;
//   util = new BlockchainUtils(sdk);
//   depositValue = sdk.tokens.BEAN.fromHuman(1_000);

//   // Set up the account with some BEAN and USDC
//   // Approve the Beanstalk contract to spend the account's BEAN and USDC
//   log.cyan("\t[BEFORE ALL]: setting token balances...");
//   await Promise.all([
//     await util.setBEANBalance(account, sdk.tokens.BEAN.amount(BEAN_BALANCE_START)),
//     await util.setUSDCBalance(account, sdk.tokens.USDC.amount(USDC_AMOUNT)),
//     await sdk.tokens.BEAN.approveBeanstalk(TokenValue.MAX_UINT256.toBigNumber()),
//     await sdk.tokens.USDC.approveBeanstalk(TokenValue.MAX_UINT256.toBigNumber())
//   ]);
//   log.cyan("\t[BEFORE ALL]: fetching fert, season, and minting fert...");

//   const _fertilizerId = await sdk.contracts.beanstalk.getEndBpf();
//   fertilizerId = _fertilizerId.toString();
//   const seasonOfDeposit = await sdk.sun.getSeason();
//   const mintFertilizerStep = await getSteps.mintFertilizerWithUSDC(USDC_AMOUNT);
//   log.cyan("\t[BEFORE ALL]: setting up deposit...");

//   const deposit = sdk.silo.buildDeposit(sdk.tokens.BEAN, account);
//   deposit.setInputToken(sdk.tokens.BEAN);

//   deposit.workflow.add(
//     new sdk.farm.actions.WithdrawDeposits(sdk.tokens.BEAN.address, [seasonOfDeposit.toString()], [depositValue.blockchainString])
//   );
//   deposit.workflow.add(mintFertilizerStep);
//   log.cyan("\t[BEFORE ALL]: estimating deposit...");

//   await deposit.estimate(depositValue);
//   log.cyan("\t[BEFORE ALL]: executing deposit...");

//   await deposit.execute(depositValue, 0.1).then((r) => r.wait());
//   log.cyan("\t[BEFORE ALL]: deposit execcuted! fetching balances...");

//   const siloBalance = await sdk.silo.getBalance(sdk.tokens.BEAN, account, { source: DataSource.LEDGER });
//   crates = siloBalance.withdrawn.crates;

//   log.cyan("\t[BEFORE ALL]: setting price & advancing season...");
//   // Pump price to ensure harvestable and rinsable are > 0 in the following season
//   await util.setPrice(20, 50).then(() => wait());
//   seasonCurr = await util.sunriseForward();

//   log.cyan("\t[BEFORE ALL]: fetching harvestable idx, fertilzied, and bean balances...");
//   const [harvestableIndex, fertilized, _beanBalances] = await Promise.all([
//     sdk.contracts.beanstalk.harvestableIndex(),
//     sdk.contracts.beanstalk.balanceOfFertilized(account, [fertilizerId]),
//     sdk.tokens.getBalance(sdk.tokens.BEAN, account)
//   ]);

//   harvestablePods = sdk.tokens.BEAN.fromBlockchain(harvestableIndex).sub(sdk.tokens.BEAN.fromBlockchain(plot.index));
//   rinsableSprouts = sdk.tokens.RINSABLE_SPROUTS.fromBlockchain(fertilized);
//   console.log(chalk.grey("harvestableIndex: ", harvestableIndex.toString()));
//   console.log(chalk.grey("harvestablePods: ", harvestablePods.toHuman()));
//   console.log(chalk.grey("plot.index: ", plot.index.toString()));

//   expect(seasonCurr.toString()).toEqual(crates[0].season.toString());
//   expect(harvestablePods.gt(0)).toBe(true);
//   expect(rinsableSprouts.gt(0)).toBe(true);

//   beanBalancePrev = _beanBalances;
//   log.cyan("--- [BEFORE ALL]: done!");
// });

// describe("Workflow: Claim and Do X", () => {
//   describe("claims to proper balances", () => {
//     let snapshot1: number;

//     beforeEach(async () => {
//       snapshot1 = await util.snapshot();
//       // For some reason if we don't wait here, there's a race condition that causes the test to fail
//       await wait();
//       log.orange("[BEFORE EACH]: snapshot taken");
//     });

//     afterEach(async () => {
//       await util.revert(snapshot1);
//       // // For some reason if we don't wait here, there's a race condition that causes the test to fail
//       await wait();
//       log.orange("[AFTER EACH]: reverted to snapshot...");
//     });

//     it("claims all to internal balance", async () => {
//       const totalDeposited = depositValue.add(harvestablePods).add(rinsableSprouts);
//       await doClaimAndDoX([true, true, true]);
//       const tokenBalance = await getBalances.token();
//       expect(tokenBalance.internal.eq(totalDeposited)).toBe(true);
//     });

//     it("claims all then transfers all to external balance", async () => {
//       const totalDeposited = depositValue.add(harvestablePods).add(rinsableSprouts);
//       await doClaimAndDoX([true, true, true], {
//         transferAmount: totalDeposited
//       });
//       const tokenBalance = await getBalances.token();
//       expect(tokenBalance.internal.eq(beanBalancePrev.internal)).toBe(true);
//       expect(tokenBalance.external.eq(beanBalancePrev.external.add(totalDeposited))).toBe(true);
//     });

//     it("claims all then transfers some to external balance", async () => {
//       const totalDeposited = depositValue.add(harvestablePods).add(rinsableSprouts);
//       const transferAmount = totalDeposited.div(2);
//       await doClaimAndDoX([true, true, true], {
//         transferAmount
//       });
//       const tokenBalance = await getBalances.token();
//       expect(tokenBalance.internal.eq(transferAmount)).toBe(true);
//       expect(tokenBalance.external.eq(beanBalancePrev.external.add(transferAmount))).toBe(true);
//     });
//   });

//   describe("claims to internal balance and deposits", () => {
//     let snapshot2: number;
//     // let work: FarmWorkflow;

//     beforeEach(async () => {
//       snapshot2 = await util.snapshot();
//       // For some reason if we don't wait here, there's a race condition that causes the test to fail
//       // await wait();
//       log.orange("[BEFORE EACH]: snapshot taken");
//     });

//     afterEach(async () => {
//       await util.revert(snapshot2);
//       // // For some reason if we don't wait here, there's a race condition that causes the test to fail
//       // await wait();
//       log.orange("[AFTER EACH]: reverted to snapshot...");
//     });

//     it("claim -> deposit [only claimed] BEAN into silo:BEAN", async () => {
//       log.navy("[TEST] 1: - start");
//       const amountIn = depositValue.add(harvestablePods).add(rinsableSprouts);
//       const deposit = getWorkflow.siloDeposit(sdk.tokens.BEAN, sdk.tokens.BEAN, FarmFromMode.INTERNAL_TOLERANT);
//       log.blue("\t[TEST] 1: doing claim and do x...");
//       await doClaimAndDoX([true, true, true], {
//         work: deposit.workflow,
//         amountIn
//       });
//       log.blue("\t[TEST] 1: awaiting balances...");
//       const { siloBalance, tokenBalance } = await getBalances.siloAndToken();
//       log.blue("\t[TEST] 1: retrieved balances...");
//       expect(tokenBalance.internal.eq(beanBalancePrev.internal)).toBe(true);
//       expect(tokenBalance.external.eq(beanBalancePrev.external)).toBe(true);
//       expect(siloBalance.deposited.amount.eq(amountIn)).toBe(true);
//       log.purple("--- [TEST] 1: done!");
//     });
//     it("claim -> deposit [only external] BEAN into silo:BEAN", async () => {
//       log.navy("[TEST] 2: - start");
//       const amountIn = sdk.tokens.BEAN.amount(1_000);

//       const deposit = sdk.silo.buildDeposit(sdk.tokens.BEAN, account);
//       deposit.setInputToken(sdk.tokens.BEAN, FarmFromMode.EXTERNAL);
//       log.blue("\t[TEST] 2: doing claim and do x...");
//       await doClaimAndDoX([true, false, false], {
//         work: deposit.workflow,
//         amountIn
//       });
//       log.blue("\t[TEST] 2: awaiting balances...");
//       const { siloBalance, tokenBalance } = await getBalances.siloAndToken();
//       log.blue("\t[TEST] 2: retrieved balances...");
//       expect(siloBalance.deposited.amount.eq(amountIn)).toBe(true);
//       expect(tokenBalance.internal.eq(beanBalancePrev.internal.add(depositValue))).toBe(true);
//       expect(tokenBalance.external.eq(beanBalancePrev.external.sub(amountIn))).toBe(true);
//       log.purple("--- [TEST] 2: done!");
//     });
//     it("claim -> deposit [claimed + external] BEAN into silo:BEAN", async () => {
//       log.navy("[TEST] 3 - start");
//       const amountIn = sdk.tokens.BEAN.amount(1_000);
//       const totalDeposited = amountIn.add(depositValue);
//       const deposit = getWorkflow.siloDeposit(sdk.tokens.BEAN, sdk.tokens.BEAN, FarmFromMode.INTERNAL_EXTERNAL);
//       log.blue("\t[TEST] 3: doing claim and do x...");
//       await doClaimAndDoX([true, false, false], {
//         work: deposit.workflow,
//         amountIn: totalDeposited
//       });
//       log.blue("\t[TEST] 3: awaiting balances...");
//       const { siloBalance, tokenBalance } = await getBalances.siloAndToken();
//       log.blue("\t[TEST] 3: retrieved balances...");
//       expect(siloBalance.deposited.amount.eq(totalDeposited)).toBe(true);
//       expect(tokenBalance.internal.eq(beanBalancePrev.internal)).toBe(true);
//       expect(tokenBalance.external.eq(beanBalancePrev.external.sub(amountIn))).toBe(true);
//       log.purple("--- [TEST] 3: done!");
//     });
//     it(
//       "claim -> deposit [claimed + external] BEAN into silo:BEAN_CRV3_LP",
//       async () => {
//         log.navy("[TEST] 4 - start");
//         const amountIn = sdk.tokens.BEAN.amount(1_000);
//         const totalAmountIn = amountIn.add(depositValue);

//         const deposit = getWorkflow.siloDeposit(sdk.tokens.BEAN_CRV3_LP, sdk.tokens.BEAN);

//         const estimatedLPOut = await deposit.estimate(totalAmountIn);
//         // 1008 LP
//         log.blue("\t[TEST] 4: doing claim and do x...");
//         await doClaimAndDoX([true, false, false], {
//           work: deposit.workflow,
//           amountIn: totalAmountIn
//         });
//         log.blue("\t[TEST] 4: awaiting balances...");
//         const { siloBalance, tokenBalance } = await getBalances.siloAndToken({ siloToken: sdk.tokens.BEAN_CRV3_LP });
//         log.blue("\t[TEST] 4: retrieved balances...");
//         // use expectWithinBounds because of the slippage
//         expectWithinBounds(siloBalance.deposited.amount, estimatedLPOut);
//         expect(tokenBalance.external.eq(beanBalancePrev.external.sub(amountIn))).toBe(true);
//         log.purple("--- [TEST] 4: - done!");
//       },
//       MAX_TIMEOUT
//     );
//     it(
//       "claim -> transfer some to external -> deposit [claimed + external] BEAN into silo:BEAN",
//       async () => {
//         log.navy("[TEST] 5 - start");
//         const amountIn = sdk.tokens.BEAN.amount(1_000);
//         const totalAmountIn = amountIn.add(rinsableSprouts);
//         const transferAmount = depositValue;

//         const deposit = getWorkflow.siloDeposit(sdk.tokens.BEAN, sdk.tokens.BEAN);
//         log.blue("\t[TEST] 5: doing claim and do x...");
//         await doClaimAndDoX([true, false, true], {
//           work: deposit.workflow,
//           amountIn: totalAmountIn,
//           transferAmount
//         });
//         log.blue("\t[TEST] 5: awaiting balances...");
//         const { siloBalance, tokenBalance } = await getBalances.siloAndToken();
//         log.blue("\t[TEST] 5: retrieved balances...");
//         expect(tokenBalance.internal.eq(beanBalancePrev.internal)).toBe(true);
//         expect(tokenBalance.external.eq(beanBalancePrev.external.add(transferAmount).sub(amountIn))).toBe(true);
//         expect(siloBalance.deposited.amount.eq(totalAmountIn)).toBe(true);
//         log.purple("--- [TEST] 5: - done!");
//       },
//       MAX_TIMEOUT
//     );
//     it.skip(
//       "claim -> transfer to external & deposit ETH into silo:BEAN_CRV3_LP",
//       async () => {
//         log.navy("[TEST] 6 - start");
//         const ethAmountIn = sdk.tokens.ETH.amount(1);
//         const deposit = getWorkflow.siloDeposit(sdk.tokens.BEAN, sdk.tokens.ETH, FarmFromMode.EXTERNAL);
//         const transferAmount = sdk.tokens.BEAN.amount(10);
//         log.blue("\t[TEST] 6: estimating BEAN out...");
//         const estimatedLPOut = await deposit.estimate(ethAmountIn);

//         log.blue("\t[TEST] 6: doing claim and do x...");
//         await doClaimAndDoX([true, false, false], {
//           work: deposit.workflow,
//           amountIn: ethAmountIn
//           // transferAmount
//         });
//         log.blue("\t[TEST] 6: awaiting balances...");
//         const siloBalance = await getBalances.silo(sdk.tokens.BEAN_CRV3_LP);
//         log.blue("\t[TEST] 6: retrivied balances...");
//         // use expectWithinBounds because of the slippage
//         expectWithinBounds(siloBalance.deposited.amount, estimatedLPOut);
//         log.purple("--- [TEST] 6: - done!");
//       },
//       MAX_TIMEOUT
//     );
//   });

//   describe("claims and mints fertilizer", () => {
//     let fertTestSnapshot: number;

//     beforeEach(async () => {
//       fertTestSnapshot = await util.snapshot();
//       await wait();
//     });

//     afterEach(async () => {
//       await util.revert(fertTestSnapshot);
//       await wait();
//     });

//     it.skip("claims and buys fertilizer", async () => {
//       const amountIn = depositValue;

//       const mintWorkflow = await getWorkflow.mintFertilizer(sdk.tokens.BEAN, amountIn, FarmFromMode.INTERNAL);
//       const remainingRecapPrev = await getBeanstalkState.remainingRecapitalization();

//       await doClaimAndDoX([true, false, false], {
//         amountIn: amountIn,
//         work: mintWorkflow
//       });

//       const remainingRecap = await getBeanstalkState.remainingRecapitalization();
//       expect(remainingRecap.eq(remainingRecapPrev.sub(amountIn))).toBe(true);
//     });
//   });

//   describe("claims and sows", () => {
//     let preTestSnapshot: number;
//     let claimAndSowSnapshot: number;
//     let soilRemaining: TokenValue;
//     let temperature: number;
//     let totalPods: TokenValue;

//     beforeAll(async () => {
//       log.yellow("[CLAIM AND SOW][BEFORE ALL] - start");
//       log.yellow("[CLAIM AND SOW][BEFORE ALL] - start");
//       // take snapshot here b/c test may change state of the contract
//       preTestSnapshot = await util.snapshot();
//       const _soil = await sdk.contracts.beanstalk.totalSoil();

//       if (_soil.lt(1)) {
//         log.yellow("\t[CLAIM AND SOW][BEFORE ALL] - soil was less than 1");
//         log.yellow("\t[CLAIM AND SOW][BEFORE ALL] - setting price to 50, 20");
//         await util.setPrice(50, 20);

//         log.yellow("\t[CLAIM AND SOW][BEFORE ALL] - awaiting sunriseForward");
//         await util.sunriseForward();

//         log.yellow("\t[CLAIM AND SOW][BEFORE ALL] - awaiting new data");
//         await Promise.all([sdk.contracts.beanstalk.totalSoil(), sdk.contracts.beanstalk.yield(), sdk.contracts.beanstalk.totalPods()]).then(
//           ([_soilAmount, _temperature, _pods]) => {
//             soilRemaining = sdk.tokens.BEAN.fromBlockchain(_soilAmount);
//             temperature = _temperature;
//             totalPods = sdk.tokens.PODS.fromBlockchain(_pods);
//           }
//         );
//       } else {
//         log.yellow("\t[CLAIM AND SOW][BEFORE ALL] - awaiting new data");
//         soilRemaining = sdk.tokens.BEAN.fromBlockchain(_soil);
//         await Promise.all([sdk.contracts.beanstalk.yield(), sdk.contracts.beanstalk.totalPods()]).then(([_temperature, _pods]) => {
//           temperature = _temperature;
//           totalPods = sdk.tokens.PODS.fromBlockchain(_pods);
//         });
//       }
//       log.yellow("\t[CLAIM AND SOW][BEFORE ALL] - done!");
//     });

//     afterAll(async () => {
//       await util.revert(preTestSnapshot);
//     });

//     beforeEach(async () => {
//       claimAndSowSnapshot = await util.snapshot();
//       // For some reason if we don't wait here, there's a race condition that causes the test to fail
//       await wait();
//       log.orange("[BEFORE EACH]: snapshot taken");
//     });

//     afterEach(async () => {
//       await util.revert(claimAndSowSnapshot);
//       // // For some reason if we don't wait here, there's a race condition that causes the test to fail
//       await wait();
//       log.orange("[AFTER EACH]: reverted to snapshot...");
//     });

//     it(
//       "claims and sows => sow w/ BEAN",
//       async () => {
//         log.navy("[TEST] 7 - start");
//         const sowAmount = soilRemaining.lt(depositValue) ? soilRemaining : depositValue;
//         log.blue("\t[TEST] 7: doing claim and do x...");
//         await doClaimAndDoX([true, false, false], {
//           work: getWorkflow.sow(sdk.tokens.BEAN, FarmFromMode.INTERNAL),
//           amountIn: sowAmount
//         });

//         log.blue("\t[TEST] 7: awaiting balances...");
//         const totalPodsNew = await getBeanstalkState.totalPods();
//         log.blue("\t[TEST] 7: retrieved balances...");
//         const estPodsOut = sowAmount.add(sowAmount.mul(temperature).div(100));
//         expect(totalPodsNew.eq(totalPods.add(estPodsOut))).toBe(true);
//         log.purple("--- [TEST] 7: done!");
//       },
//       MAX_TIMEOUT
//     );
//   });
// });

// async function doClaimAndDoX(
//   [doClaimDeposits, doHarvest, doRinse]: [boolean, boolean, boolean],
//   data?: {
//     work?: FarmWorkflow;
//     amountIn?: TokenValue;
//     transferAmount?: TokenValue;
//   }
// ) {
//   log.green("\t\t[CLAIM AND DO X]: combining workflow...");
//   const op = sdk.farm.create("do-claim-and-do-x");
//   let steps = 0;

//   if (doHarvest) {
//     op.add(getSteps.harvest());
//     steps += 1;
//   }
//   if (doClaimDeposits) {
//     op.add(getSteps.claimDeposited());
//     steps += 1;
//   }
//   if (doRinse) {
//     op.add(getSteps.rinse());
//     steps += 1;
//   }
//   if (data?.transferAmount && data.transferAmount.gt(0)) {
//     op.add(getSteps.localOnly("pre-transfer", data.transferAmount), { onlyLocal: true });
//     op.add(getSteps.transfer());
//     steps += 2;
//   }
//   if (data?.work && data?.amountIn && data.amountIn.gt(0)) {
//     op.add(getSteps.localOnly("pre-x", data.amountIn), { onlyLocal: true });
//     op.add(data.work);
//     steps += 2;
//   }
//   expect(op.generators.length).toEqual(steps);

//   try {
//     log.green("\t\t[CLAIM AND DO X]: estimating...");
//     const est = await op.estimate(data?.amountIn || sdk.tokens.BEAN.amount(0));
//     console.log("est: ", est.toString());
//     log.green("\t\t[CLAIM AND DO X]: executing and awaiting txn confirmation...");
//     const tx = await op.execute(data?.amountIn || sdk.tokens.BEAN.fromHuman("0"), { slippage: 0.1 });

//     log.green("\t\t[CLAIM AND DO X]: txn sent & awaiting completion...");
//     const txn = await tx.wait();

//     log.green("\t\t[CLAIM AND DO X]: txn confirmed & complete!");
//     expect(txn.status).toBeTruthy();
//     expect(txn.status).toBe(1);
//     log.green("\t\t[CLAIM AND DO X]: txn confirmed & complete!");
//     return;
//   } catch (e) {
//     log.red(`\t\t[CLAIM AND DO X]: error!, ${e}`);
//     let message = "do claim and do x error";
//     if (e instanceof Error) {
//       throw e;
//     } else {
//       throw new Error(message);
//     }
//   }
// }

// const getSteps = {
//   localOnly: (name: string, amount: TokenValue) => {
//     return async () => ({
//       name: name,
//       amountOut: amount.toBigNumber(),
//       prepare: () => ({
//         target: "",
//         callData: ""
//       }),
//       decode: () => undefined,
//       decodeResult: () => undefined
//     });
//   },
//   harvest: (to?: FarmToMode): (() => Promise<string>) => {
//     return async () => sdk.contracts.beanstalk.interface.encodeFunctionData("harvest", [[plotId], to ?? FarmToMode.INTERNAL]);
//   },
//   rinse: (to?: FarmToMode): (() => Promise<string>) => {
//     return async () => sdk.contracts.beanstalk.interface.encodeFunctionData("claimFertilized", [[fertilizerId], to ?? FarmToMode.INTERNAL]);
//   },
//   claimDeposited: (to?: FarmToMode): InstanceType<BeanstalkSDK["farm"]["actions"]["ClaimWithdrawals"]> => {
//     return new sdk.farm.actions.ClaimWithdrawals(
//       sdk.tokens.BEAN.address,
//       crates.map((c: Crate<TokenValue>) => c.season.toString()),
//       to || FarmToMode.INTERNAL
//     );
//   },
//   transfer: (params?: { to?: string; token?: Token }): InstanceType<BeanstalkSDK["farm"]["actions"]["TransferToken"]> => {
//     return new sdk.farm.actions.TransferToken(
//       params?.token?.address || sdk.tokens.BEAN.address,
//       params?.to || account,
//       FarmFromMode.INTERNAL,
//       FarmToMode.EXTERNAL
//     );
//   },
//   mintFertilizerWithUSDC: async (usdcAmount: number, fromMode?: FarmFromMode) => {
//     const amount = sdk.tokens.USDC.amount(usdcAmount);
//     // Calculate the amount of underlying LP created when minting
//     // `USDC_AMOUNT` FERT. This holds because 1 FERT = 1 USDC.
//     const minLP = await sdk.contracts.curve.zap.callStatic.calc_token_amount(
//       sdk.contracts.curve.pools.beanCrv3.address,
//       [
//         // 0.866616 is the ratio to add USDC/Bean at such that post-exploit
//         // delta B in the Bean:3Crv pool with A=1 equals the pre-export
//         // total delta B times the haircut. Independent of the haircut %.
//         amount.mul(0.866616).blockchainString, // BEAN
//         0, // DAI,
//         amount.blockchainString, // USDC
//         0 // USDT
//       ],
//       true, // _is_deposit
//       { gasLimit: 10000000 }
//     );

//     const slip = minLP.mul(Math.floor(SLIPPAGE_PRECISION) * (1 - 0.1 / 100)).div(SLIPPAGE_PRECISION);
//     return async () =>
//       sdk.contracts.beanstalk.interface.encodeFunctionData("mintFertilizer", [
//         usdcAmount.toString(),
//         slip,
//         fromMode ?? FarmFromMode.EXTERNAL
//       ]);
//   }
// };

// const getWorkflow = {
//   sow: (tokenIn: Token, _fromMode?: FarmFromMode) => {
//     const sowOperation = sdk.farm.create("sow");
//     let fromMode = _fromMode || FarmFromMode.INTERNAL_EXTERNAL;

//     if (tokenIn.symbol === "ETH") {
//       fromMode = FarmFromMode.INTERNAL_TOLERANT;
//       sowOperation.add(new sdk.farm.actions.WrapEth(FarmToMode.INTERNAL));
//       sowOperation.add(sdk.farm.presets.weth2bean(FarmFromMode.INTERNAL, FarmToMode.INTERNAL));
//     }
//     sowOperation.add(async (amountInStep) => {
//       const calldata = sdk.contracts.beanstalk.interface.encodeFunctionData("sow", [amountInStep, fromMode]);
//       return calldata;
//     });
//     return sowOperation;
//   },
//   siloDeposit: (target: Token, tokenIn: Token, fromMode?: FarmFromMode) => {
//     const deposit = sdk.silo.buildDeposit(target, account);
//     deposit.setInputToken(tokenIn, fromMode);
//     return deposit;
//   },
//   mintFertilizer: async (tokenIn: Token, amount: TokenValue, _fromMode?: FarmFromMode) => {
//     let fromMode = _fromMode || FarmFromMode.INTERNAL_EXTERNAL;
//     const baseWorkflow = sdk.farm.create("mint-fertilizer-flow");
//     let _amount: TokenValue = amount;
//     if (!tokenIn.equals(sdk.tokens.USDC)) {
//       fromMode = FarmFromMode.INTERNAL_TOLERANT;
//       const swapOp = sdk.swap.buildSwap(tokenIn, sdk.tokens.USDC, account, fromMode, FarmToMode.INTERNAL);
//       console.log(swapOp.getDisplay());
//       // build the swap operation
//       _amount = await swapOp.estimate(amount);
//       console.log(`est: [${tokenIn.symbol} => USDC]`, _amount.toHuman());
//       baseWorkflow.add(swapOp.getFarm());
//     }
//     const getMintStep = await getSteps.mintFertilizerWithUSDC(_amount.toBigNumber().toNumber(), fromMode);
//     baseWorkflow.add(getMintStep);

//     return baseWorkflow;
//   }
// };

// const getBeanstalkState = {
//   remainingRecapitalization: async () => {
//     return await sdk.contracts.beanstalk.remainingRecapitalization().then((_pods) => sdk.tokens.PODS.fromBlockchain(_pods));
//   },
//   totalPods: async () => {
//     return await sdk.contracts.beanstalk.totalPods().then((_pods) => sdk.tokens.PODS.fromBlockchain(_pods));
//   }
// };

// const getBalances = {
//   token: async (token?: Token) => {
//     return await sdk.tokens.getBalance(token || sdk.tokens.BEAN, account);
//   },
//   silo: async (token?: Token) => {
//     return await sdk.silo.getBalance(token || sdk.tokens.BEAN, account, { source: DataSource.LEDGER });
//   },
//   siloAndToken: async (data?: { siloToken?: Token; token?: Token }) => {
//     return await Promise.all([
//       sdk.tokens.getBalance(data?.token || sdk.tokens.BEAN, account),
//       sdk.silo.getBalance(data?.siloToken || sdk.tokens.BEAN, account, { source: DataSource.LEDGER })
//     ]).then((result) => ({
//       tokenBalance: result[0],
//       siloBalance: result[1]
//     }));
//   }
// };

// // Find the owner of the 1st plot that has not been harvested and transfer plot to `to`
// // we use the subgraph b/c there is no way to get the owner of the first plot via contract calls
// // returns the plot id of the plot that was transferred
// async function recievePlotTransfer() {
//   try {
//     log.pink("[PLOT TRANSFER]: start!");
//     const testUtils = getTestUtils();
//     await testUtils.utils.resetFork();
//     const queryData = await testUtils.sdk.queries.getUnharvestedPlots({ first: 1 });

//     const plot = queryData.plots[0];
//     log.pink(`\t[PLOT TRANSFER]: plot: ${plot}`);
//     // check that the query returned at least 1 plot
//     expect(queryData.plots.length).toBeGreaterThan(0);

//     const { sdk: tempSdk, stop, utils } = await getTestUtilsWithAccount(plot.farmer.id);
//     await utils.setETHBalance(plot.farmer.id, tempSdk.tokens.ETH.amount(1_000));
//     await wait();

//     log.pink("\t[PLOT TRANSFER]: sending txn...");
//     let tx = await tempSdk.contracts.beanstalk.transferPlot(
//       plot.farmer.id, // from address
//       testUtils.account, // to address
//       plot.index, // index of plot
//       "0", // start
//       plot.pods // end
//     );

//     log.pink("\t[PLOT TRANSFER]: awaiting tx to finish!");
//     let receipt = await tx.wait();
//     expect(receipt.status).toBe(1);
//     await stop();
//     log.pink("\t[PLOT TRANSFER]: finish!");
//     return plot;
//   } catch (err) {
//     log.red(`\t\t[CLAIM AND DO X]: error!, ${err}`);
//     let message = "Unable to retrieve plots from subgraph";
//     if (err instanceof Error) {
//       message += err.message;
//     }
//     throw new Error(message);
//   }
// }

// const wait = (ms?: number) => new Promise((res) => setTimeout(res, ms ?? 500));

// const expectWithinBounds = (amount: TokenValue, expected: TokenValue, buffer?: number) => {
//   buffer = buffer ?? 0.01;
//   if (!amount.eq(expected)) {
//     const [lower, upper] = [expected.mul(1 - buffer), expected.mul(1 + buffer)];
//     expect(amount.gte(lower) && amount.lte(upper));
//   }
// };

// const hexCodes = {
//   red: "#FF321A",
//   orange: "#FF901B",
//   pink: "#E200F7",
//   blue: "#450EFF",
//   cyan: "04EEFF",
//   yellow: "F5F232",
//   navy: "220070",
//   green: "04D435",
//   purple: "#83018E"
// };

// const _print = (msg: string, _color: keyof typeof hexCodes) => {
//   const _fn = () => {
//     if (_color === "navy" || _color === "purple") {
//       return chalk.bgHex(hexCodes[_color]).grey;
//     }
//     return chalk.hex(hexCodes[_color]);
//   };
//   const fn = _fn();
//   console.log(fn(msg));
// };

// const log = {
//   red: (msg: string) => _print(msg, "red"),
//   orange: (msg: string) => _print(msg, "orange"),
//   pink: (msg: string) => _print(msg, "pink"),
//   blue: (msg: string) => _print(msg, "blue"),
//   cyan: (msg: string) => _print(msg, "cyan"),
//   yellow: (msg: string) => _print(msg, "yellow"),
//   green: (msg: string) => _print(msg, "green"),
//   navy: (msg: string) => _print(msg, "navy"),
//   purple: (msg: string) => _print(msg, "purple")
// };
