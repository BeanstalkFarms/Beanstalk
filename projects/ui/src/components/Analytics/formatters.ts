import BigNumber from 'bignumber.js';
import { NumberLike } from '@visx/scale';
import { displayBN } from '~/util';
import { formatUnits } from 'viem';

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
export const tickFormatRRoR = (value: any) => `${(parseFloat(value) * 100).toFixed(2)}`;
export const valueFormatBeanAmount = (value: any) => Number(formatUnits(value, 6));
export const tickFormatBeanAmount = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 });