import BigNumberJS from 'bignumber.js';
import { PlotMap } from '~/util';

/// FIXME: "Field" or "FarmerField";
export type FarmerField = {
  plots: PlotMap<BigNumberJS>;
  pods: BigNumberJS;

  harvestablePlots: PlotMap<BigNumberJS>;
  harvestablePods: BigNumberJS;

  loading?: boolean;
};
