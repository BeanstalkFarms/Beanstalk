import {
  BeanstalkSDK,
  FarmToMode,
  FarmWorkflow,
  StepGenerator,
  Token,
  TokenSiloBalance,
  TokenValue,
} from '@beanstalk/sdk';

import { ethers } from 'ethers';
import BigNumber from 'bignumber.js';
import { DepositCrate } from '../state/farmer/silo';
import { TokenMap } from '../constants';

export enum FormTxn {
  MOW = 'MOW',
  PLANT = 'PLANT',
  ENROOT = 'ENROOT',
  HARVEST = 'HARVEST',
  RINSE = 'RINSE',
  CLAIM = 'CLAIM',
}

export type FormTxnActions = {
  getSteps: () => StepGenerator[];
  estimateGas: () => Promise<ethers.BigNumber>;
};

export type FormTxnParamsMap = {
  [FormTxn.RINSE]: { tokenIds: string[]; toMode?: FarmToMode };
  [FormTxn.HARVEST]: { plotIds: string[]; toMode?: FarmToMode };
  [FormTxn.CLAIM]: { seasons: string[]; toMode?: FarmToMode };
  [FormTxn.MOW]: { account: string };
  [FormTxn.PLANT]: {};
  [FormTxn.ENROOT]: { crates: Record<string, DepositCrate[]> };
};

export type FormTxnFunction<T extends FormTxn> = (
  sdk: BeanstalkSDK,
  args: FormTxnParamsMap[T]
) => FormTxnActions;

export type FormTxnBuilderInterface = {
  preset: keyof typeof FormTxnBuilderPresets;
  /**
   * actions that are required to be performed BEFORE the main action of the form
   */
  primary: FormTxn[] | undefined;
  /**
   * actions that have no effect on the main action of the form
   */
  secondary: FormTxn[] | undefined;
  /**
   * actions implied by main action of the form
   * e.g. if the main action is Deposit, 'Mow' is performed automatically
   */
  implied?: FormTxn[];
  /**
   * actions to exclude from the options
   */
  exclude?: FormTxn[];
};

export const FormTxnBuilderPresets: {
  [key: string]: {
    primary: FormTxn[];
    secondary: FormTxn[];
  };
} = {
  claim: {
    primary: [FormTxn.RINSE, FormTxn.HARVEST, FormTxn.CLAIM],
    secondary: [FormTxn.MOW, FormTxn.PLANT, FormTxn.ENROOT],
  },
  enroot: {
    primary: [FormTxn.ENROOT],
    secondary: [
      FormTxn.MOW,
      FormTxn.PLANT,
      FormTxn.RINSE,
      FormTxn.HARVEST,
      FormTxn.CLAIM,
    ],
  },
  rinseHarvest: {
    primary: [FormTxn.RINSE, FormTxn.HARVEST],
    secondary: [FormTxn.MOW, FormTxn.PLANT, FormTxn.ENROOT, FormTxn.CLAIM],
  },
  plant: {
    primary: [FormTxn.PLANT],
    secondary: [
      FormTxn.MOW,
      FormTxn.ENROOT,
      FormTxn.RINSE,
      FormTxn.HARVEST,
      FormTxn.CLAIM,
    ],
  },
  noPrimary: {
    primary: [],
    secondary: [
      FormTxn.MOW,
      FormTxn.PLANT,
      FormTxn.ENROOT,
      FormTxn.RINSE,
      FormTxn.HARVEST,
      FormTxn.CLAIM,
    ],
  },
};

export class FormTxnBuilder {
  private static harvest: FormTxnFunction<FormTxn.HARVEST> = (sdk, params) => {
    const { toMode, plotIds } = params;

    const { beanstalk } = sdk.contracts;

    const step: StepGenerator = async (amountInStep) => ({
      name: 'harvest',
      amountOut: amountInStep,
      prepare: () => ({
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('harvest', [
          plotIds,
          toMode || FarmToMode.INTERNAL,
        ]),
      }),
      decode: (data: string) =>
        beanstalk.interface.decodeFunctionData('harvest', data),
      decodeResult: (result: string) =>
        beanstalk.interface.decodeFunctionResult('harvest', result),
    });

    return {
      getSteps: () => [step],
      estimateGas: () =>
        beanstalk.estimateGas.harvest(plotIds, toMode || FarmToMode.INTERNAL),
    };
  };

  private static rinse: FormTxnFunction<FormTxn.RINSE> = (sdk, params) => {
    const { toMode, tokenIds } = params;

    const { beanstalk } = sdk.contracts;

    const step: StepGenerator = async (amountInStep) => ({
      name: 'claimFertilized',
      amountOut: amountInStep,
      prepare: () => ({
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('claimFertilized', [
          tokenIds,
          toMode || FarmToMode.INTERNAL,
        ]),
      }),
      decode: (data: string) =>
        beanstalk.interface.decodeFunctionData('claimFertilized', data),
      decodeResult: (result: string) =>
        beanstalk.interface.decodeFunctionResult('claimFertilized', result),
    });

    return {
      getSteps: () => [step],
      estimateGas: () =>
        beanstalk.estimateGas.claimFertilized(
          tokenIds,
          toMode || FarmToMode.INTERNAL
        ),
    };
  };

  private static claim: FormTxnFunction<FormTxn.CLAIM> = (sdk, params) => {
    const { toMode, seasons } = params;

    const { beanstalk } = sdk.contracts;
    const { BEAN } = sdk.tokens;

    let step: StepGenerator;
    let estimateGas: () => Promise<ethers.BigNumber>;

    if (seasons.length === 1) {
      step = new sdk.farm.actions.ClaimWithdrawal(
        sdk.tokens.BEAN.address,
        seasons[0],
        toMode || FarmToMode.INTERNAL
      );
      estimateGas = () =>
        beanstalk.estimateGas.claimWithdrawal(
          BEAN.address,
          seasons[0],
          toMode || FarmToMode.INTERNAL
        );
    } else {
      step = new sdk.farm.actions.ClaimWithdrawals(
        sdk.tokens.BEAN.address,
        seasons,
        toMode || FarmToMode.INTERNAL
      );
      estimateGas = () =>
        beanstalk.estimateGas.claimWithdrawals(
          BEAN.address,
          seasons,
          toMode || FarmToMode.INTERNAL
        );
    }

    return {
      getSteps: () => [step],
      estimateGas,
    };
  };

  private static mow: FormTxnFunction<FormTxn.MOW> = (sdk, params) => {
    const { account } = params;
    const { beanstalk } = sdk.contracts;
    const step: StepGenerator = async (_amountInStep) => ({
      name: 'update',
      amountOut: _amountInStep,
      prepare: () => ({
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('update', [account]),
      }),
      decode: (data: string) =>
        beanstalk.interface.decodeFunctionData('update', data),
      decodeResult: (result: string) =>
        beanstalk.interface.decodeFunctionResult('update', result),
    });

    return {
      getSteps: () => [step],
      estimateGas: () => beanstalk.estimateGas.update(account),
    };
  };

  private static plant: FormTxnFunction<FormTxn.PLANT> = (sdk) => {
    const { beanstalk } = sdk.contracts;
    const step: StepGenerator = async (_amountInStep: ethers.BigNumber) => ({
      name: 'plant',
      amountOut: _amountInStep,
      prepare: () => ({
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('plant', undefined),
      }),
      decode: (data: string) =>
        beanstalk.interface.decodeFunctionData('plant', data),
      decodeResult: (result: string) =>
        beanstalk.interface.decodeFunctionResult('plant', result),
    });

    return {
      getSteps: () => [step],
      estimateGas: () => beanstalk.estimateGas.plant(),
    };
  };

  private static enroot: FormTxnFunction<FormTxn.ENROOT> = (sdk, params) => {
    const { crates: _crates } = params;

    const { beanstalk } = sdk.contracts;
    const steps: StepGenerator[] = [];
    const callData: string[] = [];

    [...sdk.tokens.unripeTokens].forEach((urToken) => {
      const crates = _crates[urToken.address];
      if (crates?.length === 1) {
        const encoded = beanstalk.interface.encodeFunctionData(
          'enrootDeposit',
          [
            urToken.address,
            crates[0].season.toString(),
            urToken.fromHuman(crates[0].amount.toString()).toBlockchain(),
          ]
        );

        callData.push(encoded);
        steps.push(async (_amountInStep, _context) => ({
          name: 'enrootDeposit',
          amountOut: _amountInStep,
          prepare: () => ({
            target: beanstalk.address,
            callData: encoded,
          }),
          decode: (data: string) =>
            beanstalk.interface.decodeFunctionData('enrootDeposit', data),
          decodeResult: (result: string) =>
            beanstalk.interface.decodeFunctionResult('enrootDeposit', result),
        }));
      } else if (crates?.length > 1) {
        const encoded = beanstalk.interface.encodeFunctionData(
          'enrootDeposits',
          [
            urToken.address,
            crates.map((crate) => crate.season.toString()),
            crates.map((crate) =>
              urToken.fromHuman(crate.amount.toString()).toBlockchain()
            ),
          ]
        );

        callData.push(encoded);
        steps.push(async (amountInStep, _context) => ({
          name: 'enrootDeposits',
          amountOut: amountInStep,
          prepare: () => ({
            target: beanstalk.address,
            callData: encoded,
          }),
          decode: (data: string) =>
            beanstalk.interface.decodeFunctionData('enrootDeposits', data),
          decodeResult: (result: string) =>
            beanstalk.interface.decodeFunctionResult('enrootDeposits', result),
        }));
      }
    });

    return {
      getSteps: () => steps,
      estimateGas: () => beanstalk.estimateGas.farm([...callData]),
    };
  };

  private static implied: { [key in FormTxn]: FormTxn[] | undefined } = {
    [FormTxn.ENROOT]: [FormTxn.MOW],
    [FormTxn.PLANT]: [FormTxn.MOW],
    [FormTxn.MOW]: undefined,
    [FormTxn.CLAIM]: undefined,
    [FormTxn.RINSE]: undefined,
    [FormTxn.HARVEST]: undefined,
  };

  private static functionMap: { [key in FormTxn]: FormTxnFunction<key> } = {
    [FormTxn.MOW]: FormTxnBuilder.mow,
    [FormTxn.PLANT]: FormTxnBuilder.plant,
    [FormTxn.ENROOT]: FormTxnBuilder.enroot,
    [FormTxn.RINSE]: FormTxnBuilder.rinse,
    [FormTxn.HARVEST]: FormTxnBuilder.harvest,
    [FormTxn.CLAIM]: FormTxnBuilder.claim,
  };

  /**
   *
   * @param step
   * @returns FormTxnFunction for 'step'.
   *  - getSteps: () => StepGenerator[]
   *  - estimateGas: () => Promise<ethers.BigNumber>
   */
  static getFunction<T extends FormTxn>(step: T): FormTxnFunction<T> {
    return FormTxnBuilder.functionMap[step];
  }

  /**
   *
   * @param step
   * @returns the implicit actions that are performed by including 'step' in a Farm call.
   * (e.g. claiming Silo withdrawals implies that mow will also be performed)
   */
  static getImplied(step: FormTxn): FormTxn[] | undefined {
    return FormTxnBuilder.implied[step];
  }

  /**
   * compiles all actions into a ready-to-execute Workflow
   *
   * @param sdk
   * @param data
   * @param getGenerators
   * @param operation
   * @param amountIn
   * @param slippage
   */
  static async compile(
    sdk: BeanstalkSDK,
    data: FormTxnBuilderInterface, // form data
    getGenerators: (action: FormTxn) => StepGenerator[],
    operation: FarmWorkflow | StepGenerator[],
    _amountIn: TokenValue | undefined,
    slippage: number
  ) {
    const primary = new Set(data.primary || []);
    const secondary = new Set(data.secondary || []);
    const allActions = new Set([...primary, ...secondary]);

    /// deduplicate
    // if an action is in both primary and secondary, remove it from secondary
    [...primary].forEach((action) => {
      secondary.has(action) && secondary.delete(action);
    });

    /// deduplicate implied actions
    [...allActions].forEach((action) => {
      FormTxnBuilder.implied[action]?.forEach((implied) => {
        allActions.has(implied) && allActions.delete(implied);
        primary.has(implied) && primary.delete(implied);
        secondary.has(implied) && secondary.delete(implied);
      });
    });
    const removeItems = [...(data.exclude || []), ...(data.implied || [])];

    removeItems.forEach((toRemove) => {
      allActions.has(toRemove) && allActions.delete(toRemove);
      primary.has(toRemove) && primary.delete(toRemove);
      secondary.has(toRemove) && secondary.delete(toRemove);
    });

    const farm = sdk.farm.create();

    const getSteps = (actions?: Set<FormTxn>) => {
      let generators: StepGenerator[] = [];
      [...(actions || [])]?.forEach((action) => {
        generators = [...generators, ...getGenerators(action)];
      });
      return generators;
    };

    farm.add([
      ...getSteps(primary),
      ...(operation instanceof FarmWorkflow ? operation.generators : operation),
      ...getSteps(secondary),
    ]);

    const amountIn = _amountIn || TokenValue.ZERO;
    const estimate = await farm.estimate(amountIn);

    const execute = () => farm.execute(amountIn, { slippage });

    return {
      performed: [...allActions],
      workflow: farm,
      estimate,
      execute,
    };
  }

  /// -------------------------------------------------------
  /// ----------------- Conveinence Methods -----------------
  /// -------------------------------------------------------

  static async makePlantCrate(
    sdk: BeanstalkSDK,
    account: string,
    _earnedBeans?: TokenValue
  ) {
    const { BEAN, STALK } = sdk.tokens;
    const { beanstalk } = sdk.contracts;

    const [_season, earnedBeans] = await Promise.all([
      sdk.sun.getSeason(),
      _earnedBeans
        ? Promise.resolve(_earnedBeans)
        : beanstalk
            .balanceOfEarnedBeans(account)
            .then((result) => sdk.tokens.BEAN.fromBlockchain(result)),
    ]);

    const seeds = BEAN.getSeeds(earnedBeans);
    const stalk = BEAN.getStalk(earnedBeans);
    const grownStalk = STALK.amount(0);

    const crate = {
      season: ethers.BigNumber.from(_season),
      amount: earnedBeans,
      bdv: earnedBeans,
      stalk,
      baseStalk: stalk,
      grownStalk,
      seeds,
    };

    return {
      canPlant: earnedBeans.gt(0),
      amount: earnedBeans,
      crate,
    };
  }

  /**
   * picks the crates that should be enrooted
   * @param sdk
   * @param siloBalances
   * @returns
   */
  static async pickUnripeCratesForEnroot(
    sdk: BeanstalkSDK,
    siloBalances: Map<Token, TokenSiloBalance>
  ) {
    const { UNRIPE_BEAN, UNRIPE_BEAN_CRV3 } = sdk.tokens;

    const [urBeanBDV, urBeanCRV3BDV] = await Promise.all([
      sdk.bean.getBDV(UNRIPE_BEAN, UNRIPE_BEAN.amount(1)),
      sdk.bean.getBDV(UNRIPE_BEAN_CRV3, UNRIPE_BEAN_CRV3.amount(1)),
    ]);

    const urCrates = [...sdk.tokens.unripeTokens].reduce<
      TokenMap<DepositCrate[]>
    >((prev, token) => {
      const balance = siloBalances.get(token);
      const depositCrates = balance?.deposited.crates || [];
      const bdv = token.equals(UNRIPE_BEAN) ? urBeanBDV : urBeanCRV3BDV;

      prev[token.address] = [...depositCrates]
        .filter((crate) => bdv.mul(crate.amount).gt(crate.bdv))
        .map((crate) => ({
          bdv: new BigNumber(crate.bdv.toHuman()),
          amount: new BigNumber(crate.amount.toHuman()),
          season: new BigNumber(crate.season.toString()),
          stalk: new BigNumber(crate.stalk.toHuman()),
          seeds: new BigNumber(crate.seeds.toHuman()),
        }));

      return prev;
    }, {});

    return urCrates;
  }
}
