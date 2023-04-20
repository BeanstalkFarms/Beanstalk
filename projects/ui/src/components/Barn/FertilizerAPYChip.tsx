import { Chip, Tooltip, Link, Typography, Box } from '@mui/material';
import React from 'react';
import useFertilizerYieldData from '~/hooks/beanstalk/useFertilizerYieldData';
import useSdk from '~/hooks/sdk';
import { displayFullBN } from '~/util';
import Row from '../Common/Row';
import Stat from '../Common/Stat';
import TokenIcon from '../Common/TokenIcon';

const copy = {
  fertilizedAmounts: '30-day exponential moving average of Fertilized Sprouts per Season. Fertilized Sprouts can be Rinsed to be redeemed for Beans.',
  vAPY: 'The Variable FERT APY uses a moving average of Fertilized Sprouts during recent Seasons to estimate a future rate of return.',
};

const SECTION_MAX_WIDTH = 260;

const FertilizerAPYChip: React.FC<{}> = () => {
  const sdk = useSdk();
  const yieldData = useFertilizerYieldData();
  
  if (!yieldData) return null;

  const vApyString = yieldData.vApy.gt(0) && yieldData.vApy.lt(0.01)
    ? '< 0.01'
    : yieldData.vApy.toFixed(2);

  return (
    <Tooltip
      placement="bottom"
      componentsProps={{ tooltip: { sx: { maxWidth: 'none !important' } } }}
      title={
        <Row direction={{ xs: 'column', sm: 'row' }} alignItems="flex-start">
          <Box px={1} py={0.5} sx={{ maxWidth: SECTION_MAX_WIDTH }}>
            <Stat
              title={
                <Row gap={0.5}>
                  <TokenIcon token={sdk.tokens.SPROUTS} />
                  <Typography>
                    Total Sprouts Fertilized Per Season
                  </Typography>
                </Row>
              }
              subtitle={copy.fertilizedAmounts}
              variant="h4"
              gap={0.25}
              amount={displayFullBN(yieldData.beansPerSeasonEMA, 2)}
            />
          </Box>
          <Box px={1} py={0.5} sx={{ maxWidth: SECTION_MAX_WIDTH, alignSelf: 'center' }}>
            <Typography component="span">
              {copy.vAPY} &nbsp;
              <Link
                underline="hover"
                href="https://docs.bean.money/almanac/guides/barn"
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                Learn more
              </Link>
            </Typography>
          </Box>
        </Row>
      }
    >
      <Chip
        variant="filled"
        color="primary"
        onClick={undefined}
        size="small"
        label={
          <Typography sx={{ whitespace: 'nowrap' }} variant="bodySmall">
            vAPY {vApyString}%
          </Typography>
        }
      />
    </Tooltip>
  );
};

export default FertilizerAPYChip;
