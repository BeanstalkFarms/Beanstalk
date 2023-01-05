import BigNumber from 'bignumber.js';
import { NumberLike } from '@visx/scale';
import { displayBN } from '~/util';

export const tickFormatTruncated = (v: NumberLike) => displayBN(new BigNumber(v.valueOf()));
export const tickFormatLocale = (v: NumberLike) => {
  const n = v.valueOf();
  return n.toLocaleString('en-us');
};
export const tickFormatPercentage = (v: NumberLike) => {
  const n = v.valueOf();
  return `${n.toFixed(n < 100 ? 2 : 0)}%`;
};
export const tickFormatUSD = (v: NumberLike) => `$${tickFormatTruncated(v)}`;
export const tickFormatBeanPrice = (v: NumberLike) => `$${v.valueOf().toLocaleString('en-us', { minimumFractionDigits: 4 })}`;
