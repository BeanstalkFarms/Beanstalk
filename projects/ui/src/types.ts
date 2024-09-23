import { BeanstalkSDK } from '@beanstalk/sdk';
import React from 'react';
import { ContractFunctionParameters, MulticallReturnType } from 'viem';

export type FC<T extends any> = React.FC<React.PropsWithChildren<T>>;

export type MayPromise<V> = V | Promise<V>;

export type MayArray<V> = V | V[];

// Beanstalk SDK Workflows
type SDkFarm = BeanstalkSDK['farm'];

export type FarmWorkflow = ReturnType<SDkFarm['create']>;
export type AdvancedFarmWorkflow = ReturnType<SDkFarm['createAdvancedFarm']>;
export type AdvancedPipeWorkflow = ReturnType<SDkFarm['createAdvancedPipe']>;

type MulticallParams<
  T extends
    readonly ContractFunctionParameters[] = ContractFunctionParameters[],
> = T;

export type MulticallResult<AllowFail extends boolean = true> =
  MulticallReturnType<MulticallParams, AllowFail>;
