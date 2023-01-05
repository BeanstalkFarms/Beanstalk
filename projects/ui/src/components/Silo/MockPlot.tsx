import React from 'react';
import LineChart from '~/components/Common/Charts/LineChart';
import { mockDepositData } from '~/components/Common/Charts/LineChart.mock';
import { BaseDataPoint } from '../Common/Charts/ChartPropProvider';

const MockSeries = [mockDepositData];
const MockPlot = () => (
  <LineChart
    series={MockSeries as BaseDataPoint[][]}
  />
);

export default MockPlot;
