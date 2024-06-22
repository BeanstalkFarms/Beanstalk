import { DataSource } from '@beanstalk/sdk';
import { Range, Time } from 'lightweight-charts';
import { DateRange } from 'react-day-picker';
import type { EthPriceResponse } from '~/functions/ethprice/ethprice';
import { SGEnvironments } from '~/graph/endpoints';

export type Settings = {
  denomination: 'usd' | 'bdv';
  subgraphEnv: SGEnvironments;
  datasource: DataSource;
  impersonatedAccount: string;
  advancedChartSettings: {
    range: DateRange,
    preset: string,
    selectedCharts: number[],
    timePeriod: Range<Time>
  };
};

export type Globals = {
  showSettings: boolean;
};

/// Not included in `App` are "flags", which are values saved in localStorage
/// See `useAppFlag`

export type App = {
  /** ETH price data */
  ethPrices: null | EthPriceResponse;
  /** User settings; persisted between page loads */
  settings: Settings;
  /**  */
  globals: Globals;
};
