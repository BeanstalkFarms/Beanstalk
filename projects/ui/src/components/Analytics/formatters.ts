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
export const tickFormatBeanAmount = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 })
export const getFormattedAndExtraData = (queryData: any, selectedCharts: number[], chartSetupData: any) => {
  const _extraData = new Map();
  const _formattedData: { time: number; value: number }[][] = [];
  if (!queryData || !selectedCharts || !chartSetupData) return { formattedData: _formattedData, extraData: _extraData };
  selectedCharts.forEach((selectionIndex: any, index) => {
    if (queryData.length === 0 || !queryData[index]) return;
    const querySeasons = queryData[index];
    if (!querySeasons) return;
    const _formattedQuery: { time: number; value: number }[] = [];
    querySeasons.forEach((seasonData: any, timestampIndex: number) => {
      // TODO: Use season to set timestamp
      if (seasonData) {
        const timestamp = Number(queryData[timestampIndex][chartSetupData[selectedCharts[0]].timeScaleKey]);
        const value = chartSetupData[selectionIndex].valueFormatter(seasonData[chartSetupData[selectionIndex].priceScaleKey])
        if (index === 0) {
          _extraData.set(timestamp, seasonData.season);
        };
        _formattedQuery.unshift({
          time: timestamp,
          value: value,
        });
      };
    })
    _formattedData.push(_formattedQuery);
  });
  return { formattedData: _formattedData, extraData: _extraData }; 
};
