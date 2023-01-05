import { FarmFromMode } from '~/lib/Beanstalk/Farm';
import { BN } from './BigNumber';
import { combineBalances, optimizeFromMode } from './Farm';

describe('optimize from mode', () => {
  it('throws if amountIn is greater than total', () => {
    expect(() => optimizeFromMode(
      BN(100000),
      {
        internal: BN(0),
        external: BN(0),
        total:    BN(0),
      }
    )).toThrow();
  });
  it('uses INTERNAL first', () => {
    expect(optimizeFromMode(
      BN(100),
      {
        internal: BN(150),
        external: BN(150),
        total:    BN(300),
      }
    )).toEqual(FarmFromMode.INTERNAL);
  });
  it('uses EXTERNAL if INTERNAL is not enough', () => {
    expect(optimizeFromMode(
      BN(100),
      {
        internal: BN(50),
        external: BN(150),
        total:    BN(200),
      }
    )).toEqual(FarmFromMode.EXTERNAL);
  });
  it('uses INTERNAL_EXTERNAL if required', () => {
    expect(optimizeFromMode(
      BN(150),
      {
        internal: BN(120),
        external: BN(120),
        total:    BN(240),
      }
    )).toEqual(FarmFromMode.INTERNAL_EXTERNAL);
  });
  it('works for max amount', () => {
    expect(optimizeFromMode(
      BN(150),
      {
        internal: BN(100),
        external: BN(50),
        total:    BN(150),
      }
    )).toEqual(FarmFromMode.INTERNAL_EXTERNAL);
  });
});

describe('combines balances', () => {
  it('adds balances correctly', () => {
    expect(combineBalances(
      {
        internal: BN(100),
        external: BN(100),
        total:    BN(200),
      },
      {
        internal: BN(50),
        external: BN(50),
        total:    BN(100),
      }
    )).toStrictEqual({
      internal: BN(150),
      external: BN(150),
      total:    BN(300),
    });
  });
});
