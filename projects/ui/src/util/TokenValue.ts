import { Token, TokenValue } from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';

/**
 * Returns amount as TokenValue. If undefined, returns TokenValue.ZERO
 */
export const normaliseTV = (
  token: Token,
  amount: TokenValue | BigNumber | undefined
) => {
  if (!amount) return token.amount('0');
  return BigNumber.isBigNumber(amount)
    ? token.amount(amount.toString())
    : amount;
};

export const formatTV = (
  value: TokenValue | undefined | null,
  decimals?: number,
  mode?: BigNumber.RoundingMode
) => {
  const rounded = new BigNumber(value?.toHuman() ?? 0);
  return rounded.toFormat(
    decimals ?? value?.decimals ?? 2,
    mode ?? BigNumber.ROUND_HALF_DOWN
  );
};
