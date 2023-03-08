import {
  BeanstalkSDK,
  FarmToMode,
  TokenValue,
  FarmWorkflow,
  StepGenerator,
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

export type ClaimPlantActionable = {
  steps: StepGenerator[];
  estimateGas: () => Promise<ethers.BigNumber>;
};

type ClaimBeansParams<T> = {
  amount?: TokenValue;
  toMode?: FarmToMode;
} & T;

export type ClaimPlantActionParamMap = {
  [ClaimPlantAction.HARVEST]: ClaimBeansParams<{ plotIds: string[] }>;
  [ClaimPlantAction.CLAIM]: ClaimBeansParams<{ seasons: string[] }>;
  [ClaimPlantAction.RINSE]: ClaimBeansParams<{ tokenIds: string[] }>;
  [ClaimPlantAction.MOW]: { account: string };
  [ClaimPlantAction.PLANT]: {};
  [ClaimPlantAction.ENROOT]: { crates: { [addr: string]: DepositCrate[] } };
};

export type ClaimPlantActionMap = {
  [action in ClaimPlantAction]: (
    ...params: Partial<ClaimPlantActionParamMap[action]>[]
  ) => ClaimPlantActionable;
};

export type ClaimPlantActionDataMap = Partial<{
  [action in ClaimPlantAction]: ClaimPlantActionable;
}>;

export type ClaimPlantFunction<T extends ClaimPlantAction> = (
  sdk: BeanstalkSDK,
  ...parameters: ClaimPlantActionParamMap[T][]
) => ClaimPlantActionable;

const harvest: ClaimPlantFunction<ClaimPlantAction.HARVEST> = (sdk, params) => {
  const { plotIds, amount, toMode } = params;
  const { beanstalk } = sdk.contracts;

  const step: StepGenerator = async (_amountInStep) => ({
    name: 'harvest',
    amountOut: amount?.toBigNumber() || _amountInStep,
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
    steps: [step],
    estimateGas: () =>
      beanstalk.estimateGas.harvest(plotIds, toMode || FarmToMode.INTERNAL),
  };
};

const claim: ClaimPlantFunction<ClaimPlantAction.CLAIM> = (sdk, params) => {
  const { seasons, toMode } = params;
  const { beanstalk } = sdk.contracts;
  const { BEAN } = sdk.tokens;
  const steps: StepGenerator[] = [];
  let estimateGas: () => Promise<ethers.BigNumber>;

  if (seasons.length === 1) {
    steps.push(
      new sdk.farm.actions.ClaimWithdrawal(
        sdk.tokens.BEAN.address,
        seasons[0],
        toMode || FarmToMode.INTERNAL
      )
    );
    estimateGas = () =>
      beanstalk.estimateGas.claimWithdrawal(
        BEAN.address,
        seasons[0],
        toMode || FarmToMode.INTERNAL
      );
  } else {
    steps.push(
      new sdk.farm.actions.ClaimWithdrawals(
        sdk.tokens.BEAN.address,
        seasons,
        toMode || FarmToMode.INTERNAL
      )
    );
    estimateGas = () =>
      beanstalk.estimateGas.claimWithdrawals(
        BEAN.address,
        seasons,
        toMode || FarmToMode.INTERNAL
      );
  }

  return {
    steps,
    estimateGas,
  };
};

const rinse: ClaimPlantFunction<ClaimPlantAction.RINSE> = (sdk, params) => {
  const { tokenIds, amount, toMode } = params;
  const { beanstalk } = sdk.contracts;

  const steps: StepGenerator[] = [];
  steps.push(async (_amountInStep) => ({
    name: 'claimFertilized',
    amountOut: amount?.toBigNumber() || _amountInStep,
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
  }));

  return {
    steps,
    estimateGas: () =>
      beanstalk.estimateGas.claimFertilized(
        tokenIds,
        toMode || FarmToMode.INTERNAL
      ),
  };
};

const mow: ClaimPlantFunction<ClaimPlantAction.MOW> = (sdk, params) => {
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
    steps: [step],
    estimateGas: () => beanstalk.estimateGas.update(account),
  };
};

const plant: ClaimPlantFunction<ClaimPlantAction.PLANT> = (sdk) => {
  const { beanstalk } = sdk.contracts;
  const steps: StepGenerator[] = [];

  steps.push(async (_amountInStep: ethers.BigNumber) => ({
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
  }));
  return {
    steps,
    estimateGas: () => beanstalk.estimateGas.plant(),
  };
};

const enroot: ClaimPlantFunction<ClaimPlantAction.ENROOT> = (sdk, params) => {
  const { crates: _crates } = params;
  const { beanstalk } = sdk.contracts;
  const steps: StepGenerator[] = [];
  const callData: string[] = [];

  [...sdk.tokens.unripeTokens].forEach((urToken) => {
    const crates = _crates[urToken.address];
    if (crates?.length === 1) {
      const encoded = beanstalk.interface.encodeFunctionData('enrootDeposit', [
        urToken.address,
        crates[0].season.toString(),
        urToken.fromHuman(crates[0].amount.toString()).toBlockchain(),
      ]);

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
      const encoded = beanstalk.interface.encodeFunctionData('enrootDeposits', [
        urToken.address,
        crates.map((crate) => crate.season.toString()),
        crates.map((crate) =>
          urToken.fromHuman(crate.amount.toString()).toBlockchain()
        ),
      ]);

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
    steps,
    estimateGas: () => beanstalk.estimateGas.farm([...callData]),
  };
};

export type ClaimPlantResult = {
  estimate: ethers.BigNumber;
  execute: () => Promise<ethers.ContractTransaction>;
  actionsPerformed: Set<ClaimPlantAction>;
};

export const ClaimPlantFormPresets: {
  [key: string]: {
    options: ClaimPlantAction[],
    additional: ClaimPlantAction[],
    required: ClaimPlantAction[],
  }
}  = {
  claimBeans: {
    options: [
      ClaimPlantAction.RINSE,
      ClaimPlantAction.HARVEST,
      ClaimPlantAction.CLAIM,
    ],
    additional: [
      ClaimPlantAction.MOW,
      ClaimPlantAction.PLANT,
      ClaimPlantAction.ENROOT,
    ],
    required: [ClaimPlantAction.MOW],
  },
  rinseAndHarvest: {
    options: [ClaimPlantAction.RINSE, ClaimPlantAction.HARVEST],
    additional: [
      ClaimPlantAction.MOW,
      ClaimPlantAction.PLANT,
      ClaimPlantAction.ENROOT,
      ClaimPlantAction.CLAIM,
    ],
    required: [ClaimPlantAction.MOW],
  },
  plant: {
    options: [ClaimPlantAction.PLANT],
    additional: [
      ClaimPlantAction.MOW,
      ClaimPlantAction.ENROOT,
      ClaimPlantAction.RINSE,
      ClaimPlantAction.HARVEST,
      ClaimPlantAction.CLAIM,
    ],
    required: [],
  },
  none: {
    options: [],
    additional: [
      ClaimPlantAction.MOW,
      ClaimPlantAction.PLANT,
      ClaimPlantAction.ENROOT,
      ClaimPlantAction.RINSE,
      ClaimPlantAction.HARVEST,
      ClaimPlantAction.CLAIM,
    ],
    required: []
  }
};

// -------------------------------------------------------------------------

export class ClaimPlantAggregator {
  static implied: {
    [ClaimPlantAction.ENROOT]: [ClaimPlantAction.MOW],
    [ClaimPlantAction.PLANT]: [ClaimPlantAction.MOW],
    [ClaimPlantAction.MOW]: undefined,
    [ClaimPlantAction.CLAIM]: [ClaimPlantAction.MOW],
    [ClaimPlantAction.RINSE]: undefined,
    [ClaimPlantAction.HARVEST]: undefined,
  };

  static mow: ClaimPlantFunction<ClaimPlantAction.MOW> = (sdk, params) => {
    const { beanstalk } = sdk.contracts;
    const { account } = params;
  
    const step: StepGenerator = async (_amountInStep) => ({
      name: 'update',
      amountOut: _amountInStep,
      prepare: () => ({
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('update', [account]),
      }),
      decode: (data: string) => beanstalk.interface.decodeFunctionData('update', data),
      decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('update', result),
    });
  
    return {
      steps: [step],
      estimateGas: () => beanstalk.estimateGas.update(account),
    };
  };

  static plant: ClaimPlantFunction<ClaimPlantAction.PLANT> = (sdk) => {
    const { beanstalk } = sdk.contracts;
    const steps: StepGenerator[] = [];

    steps.push(async (_amountInStep: ethers.BigNumber) => ({
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
      steps,
      estimateGas: () => beanstalk.estimateGas.plant(),
    };
  };

  static enroot: ClaimPlantFunction<ClaimPlantAction.ENROOT> = (sdk, params) => {
    const { crates: _crates } = params;
    const { beanstalk } = sdk.contracts;
    const steps: StepGenerator[] = [];
    const callData: string[] = [];
  
    [...sdk.tokens.unripeTokens].forEach((urToken) => {
      const crates = _crates[urToken.address];
      if (crates?.length === 1) {
        const encoded = beanstalk.interface.encodeFunctionData('enrootDeposit', [
          urToken.address,
          crates[0].season.toString(),
          urToken.fromHuman(crates[0].amount.toString()).toBlockchain(),
        ]);
  
        callData.push(encoded);
        steps.push(
          async (_amountInStep, _context) => ({
            name: 'enrootDeposit',
            amountOut: _amountInStep,
            prepare: () => ({
              target: beanstalk.address,
              callData: encoded,
            }),
            decode: (data: string) => beanstalk.interface.decodeFunctionData('enrootDeposit', data),
            decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('enrootDeposit', result),
          })
        );
      } else if (crates?.length > 1) {
        const encoded = beanstalk.interface.encodeFunctionData('enrootDeposits', [
          urToken.address,
          crates.map((crate) => crate.season.toString()),
          crates.map((crate) => urToken.fromHuman(crate.amount.toString()).toBlockchain()),
        ]);
  
        callData.push(encoded);
        steps.push(
          async (amountInStep, _context) => ({
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
          })
        );
      }
    });
  
    return {
      steps,
      estimateGas: () => beanstalk.estimateGas.farm([...callData]),
    };
  };

  static rinse: ClaimPlantFunction<ClaimPlantAction.RINSE> = (sdk, params) => {
    const { tokenIds, amount, toMode } = params;
    const { beanstalk } = sdk.contracts;

    const step: StepGenerator = async (_amountInStep) => ({
      name: 'claimFertilized',
      amountOut: amount?.toBigNumber() || _amountInStep,
      prepare: () => ({
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('claimFertilized', [
          tokenIds,
          toMode || FarmToMode.INTERNAL,
        ]),
      }),
      decode: (data: string) => beanstalk.interface.decodeFunctionData('claimFertilized', data),
      decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('claimFertilized', result),
    });

    return { 
      steps: [step], 
      estimateGas: () => beanstalk.estimateGas.claimFertilized(tokenIds, toMode || FarmToMode.INTERNAL)
    };
  };

  static harvest: ClaimPlantFunction<ClaimPlantAction.HARVEST> = (sdk, params) => {
    const { plotIds, amount, toMode } = params;
    const { beanstalk } = sdk.contracts;
  
    const step: StepGenerator = async (_amountInStep) => ({
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
    });
  
    return {
      steps: [step],
      estimateGas: () => beanstalk.estimateGas.harvest(plotIds, toMode || FarmToMode.INTERNAL),
    };
  };

  static claim: ClaimPlantFunction<ClaimPlantAction.CLAIM> = (sdk, params) => {
    const { seasons, toMode } = params;
    const { beanstalk } = sdk.contracts;
    const { BEAN } = sdk.tokens;
  
    if (seasons.length === 1) {
      const step = new sdk.farm.actions.ClaimWithdrawal(
        sdk.tokens.BEAN.address,
        seasons[0],
        toMode || FarmToMode.INTERNAL
      );

      return {
        steps: [step],
        estimateGas: () => beanstalk.estimateGas.claimWithdrawal(
          BEAN.address, 
          seasons[0], 
          toMode || FarmToMode.INTERNAL
        ) 
      };
    }

    const step = new sdk.farm.actions.ClaimWithdrawals(
      sdk.tokens.BEAN.address,
      seasons,
      toMode || FarmToMode.INTERNAL
    );

    return {
      steps: [step],
      estimateGas: () => beanstalk.estimateGas.claimWithdrawals(
        BEAN.address,
        seasons,
        toMode || FarmToMode.INTERNAL
      )
    };
  }
}

class ClaimPlant {
  private static actionsMap: {
    [key in ClaimPlantAction]: ClaimPlantFunction<key>;
  } = {
    [ClaimPlantAction.RINSE]: rinse,
    [ClaimPlantAction.HARVEST]: harvest,
    [ClaimPlantAction.CLAIM]: claim,
    [ClaimPlantAction.MOW]: mow,
    [ClaimPlantAction.PLANT]: plant,
    [ClaimPlantAction.ENROOT]: enroot,
  };

  static getAction(action: ClaimPlantAction) {
    return ClaimPlant.actionsMap[action] as ClaimPlantFunction<typeof action>;
  }

  static presets = {
    rinseAndHarvest: [ClaimPlantAction.RINSE, ClaimPlantAction.HARVEST],
    claimBeans: [
      ClaimPlantAction.RINSE,
      ClaimPlantAction.HARVEST,
      ClaimPlantAction.CLAIM,
    ],
    plant: [ClaimPlantAction.PLANT],
    none: [],
  };

  static config = {
    implied: {
      [ClaimPlantAction.ENROOT]: [ClaimPlantAction.MOW],
      [ClaimPlantAction.PLANT]: [ClaimPlantAction.MOW],
      [ClaimPlantAction.MOW]: undefined,
      [ClaimPlantAction.CLAIM]: [ClaimPlantAction.MOW],
      [ClaimPlantAction.RINSE]: undefined,
      [ClaimPlantAction.HARVEST]: undefined,
    },
  };

  static deduplicate(
    primaryActions: ClaimPlantActionDataMap,
    _secondaryActions: ClaimPlantActionDataMap,
    filterMow?: boolean
  ) {
    const actionsPerformed = new Set<ClaimPlantAction>([
      ...Object.keys(primaryActions),
      ...Object.keys(_secondaryActions),
    ] as ClaimPlantAction[]);

    /// --- Deduplicate actions ---
    // If the same action exists in both primary and secondary, we use the one in primary
    const temp = new Set<ClaimPlantAction>();
    Object.keys(_secondaryActions).forEach((key) =>
      temp.add(key as ClaimPlantAction)
    );
    Object.keys(primaryActions).forEach((key) => {
      if (temp.has(key as ClaimPlantAction)) {
        temp.delete(key as ClaimPlantAction);
      }
    });
    const secondaryActions = [...temp].reduce<ClaimPlantActionDataMap>(
      (prev, curr) => {
        prev[curr] = _secondaryActions[curr];
        return prev;
      },
      {}
    );

    /**
     * Make sure that if we are calling 'enroot' or 'plant', we are not also calling mow.
     * 'Mow' is executed by default if enrooting or planting on the contract side.
     */
    const enrooting =
      ClaimPlantAction.ENROOT in primaryActions ||
      ClaimPlantAction.ENROOT in secondaryActions;
    const planting =
      ClaimPlantAction.PLANT in primaryActions ||
      ClaimPlantAction.PLANT in secondaryActions;
    const claimingWithdrawals =
      ClaimPlantAction.CLAIM in primaryActions ||
      ClaimPlantAction.CLAIM in secondaryActions;

    if (enrooting || planting || claimingWithdrawals || filterMow) {
      if (ClaimPlantAction.MOW in primaryActions) {
        delete primaryActions[ClaimPlantAction.MOW];
      }
      if (ClaimPlantAction.MOW in secondaryActions) {
        delete secondaryActions[ClaimPlantAction.MOW];
      }
      actionsPerformed.delete(ClaimPlantAction.MOW);
    }

    return {
      primaryActions,
      secondaryActions,
      actionsPerformed,
    };
  }

  static async buidl(
    sdk: BeanstalkSDK,
    primary: StepGenerator[],
    secondary: StepGenerator[],
    operation: FarmWorkflow,
    amountIn: TokenValue,
    options: {
      slippage: number;
      value?: ethers.BigNumber;
    }
  ) {
    const farm = sdk.farm.create();

    secondary.forEach((action) => {
      farm.add(action);
    });
    primary.forEach((action) => {
      farm.add(action);
    });

    farm.add([...operation.generators]);

    const estimate = await farm.estimate(amountIn);

    const summary = farm.summarizeSteps();
    const mapped = summary.map((step) => ({
      name: step.name,
      amountOut: step.amountOut.toString(),
    }));
    console.debug('[ClaimPlant][summary]', mapped);
    console.debug('[ClaimPlant][generators]', farm.generators);

    const execute = () => farm.execute(amountIn, options);

    return {
      estimate,
      execute,
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
      slippage: number;
      value?: ethers.BigNumber;
    },
    /**
     * If true, mow action will be filtered out.
     * this should be true for any operation that already calls mow on the contract side i.e. Silo Deposit
     */
    filterMow?: boolean
  ): Promise<ClaimPlantResult> {
    const deduplicated = ClaimPlant.deduplicate(
      _primaryActions,
      _secondaryActions,
      filterMow
    );
    const { primaryActions, secondaryActions, actionsPerformed } = deduplicated;
    /// --- Construct workflow ---
    const farm = sdk.farm.create();

    const primary = Object.values(primaryActions);
    primary.forEach(({ steps }) => {
      farm.add(steps);
    });
    farm.add([...operation.generators]);

    Object.values(secondaryActions).forEach(({ steps }) => {
      farm.add(steps);
    });

    const estimate = await farm.estimate(amountIn);

    const summary = farm.summarizeSteps();
    const mapped = summary.map((step) => ({
      name: step.name,
      amountOut: step.amountOut.toString(),
    }));
    console.debug('[ClaimPlant][summary]', mapped);
    console.debug('[ClaimPlant][generators]', farm.generators);

    const execute = () => farm.execute(amountIn, options);

    return {
      estimate,
      execute,
      actionsPerformed,
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

  // static getStepGenerator(
  //   name: string,
  //   fn: (amountInStep: ethers.BigNumber) => ethers.BigNumber,
  // ): StepGenerator {

  // }
}

export default ClaimPlant;
