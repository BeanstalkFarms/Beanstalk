import React, { useMemo } from 'react';
import { Box, Link, Stack, Typography } from '@mui/material';
import useSeedGauge from '~/hooks/beanstalk/useSeedGauge';
import useSdk from '~/hooks/sdk';
import TokenIcon from '~/components/Common/TokenIcon';
import useElementDimensions from '~/hooks/display/useElementDimensions';
import { BeanstalkPalette } from '~/components/App/muiTheme';

type IBean2MaxLPRatio = {
  data: ReturnType<typeof useSeedGauge>['data'];
};

const BAR_WIDTH = 8;
const BAR_HEIGHT = 55;
const SELECTED_BAR_HEIGHT = 65;
const MIN_SPACING = 10; // 1 = 10px;

const LPRatioShiftChart = ({ data }: IBean2MaxLPRatio) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const { width } = useElementDimensions(containerRef);

  const maxBars = width / (BAR_WIDTH + MIN_SPACING);
  const minBars = maxBars - 2;

  const increasing = false;
  const decreasing = true;

  // TODO: FIX LOGIC
  const arr = Array.from({ length: minBars });
  const maxIndex = arr.length - 1;
  const selectedIndex = maxIndex - 2;
  const addIndex = increasing ? 1 : decreasing ? -1 : 0;

  const neighborIndex = selectedIndex + addIndex;

  return (
    <Stack width="100%" ref={containerRef}>
      <Stack>
        <Typography variant="h3">
          54.5%{' '}
          <Typography component="span" variant="h4">
            Bean to Max LP Ratio
          </Typography>
        </Typography>
        <Typography color="text.secondary">
          Expected increase of X% next Season
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
        {arr.map((_, i) => (
          <Box
            key={`gauge-bar-${i}`}
            sx={{
              borderRadius: 10,
              height: `${i === selectedIndex ? SELECTED_BAR_HEIGHT : BAR_HEIGHT}px`,
              width: `${BAR_WIDTH}px`,
              background: BeanstalkPalette.logoGreen,
              opacity: i === selectedIndex || i === neighborIndex ? 1 : 0.3,
              animation:
                i === neighborIndex
                  ? 'blink 2500ms linear infinite'
                  : undefined,
              '@keyframes blink': {
                '0%': { opacity: 1 },
                '50%': { opacity: 0.1 },
                '100%': { opacity: 1 },
              },
            }}
          />
        ))}
      </Stack>
      <Stack direction="row" justifyContent="space-between" width="100%">
        <Stack textAlign="left">
          <Typography variant="subtitle2">50%</Typography>
          <Typography color="text.secondary">Minimum</Typography>
        </Stack>
        <Stack textAlign="right">
          <Typography variant="subtitle2">100%</Typography>
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
