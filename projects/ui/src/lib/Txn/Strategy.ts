import { BeanstalkSDK, FarmWorkflow, StepGenerator } from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { MayArray } from '~/types';

export type StepGeneratorOptions = Parameters<
  ReturnType<BeanstalkSDK['farm']['create']>['add']
>[1];

export interface StepsWithOptions {
  steps: StepGenerator[];
  options?: StepGeneratorOptions;
}

export abstract class FarmStepStrategy {
  protected static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    FarmStepStrategy.sdk = sdk;
  }

  abstract getSteps(...parameters: any[]): MayArray<StepsWithOptions>;

  static normaliseSteps(item: FarmWorkflow | StepGenerator | StepGenerator[]) {
    if (Array.isArray(item)) return item;
    return item instanceof FarmWorkflow
      ? ([...item.generators] as StepGenerator[])
      : [item];
  }
}

export interface EstimatesGas {
  estimateGas(): Promise<ethers.BigNumber>;
}
