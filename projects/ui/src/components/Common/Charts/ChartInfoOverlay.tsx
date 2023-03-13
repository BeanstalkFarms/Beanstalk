import { CircularProgress } from '@mui/material';
import React from 'react';
import Stat from '../Stat';

type ChartInfoProps = {
  title: JSX.Element | string;
  titleTooltip?: JSX.Element | string;
  amount: JSX.Element | string;
  subtitle: JSX.Element | string;
  gap: any;
  sx?: object;
  isLoading: boolean;
};

const ChartInfoOverlay: React.FC<ChartInfoProps> = ({
  isLoading,
  amount,
  ...statProps
}) => (
  <Stat
    {...statProps}
    amount={
      isLoading ? (
        <CircularProgress variant="indeterminate" size="1.18em" thickness={5} />
      ) : (
        amount
      )
    }
  />
);
export default ChartInfoOverlay;
