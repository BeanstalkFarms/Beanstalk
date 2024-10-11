import { DataSource } from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import { SGEnvironments } from '~/graph/endpoints';

export type Settings = {
  denomination: 'usd' | 'bdv';
  subgraphEnv: SGEnvironments;
  datasource: DataSource;
  impersonatedAccount: string;
};

export type Globals = {
  showSettings: boolean;
};

export interface EthGasPrices {
  ethusd: BigNumber;
  ethUsdTimestamp: string;
  lastRefreshed: string;
  gasPrice: BigNumber;
  baseFeePerGas: BigNumber;
}

/// Not included in `App` are "flags", which are values saved in localStorage
/// See `useAppFlag`

export type App = {
  /** ETH price data */
  ethPrices: null | EthGasPrices;
  /** User settings; persisted between page loads */
  settings: Settings;
  /**  */
  globals: Globals;
};
