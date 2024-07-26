import React, { useMemo } from 'react';
import { Box, Link, Stack, Typography } from '@mui/material';
import useSeedGauge from '~/hooks/beanstalk/useSeedGauge';
import useSdk from '~/hooks/sdk';
import TokenIcon from '~/components/Common/TokenIcon';

type IBean2MaxLPRatio = {
  data: ReturnType<typeof useSeedGauge>['data'];
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
      <Box sx={{ border: '0.5px solid', borderColor: 'divider' }}>
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
    </Box>
  );
};

export default Bean2MaxLPRatio;
