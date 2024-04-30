import React, { useCallback } from 'react';
import { Button, Divider, StackProps, Typography } from '@mui/material';
import {
  SeasonAggregation,
  SeasonRange,
} from '~/hooks/beanstalk/useSeasonsQuery';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

const AGGREGATION = [
  { label: 'HR', index: 0 },
  { label: 'DAY', index: 1 },
];

const WINDOWS = [
  { label: 'W', index: 0 },
  { label: 'M', index: 1 },
  { label: 'ALL', index: 2 },
];

const WINDOWS_ALT = [
  { label: '1D', index: 3 },
  { label: '1W', index: 0 },
  { label: '1M', index: 1 },
  { label: '3M', index: 4 },
  { label: '6M', index: 5 },
  { label: 'YTD', index: 6 },
  { label: '1Y', index: 7 },
  { label: '2Y', index: 8 },
  { label: 'ALL', index: 2 },
];

export type TimeTabState = [SeasonAggregation, SeasonRange];

export interface TimeTabProps {
  state: TimeTabState;
  setState: (s: TimeTabState) => void;
  aggregation?: boolean;
  windows?: boolean;
  useExpandedWindows?: boolean;
}

const TimeTabs: FC<TimeTabProps & StackProps> = ({
  sx,
  setState,
  state,
  aggregation = true,
  windows = true,
  useExpandedWindows
}) => {
  const handleChange0 = useCallback(
    (i: number) => {
      setState([i, state[1]]);
    },
    [state, setState]
  );

  const handleChange1 = useCallback(
    (i: number) => {
      setState([state[0], i]);
    },
    [state, setState]
  );

  return (
    <Row sx={{ ...sx }} gap={0.2}>
      {aggregation
        ? AGGREGATION.map((d) => (
            <Button
              onClick={() => handleChange0(d.index)}
              key={d.label}
              variant="text"
              size="small"
              color="dark"
              sx={{
                borderRadius: 0.5,
                px: 0.3,
                py: 0.3,
                mt: -0.3,
                minWidth: 0,
              }}
              disableRipple
            >
              <Typography
                color={state[0] === d.index ? 'primary' : 'text.primary'}
              >
                {d.label}
              </Typography>
            </Button>
          ))
        : null}
      {aggregation && windows ? (
        <Divider
          orientation="vertical"
          sx={{ height: '14px', ml: 0.1, mr: 0.1 }}
        />
      ) : null}
      {windows
        ? (useExpandedWindows ? WINDOWS_ALT : WINDOWS).map((w) => (
            <Button
              onClick={() => handleChange1(w.index)}
              key={w.label}
              variant="text"
              size="small"
              color="dark"
              sx={{
                borderRadius: 0.5,
                px: 0.3,
                py: 0.3,
                mt: -0.3,
                minWidth: 0,
              }}
              disableRipple
            >
              <Typography
                color={state[1] === w.index ? 'primary' : 'text.primary'}
              >
                {w.label}
              </Typography>
            </Button>
          ))
        : null}
    </Row>
  );
};

export default TimeTabs;
