import { BeanstalkSDK, TokenValue } from '@beanstalk/sdk';
import { MayArray } from '~/types';

import Strategies from '~/lib/Txn/strategies';
import { FarmStepStrategy, StepsWithOptions } from '~/lib/Txn/Strategy';
import { MowStrategy } from '~/lib/Txn/strategies/silo/MowStrategy';
import { PlantStrategy } from '~/lib/Txn/strategies/silo/PlantStrategy';
import { EnrootStrategy } from '~/lib/Txn/strategies/silo/EnrootStrategy';
import { RinseStrategy } from '~/lib/Txn/strategies/barn/RinseStrategy';
import { HarvestStrategy } from '~/lib/Txn/strategies/field/HarvestStrategy';
import { ClaimStrategy } from '~/lib/Txn/strategies/silo/ClaimStrategy';

export enum FormTxn {
  MOW = 'MOW',
  PLANT = 'PLANT',
  ENROOT = 'ENROOT',
  HARVEST = 'HARVEST',
  RINSE = 'RINSE',
  CLAIM = 'CLAIM',
}

export type FormTxnStrategy =
  | MowStrategy
  | PlantStrategy
  | EnrootStrategy
  | RinseStrategy
  | HarvestStrategy
  | ClaimStrategy;

export type FormTxnActionsMap = {
  [FormTxn.MOW]: MowStrategy;
  [FormTxn.PLANT]: PlantStrategy;
  [FormTxn.ENROOT]: EnrootStrategy;
  [FormTxn.RINSE]: RinseStrategy;
  [FormTxn.HARVEST]: HarvestStrategy;
  [FormTxn.CLAIM]: ClaimStrategy;
};

type StrategyOrSteps = FarmStepStrategy | StepsWithOptions[] | StepsWithOptions;

export class FormTxnBuilder {
  protected static sdk: BeanstalkSDK;

  private before: StrategyOrSteps[] = [];

  private after: StrategyOrSteps[] = [];

  private main: StrategyOrSteps | null;

  readonly strategies: typeof Strategies;

  constructor(_sdk: BeanstalkSDK) {
    FormTxnBuilder.sdk = _sdk;
    this.main = null;

    this.strategies = Strategies;
  }

  setMain(_strategy: StrategyOrSteps) {
    this.main = _strategy;
  }

  private getMain() {
    if (!this.main) {
      throw new Error('No strategy set');
    }
    return this.main;
  }

  addBefore(_strategy: StrategyOrSteps) {
    if (Array.isArray(_strategy)) {
      _strategy.forEach((step) => {
        this.before.push(step);
      });
      return;
    }
    this.before.push(_strategy);
  }

  addAfter(_strategy: StrategyOrSteps) {
    if (Array.isArray(_strategy)) {
      _strategy.forEach((step) => {
        this.after.push(step);
      });
      return;
    }
    this.after.push(_strategy);
  }

  async build(_amountIn: TokenValue | undefined, slippage: number) {
    const farm = FormTxnBuilder.sdk.farm.create();
    const addToFarm = (items: MayArray<StrategyOrSteps>) => {
      if (Array.isArray(items)) {
        items.forEach((item) => {
          if (item instanceof FarmStepStrategy) {
            const _steps = item.getSteps();
            if (Array.isArray(_steps)) {
              _steps.forEach(({ steps, options }) => {
                farm.add(steps, options);
              });
            } else {
              farm.add(_steps.steps, _steps.options);
            }
          }
        });
      } else if (items instanceof FarmStepStrategy) {
        const _steps = items.getSteps();
        if (Array.isArray(_steps)) {
          _steps.forEach(({ steps, options }) => {
            farm.add(steps, options);
          });
        }
      } else {
        farm.add(items.steps, items.options);
      }
    };

    addToFarm(this.before);
    addToFarm(this.getMain());
    addToFarm(this.after);

    const amountIn = _amountIn || TokenValue.ZERO;

    const estimate = await farm.estimate(amountIn);
    console.debug('[FormTxnBuilder][build] estimate: ', estimate.toString());

    const execute = () => farm.execute(amountIn, { slippage });

    return {
      farm,
      estimate,
      execute,
    };
  }

  clear() {
    this.before = [];
    this.after = [];
    this.main = null;
  }
}
