import { BeanstalkSDK } from '@beanstalk/sdk';

type WorkflowAddParams = Parameters<
  ReturnType<BeanstalkSDK['farm']['create']>['add']
>;

export type WorkflowInputStep = WorkflowAddParams[0];

export type WorkflowInputOptions = WorkflowAddParams[1];

export type FarmInput = {
  input: WorkflowInputStep;
  options?: WorkflowInputOptions;
};
