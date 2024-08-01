import React, { useEffect, useMemo, useState } from 'react';
import { Box, Link, Stack, Typography } from '@mui/material';
import useSeedGauge from '~/hooks/beanstalk/useSeedGauge';
import useSdk from '~/hooks/sdk';
import TokenIcon from '~/components/Common/TokenIcon';
import useElementDimensions from '~/hooks/display/useElementDimensions';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import useBeanstalkCaseData from '~/hooks/beanstalk/useBeanstalkCaseData';
import { displayFullBN } from '~/util';
import { ZERO_BN } from '~/constants';
import BigNumber from 'bignumber.js';

type IBean2MaxLPRatio = {
  data: ReturnType<typeof useSeedGauge>['data'];
};

const BAR_WIDTH = 8;
const BAR_HEIGHT = 55;
const SELECTED_BAR_HEIGHT = 65;
const MIN_SPACING = 10;
const MAX_SPACING = 12;

const Bar = ({
  isSelected,
  isFlashing,
}: {
  isSelected: boolean;
  isFlashing: boolean;
}) => (
  <Box
    sx={{
      borderRadius: 10,
      height: `${isSelected ? SELECTED_BAR_HEIGHT : BAR_HEIGHT}px`,
      width: `${BAR_WIDTH}px`,
      background: BeanstalkPalette.logoGreen,
      opacity: isSelected || isFlashing ? 1 : 0.3,
      animation: isFlashing ? 'blink 2500ms linear infinite' : undefined,
      '@keyframes blink': {
        '0%': { opacity: 1 },
        '50%': { opacity: 0.1 },
        '100%': { opacity: 1 },
      },
    }}
  />
);

/*
 * We calculate the number of bars with spacing using the formula:
 *
 * w = component width
 * b = bar width
 * s = spacing
 * x = number of bars
 *
 * w = b(x) + s(x - 1)
 * x = Floor((w + s) / (b + s))
 */
const calculateNumBarsWithSpacing = (width: number, spacing: number) => {
  const relativeWidth = width + spacing;
  const unitWidth = BAR_WIDTH + spacing;
  return Math.floor(relativeWidth / unitWidth);
};

const getBarIndex = (
  min: BigNumber,
  max: BigNumber,
  value: BigNumber,
  numBars: number
) => {
  const normalizedValue = value.minus(min).div(max.minus(min));
  const barIndex = normalizedValue.times(numBars);

  return Math.floor(barIndex.toNumber());
};

const LPRatioShiftChart = ({ data }: IBean2MaxLPRatio) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const { width } = useElementDimensions(containerRef);
  const [minBars, setMinBars] = useState(0);
  const [maxBars, setMaxBars] = useState(0);
  const [numBars, setNumBars] = useState(0);

  const caseData = useBeanstalkCaseData();

  const setValues = (values: [min: number, max: number, num: number]) => {
    setMinBars(values[0]);
    setMaxBars(values[1]);
    setNumBars(values[2]);
  };

  useEffect(() => {
    const _maxBars = calculateNumBarsWithSpacing(width, MIN_SPACING);
    const _minBars = calculateNumBarsWithSpacing(width, MAX_SPACING);

    const values = [_minBars, _maxBars, undefined];

    if (numBars === 0 || maxBars <= _minBars) {
      values[2] = _maxBars;
    } else if (minBars >= _maxBars) {
      values[2] = _minBars;
    }

    if (values[2] !== undefined) {
      setValues(values as [number, number, number]);
    }
  }, [numBars, width, minBars, maxBars]);

  const arr = Array.from({ length: numBars });

  const bean2MaxLP = data.bean2MaxLPRatio.value;
  const min = data.bean2MaxLPRatio.min;
  const max = data.bean2MaxLPRatio.max;

  const isAtMax = bean2MaxLP && bean2MaxLP.eq(data.bean2MaxLPRatio.max);
  const isAtMin = bean2MaxLP && bean2MaxLP.eq(data.bean2MaxLPRatio.min);

  const increasing = !isAtMax && caseData?.delta.bean2MaxLPGPPerBdv.gt(0);
  const decreasing = !isAtMin && caseData?.delta.bean2MaxLPGPPerBdv.lt(0);

  const selectedIndex =
    bean2MaxLP && getBarIndex(min, max, bean2MaxLP, numBars);

  const addIndex = increasing ? 1 : decreasing ? -1 : 0;

  const neighborIndex =
    (increasing || decreasing) && selectedIndex && selectedIndex + addIndex;

  const bean2MaxLPScalar = caseData?.delta.bean2MaxLPGPPerBdvScalar || ZERO_BN;

  const deltaPct = isAtMax || isAtMin ? ZERO_BN : bean2MaxLPScalar;

  return (
    <Stack width="100%" ref={containerRef}>
      <Stack>
        <Typography variant="h3">
          {bean2MaxLP ? displayFullBN(bean2MaxLP, 2) : '--'}%{' '}
          <Typography component="span" variant="h4">
            Bean to Max LP Ratio
          </Typography>
        </Typography>
        <Typography color="text.secondary">
          Expected {!decreasing ? 'increase' : 'decrease'} of{' '}
          {deltaPct.eq(0) ? '0' : deltaPct.abs().toFormat(1)}% next Season
        </Typography>
      </Stack>
      <Stack
        pt={2}
        pb={1}
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        width="100%"
      >
        {arr.map((_, i) => {
          const isSelected = selectedIndex === i;
          const flashing = neighborIndex === i;
          return (
            <Bar
              key={`bar-${i}`}
              isFlashing={flashing}
              isSelected={isSelected}
            />
          );
        })}
      </Stack>
      <Stack direction="row" justifyContent="space-between" width="100%">
        <Stack textAlign="left">
          <Typography variant="subtitle2">
            {data.bean2MaxLPRatio.min.toFormat(0)}%
          </Typography>
          <Typography color="text.secondary">Minimum</Typography>
        </Stack>
        <Stack textAlign="right">
          <Typography variant="subtitle2">
            {data.bean2MaxLPRatio.max.toFormat(0)}%
          </Typography>
          <Typography color="text.secondary">Maximum</Typography>
        </Stack>
      </Stack>
    </Stack>
  );
};

const Bean2MaxLPRatio = ({ data }: IBean2MaxLPRatio) => {
  const sdk = useSdk();

  const maxLP = useMemo(() => {
    if (!data?.gaugeData) return;
    const arr = Object.entries(data.gaugeData);
    const sorted = [...arr].sort(([_ak, a], [_bk, b]) => {
      const diff = Number(
        b.gaugePointsPerBdv.minus(a.gaugePointsPerBdv).toString()
      );
      return diff;
    });

    return sdk.tokens.findByAddress(sorted[0][0] || '');
  }, [data?.gaugeData, sdk]);

  return (
    <Box>
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack gap={2} py={2} px={1.5}>
          <Stack>
            <Typography variant="h4">
              Seed reward for Deposited Beans as a % of the Seed reward for the
              Max LP token
            </Typography>
            <Typography color="text.secondary">
              Beanstalk adjusts the Seed reward of Beans and LP each Season to
              change the incentives for Conversions, which contributes to peg
              maintenance.
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" gap={0.5}>
            {maxLP && (
              <TokenIcon
                token={maxLP}
                css={{ height: '24px', width: '24px', marginTop: '-2px' }}
              />
            )}
            <Typography>
              {maxLP?.symbol || '--'} is currently the Max LP, i.e., the LP
              token with the highest Gauge Points per BDV
            </Typography>
          </Stack>
          <Link
            href="https://docs.bean.money/almanac/protocol/glossary#target-seasons-to-catchup"
            target="_blank"
            underline="always"
            color="primary.main"
          >
            Read more about the Bean to Max LP Ratio
          </Link>
        </Stack>
      </Box>
      <Box px={1.5} py={2}>
        <LPRatioShiftChart data={data} />
      </Box>
    </Box>
  );
};

export default Bean2MaxLPRatio;
