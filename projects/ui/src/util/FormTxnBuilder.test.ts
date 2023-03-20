/* eslint-disable @typescript-eslint/no-use-before-define */
import {
  BeanstalkSDK,
  FarmWorkflow,
  StepGenerator,
  TokenValue,
} from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { beforeAll, describe, it, expect } from 'vitest';
import { FormTxnBuilderInterface, FormTxnBuilder, FormTxn } from './FormTxns';

import { getTestUtils } from './test-util';

let sdk: BeanstalkSDK;
let account: string;

beforeAll(async () => {
  const testUtils = getTestUtils();
  /// SETUP
  account = testUtils.connection.account;
  sdk = testUtils.sdk;
});

describe('FormTxnBuilder', () => {
  it('with no additional options', async () => {
    const { workflow, amountIn } = await getCompiledResult({
      preset: 'claim',
      primary: undefined,
      secondary: undefined,
    });

    tests.workflowLength(workflow, 1);
    tests.callData(workflow, amountIn, 0, 'MOCK-STEP');
  });

  it('with primary and secondary options', async () => {
    const { workflow, amountIn } = await getCompiledResult({
      preset: 'claim',
      primary: [FormTxn.CLAIM, FormTxn.RINSE],
      secondary: [FormTxn.ENROOT],
    });

    tests.workflowLength(workflow, 4);
    tests.callData(workflow, amountIn, 0, 'CLAIM');
    tests.callData(workflow, amountIn, 1, 'RINSE');
    tests.callData(workflow, amountIn, 2, 'MOCK-STEP');
    tests.callData(workflow, amountIn, 3, 'ENROOT');
  });

  it('removes implied options', async () => {
    const { workflow, amountIn } = await getCompiledResult({
      preset: 'claim',
      primary: [FormTxn.CLAIM, FormTxn.RINSE],
      secondary: [FormTxn.ENROOT, FormTxn.MOW],
      implied: [FormTxn.CLAIM],
    });
    tests.workflowLength(workflow, 3);
    tests.callData(workflow, amountIn, 0, 'RINSE');
    tests.callData(workflow, amountIn, 1, 'MOCK-STEP');
    tests.callData(workflow, amountIn, 2, 'ENROOT');
  });

  it('removes option implied options', async () => {
    const { workflow, amountIn } = await getCompiledResult({
      preset: 'claim',
      primary: [FormTxn.CLAIM, FormTxn.RINSE],
      secondary: [FormTxn.ENROOT, FormTxn.MOW],
    });

    tests.workflowLength(workflow, 4);
    tests.callData(workflow, amountIn, 0, 'CLAIM');
    tests.callData(workflow, amountIn, 1, 'RINSE');
    tests.callData(workflow, amountIn, 2, 'MOCK-STEP');
    tests.callData(workflow, amountIn, 3, 'ENROOT');
  });

  it('removes duplicate options', async () => {
    const { workflow, amountIn } = await getCompiledResult({
      preset: 'claim',
      primary: [FormTxn.CLAIM, FormTxn.RINSE, FormTxn.RINSE],
      secondary: [FormTxn.CLAIM, FormTxn.MOW, FormTxn.MOW],
    });

    tests.workflowLength(workflow, 4);
    tests.callData(workflow, amountIn, 0, 'CLAIM');
    tests.callData(workflow, amountIn, 1, 'RINSE');
    tests.callData(workflow, amountIn, 2, 'MOCK-STEP');
    tests.callData(workflow, amountIn, 3, 'MOW');
  });

  it('removes excluded options', async () => {
    const { workflow, amountIn } = await getCompiledResult({
      preset: 'claim',
      primary: [FormTxn.RINSE],
      secondary: [FormTxn.ENROOT, FormTxn.PLANT],
      exclude: [FormTxn.RINSE],
    });

    tests.workflowLength(workflow, 3);
    tests.callData(workflow, amountIn, 0, 'MOCK-STEP');
    tests.callData(workflow, amountIn, 1, 'ENROOT');
    tests.callData(workflow, amountIn, 2, 'PLANT');
  });
});

const tests = {
  workflowLength: (op: FarmWorkflow, len: number) => {
    // @ts-ignore testing private value
    expect(op._steps.length).toBe(len);
    expect(op.length).toBe(len);
  },
  callData: (
    workflow: FarmWorkflow,
    amountIn: TokenValue,
    index: number,
    expected: string
  ) => {
    const amountInBN = ethers.BigNumber.from(amountIn.blockchainString);
    // @ts-ignore testing private value
    expect(workflow._steps[index].prepare(amountInBN)).toMatchObject({
      callData: expected,
    });
  },
};

async function getCompiledResult(data: FormTxnBuilderInterface) {
  const getGenerators = (formTxn: FormTxn): StepGenerator[] => [
    () => formTxn.toString(),
  ];
  const deposit = sdk.silo.buildDeposit(sdk.tokens.BEAN, account);
  deposit.setInputToken(sdk.tokens.BEAN);
  const amountIn = sdk.tokens.BEAN.amount(1);
  const mockSteps: StepGenerator[] = [() => 'MOCK-STEP'];
  const compiled = await FormTxnBuilder.compile(
    sdk,
    { ...data },
    getGenerators,
    mockSteps,
    amountIn,
    0.1
  );
  expect(compiled.estimate.toString()).toBe(amountIn.blockchainString);

  return {
    ...compiled,
    amountIn,
    amountInBN: ethers.BigNumber.from(amountIn.blockchainString),
  };
}
