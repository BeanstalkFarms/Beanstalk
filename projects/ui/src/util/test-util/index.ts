import {
  TestUtils,
  BeanstalkSDK,
  DataSource,
  TokenValue,
} from '@beanstalk/sdk';
import { expect } from 'vitest';
import FarmerTestUtil from './FarmerTestUtil';

function getTestUtils() {
  const _connection = TestUtils.setupConnection();
  const _sdk = new BeanstalkSDK({
    signer: _connection.signer,
    // provider: _connection.provider,
    source: DataSource.LEDGER,
    DEBUG: true,
  });
  const _utils = new TestUtils.BlockchainUtils(_sdk);

  return {
    sdk: _sdk,
    utils: _utils,
    connection: _connection,
  };
}

async function getTestUtilsWithAccount(acc: string) {
  const testUtils = getTestUtils();
  const stop = await testUtils.utils.impersonate(acc);

  const provider = testUtils.connection.provider;
  const signer = await provider.getSigner(acc);

  const _sdk = new BeanstalkSDK({
    signer,
    source: DataSource.LEDGER,
  });

  const util = new TestUtils.BlockchainUtils(_sdk);

  return {
    stop,
    sdk: _sdk,
    util,
  };
}

function expectWithinBounds(
  amountIn: TokenValue,
  compare: TokenValue,
  _bounds?: number
) {
  const bounds = _bounds || 0.1;

  const deviation = amountIn.mul(bounds / 100);

  const min = amountIn.sub(deviation);
  const max = amountIn.add(deviation);

  expect(compare.lte(max)).toBe(true);
  expect(compare.gte(min)).toBe(true);
}

export {
  FarmerTestUtil,
  getTestUtils,
  getTestUtilsWithAccount,
  expectWithinBounds,
};
