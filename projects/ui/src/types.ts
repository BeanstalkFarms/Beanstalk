import { BeanstalkSDK } from '@beanstalk/sdk';
import React from 'react';

export type FC<T extends any> = React.FC<React.PropsWithChildren<T>>;

export type MayPromise<V> = V | Promise<V>;

export type MayArray<V> = V | V[];

// Beanstalk SDK Workflows
type SDkFarm = BeanstalkSDK['farm'];

export type FarmWorkflow = ReturnType<SDkFarm['create']>;
export type AdvancedFarmWorkflow = ReturnType<SDkFarm['createAdvancedFarm']>;
export type AdvancedPipeWorkflow = ReturnType<SDkFarm['createAdvancedPipe']>;
