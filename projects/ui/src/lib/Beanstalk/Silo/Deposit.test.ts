import BigNumber from 'bignumber.js';
import { ZERO_BN } from '~/constants';
import { BEAN } from '~/constants/tokens';
import Beanstalk from '../index';

it('has a bdv of 0 with no token state', () => {
  const result = Beanstalk.Silo.Deposit.deposit(
    BEAN[1],
    [{ token: BEAN[1], amount: ZERO_BN }],
    (amount) => amount,
  );
  expect(result.bdv).toStrictEqual(new BigNumber(0));
});
