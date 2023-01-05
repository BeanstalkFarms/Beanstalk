import { Box, Chip, Link, Tooltip, Typography } from '@mui/material';
import React from 'react';
import Token from '~/classes/Token';
import { BEAN } from '~/constants/tokens';
import useAPY from '~/hooks/beanstalk/useAPY';
import Row from '../Common/Row';
import TokenIcon from '../Common/TokenIcon';
import stalkIconBlue from '~/img/beanstalk/stalk-icon-blue.svg';
import { displayFullBN } from '~/util';

import Stat from '../Common/Stat';
import useChainConstant from '~/hooks/chain/useChainConstant';

import { FC } from '~/types';

const TOOLTIP_COMPONENT_PROPS = {
  tooltip: {
    sx: {
      maxWidth: 'none !important',
      // boxShadow: '0px 6px 20px 10px rgba(255,255,255,0.3) !important',
    },
  },
};

type SiloAssetApyChipProps = {
  token: Token;
  metric: 'bean' | 'stalk';
  variant?: 'default' | 'labeled'
};

const SiloAssetApyChip: FC<SiloAssetApyChipProps> = ({ token, metric, variant = 'default' }) => {
  const { data: latestYield } = useAPY();
  const Bean = useChainConstant(BEAN);
  const isBean = metric === 'bean';

  const seeds = token.getSeeds();
  const apys = latestYield
    ? seeds.eq(2)
      ? latestYield.bySeeds['2']
      : seeds.eq(4)
      ? latestYield.bySeeds['4']
      : null
    : null;

  const tokenProps = isBean ? Bean : ({ symbol: 'Stalk', logo: stalkIconBlue } as Token);

  return (
    <Tooltip
      placement="right"
      componentsProps={TOOLTIP_COMPONENT_PROPS}
      title={
        <Row gap={0}>
          {metric === 'bean' && (
            <Box sx={{ px: 1, py: 0.5, maxWidth: 245 }}>
              <Stat 
                title={<Row gap={0.5}><TokenIcon token={Bean} />Total Beans per Season</Row>}
                gap={0.25}
                variant="h4"
                amount={latestYield ? displayFullBN(latestYield.beansPerSeasonEMA, Bean.displayDecimals) : '0'}
                subtitle="30-day exponential moving average of Beans earned by all Stalkholders per Season."
              />
            </Box>
          )}
          <Box sx={{ maxWidth: isBean ? 285 : 245, px: isBean ? 1 : 0, py: isBean ? 0.5 : 0 }}>
            {metric === 'bean' ? (
              <> The Variable Bean APY uses a moving average of Beans earned by Stalkholders during recent Seasons to estimate a future rate of return, accounting for Stalk growth.&nbsp; </>
            ) : (
              <> The Variable Stalk APY estimates the growth in your Stalk balance for Depositing {token.name}.&nbsp; </>
            )}
            <Link underline="hover" href="https://docs.bean.money/almanac/guides/silo/understand-vapy" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              Learn more
            </Link>
          </Box>
        </Row>
      }
    >
      <Chip
        variant="filled"
        color={metric === 'bean' ? 'primary' : 'secondary'}
        label={
          <Typography sx={{ whiteSpace: 'nowrap' }}>
            <Row gap={0.5} flexWrap="nowrap" justifyContent="center">
              {variant === 'labeled' && <><TokenIcon token={tokenProps} /> vAPY:{' '}</>}
              {`${apys ? apys[metric].times(100).toFixed(1) : '0.0'}%`}
            </Row>
          </Typography>
        }
        onClick={undefined}
        size="small"
      />
    </Tooltip>
  );
};

export default SiloAssetApyChip;
