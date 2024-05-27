import React from 'react';
import { Box, Chip, Link, Stack, Tooltip, Typography } from '@mui/material';
import Token from '~/classes/Token';
import { BEAN } from '~/constants/tokens';
import useAPY from '~/hooks/beanstalk/useAPY';
import stalkIconBlue from '~/img/beanstalk/stalk-icon-blue.svg';
import { displayFullBN } from '~/util';
import useChainConstant from '~/hooks/chain/useChainConstant';
import { FC } from '~/types';
import BigNumber from 'bignumber.js';
import Row from '../Common/Row';
import TokenIcon from '../Common/TokenIcon';
import BeanProgressIcon from '../Common/BeanProgressIcon';

const TOOLTIP_COMPONENT_PROPS = {
  tooltip: {
    sx: {
      maxWidth: 'none !important',
      /// boxShadow: '0px 6px 20px 10px rgba(255,255,255,0.3) !important',
    },
  },
};

type SiloAssetApyChipProps = {
  token: Token;
  metric: 'bean' | 'stalk';
  variant?: 'default' | 'labeled';
};

const SiloAssetApyChip: FC<SiloAssetApyChipProps> = ({
  token,
  metric,
  variant = 'default',
}) => {
  const { data: latestYield, loading: isLoading } = useAPY();
  const Bean = useChainConstant(BEAN);
  const isBean = metric === 'bean';

  const apys = latestYield ? latestYield.byToken[token.address] : null;

  const tokenProps = isBean
    ? Bean
    : ({ symbol: 'Stalk', logo: stalkIconBlue } as Token);

  function getDisplayString(val: BigNumber | null) {
    return `${val ? (val.gt(0) && val.lt(0.1) ? '< 0.1' : val.toFixed(1)) : '0.0'}%`;
  }

  return (
    <Tooltip
      placement="right"
      componentsProps={TOOLTIP_COMPONENT_PROPS}
      title={
        <Row gap={0}>
          {metric === 'bean' && (
            <Box sx={{ px: 1, py: 0.5, maxWidth: 300 }}>
              <Stack gap={0.25}>
                <Row gap={0.5}>
                  <TokenIcon token={Bean} />
                  Total Beans per Season
                </Row>
                <Box display="flex">
                  <Stack width="33%">
                    <Typography variant="h4">24H</Typography>
                    <Typography variant="h4">
                      {latestYield
                        ? displayFullBN(
                            latestYield.beansPerSeasonEMA24h,
                            Bean.displayDecimals
                          )
                        : '0'}
                    </Typography>
                  </Stack>
                  <Stack width="33%">
                    <Typography variant="h4">7D</Typography>
                    <Typography variant="h4">
                      {latestYield
                        ? displayFullBN(
                            latestYield.beansPerSeasonEMA7d,
                            Bean.displayDecimals
                          )
                        : '0'}
                    </Typography>
                  </Stack>
                  <Stack width="33%">
                    <Typography variant="h4">30D</Typography>
                    <Typography variant="h4">
                      {latestYield
                        ? displayFullBN(
                            latestYield.beansPerSeasonEMA30d,
                            Bean.displayDecimals
                          )
                        : '0'}
                    </Typography>
                  </Stack>
                </Box>
                <Typography variant="bodySmall" color="text.primary">
                  30-day exponential moving average of Beans
                  earned by all Stalkholders per Season.
                </Typography>
              </Stack>
            </Box>
          )}
          <Box
            sx={{
              maxWidth: isBean ? 285 : 245,
              px: isBean ? 1 : 0,
              py: isBean ? 0.5 : 0,
            }}
          >
            {metric === 'bean' ? (
              <>
                {' '}
                The Variable Bean APY uses a moving average of Beans earned by
                Stalkholders during recent Seasons to estimate a future rate of
                return, accounting for Stalk growth.&nbsp;{' '}
              </>
            ) : (
              <>
                {' '}
                The Variable Stalk APY estimates the growth in your Stalk
                balance for Depositing {token.name}.&nbsp;{' '}
              </>
            )}
            <Link
              underline="hover"
              href="https://docs.bean.money/almanac/guides/silo/understand-silo-vapy"
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              Learn more
            </Link>
          </Box>
        </Row>
      }
    >
      <Chip
        variant="filled"
        color={metric === 'bean' ? 'primary' : 'secondary'}
        sx={{
          '& .MuiChip-label': {
            overflow: 'visible',
          },
          maxWidth: '120%'
        }}
        label={
          <Typography sx={{ whiteSpace: 'nowrap' }}>
            <Row
              gap={0.25}
              flexWrap="nowrap"
              justifyContent="center"
              alignItems="center"
            >
              {variant === 'labeled' && (
                <>
                  <TokenIcon token={tokenProps} /> vAPY:{' '}
                </>
              )}
              {metric === 'bean' ? (
                <>
                  <Box
                    display="flex"
                    justifyContent="center"
                    width={isLoading ? '40px' : 'auto'}
                  >
                    {isLoading ? (
                      <BeanProgressIcon
                        size={10}
                        enabled
                        variant="indeterminate"
                      />
                    ) : (
                      <>
                        {getDisplayString(
                          apys && apys['24h'] ? apys['24h'][metric].times(100) : null
                        )}
                      </>
                    )}
                  </Box>
                  <Typography color="white" marginTop={-0.25}>
                    |
                  </Typography>
                  <Box
                    display="flex"
                    justifyContent="center"
                    width={isLoading ? '40px' : 'auto'}
                  >
                    {isLoading ? (
                      <BeanProgressIcon
                        size={10}
                        enabled
                        variant="indeterminate"
                      />
                    ) : (
                      <>
                        {getDisplayString(
                          apys && apys['7d'] ? apys['7d'][metric].times(100) : null
                        )}
                      </>
                    )}
                  </Box>
                  <Typography color="white" marginTop={-0.25}>
                    |
                  </Typography>
                </>
              ) : null}
              <Box
                display="flex"
                justifyContent="center"
                width={isLoading ? '40px' : 'auto'}
              >
                {isLoading ? (
                  <BeanProgressIcon size={10} enabled variant="indeterminate" />
                ) : (
                  <>
                    {getDisplayString(
                      apys && apys['30d'] ? apys['30d'][metric].times(100) : null
                    )}
                  </>
                )}
              </Box>
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
