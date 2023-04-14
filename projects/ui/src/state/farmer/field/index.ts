import BigNumber from 'bignumber.js';
import { PlotMap } from '~/util';

/// FIXME: "Field" or "FarmerField";
export type FarmerField = {
  plots: PlotMap<BigNumber>;
  pods: BigNumber;
  harvestablePlots: PlotMap<BigNumber>;
  harvestablePods: BigNumber;
}
