import React, { useMemo } from 'react';
import { ButtonProps, Stack, Typography, useMediaQuery, Box } from '@mui/material';
import throttle from 'lodash/throttle';
import { useTheme } from '@mui/material/styles';
import { useSelector } from 'react-redux';
import usePools from '~/hooks/beanstalk/usePools';
import PoolCard from '~/components/Silo/PoolCard';
import BeanProgressIcon from '~/components/Common/BeanProgressIcon';
import useSeason from '~/hooks/beanstalk/useSeason';
import usePrice from '~/hooks/beanstalk/usePrice';
import { displayBeanPrice, displayBN } from '~/util/Tokens';
import { BASIN_WELL_LINK, CURVE_LINK, NEW_BN, ZERO_BN } from '~/constants';
import { useFetchPools } from '~/state/bean/pools/updater';
import { AppState } from '~/state';
import FolderMenu from '../FolderMenu';

// ------------------------------------------------------------

import { FC } from '~/types';
import useDataFeedTokenPrices from '~/hooks/beanstalk/useDataFeedTokenPrices';

const PriceButton: FC<ButtonProps> = ({ ...props }) => {
  // Data
  const pools = usePools();
  const season = useSeason();
  const beanPrice = usePrice();
  const beanPools = useSelector<AppState, AppState['_bean']['pools']>(
    (state) => state._bean.pools
  );
  const beanTokenData = useSelector<AppState, AppState['_bean']['token']>(
    (state) => state._bean.token
  );
  const tokenPrices = useDataFeedTokenPrices();
  const [_refetchPools] = useFetchPools();
  const refetchPools = useMemo(
    () => throttle(_refetchPools, 10_000),
    [_refetchPools]
  ); // max refetch = 10s
  
  // Theme
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const isTiny = useMediaQuery('(max-width:350px)');

  // Content
  const isLoading = beanPrice.eq(NEW_BN);
  const startIcon = isTiny ? undefined : (
    <BeanProgressIcon size={25} enabled={isLoading} variant="indeterminate" />
  );

  const combinedDeltaB = Object.values(beanPools).reduce((accumulator, pool) => pool.deltaB.plus(accumulator), ZERO_BN);
  
  const poolsContent = 
  <>
    {Object.values(pools).map((pool, index) => (
      <PoolCard
        key={`${pool.address}-${index}`}
        pool={pool}
        poolState={beanPools[pool.address]}
        ButtonProps={{
          href: index === 0 ? CURVE_LINK : `${BASIN_WELL_LINK}${pool.address}`,
          target: '_blank',
          rel: 'noreferrer',
        }}
      />
    ))}
    <div>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>Cumulative Instantaneous deltaB:</div>
          <div>{combinedDeltaB.gte(0) && '+'}{displayBN(combinedDeltaB, true)}</div>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>Cumulative Time-Weighted deltaB:</div>
          <div>{beanTokenData.deltaB.gte(0) && '+'}{displayBN(beanTokenData.deltaB, true)}</div>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>Instantaneous ETH Price:</div>
          <div>${tokenPrices["ETH-instant"]?.toFixed(2) || 0}</div>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>Time-Weighted ETH Price:</div>
          <div>${tokenPrices.eth?.toFixed(2) || 0}</div>
        </Box>
      </Box>
    </div>
  </>

  return (
    <FolderMenu
      onOpen={refetchPools}
      startIcon={startIcon}
      buttonContent={
        <>
          $
          {displayBeanPrice(
            beanPrice.gt(0) ? beanPrice : ZERO_BN,
            isMobile ? 2 : 4
          )}
        </>
      }
      drawerContent={
        <Stack sx={{ p: 2 }} gap={1}>
          <Typography variant="h4">
            Pools — Season {displayBN(season || ZERO_BN)}
          </Typography>
          <Stack gap={1}>{poolsContent}</Stack>
        </Stack>
      }
      popoverContent={
        <Stack gap={1} p={1}>
          {poolsContent}
        </Stack>
      }
      hotkey="opt+1, alt+1"
      zeroTopLeftRadius
      {...props}
    />
  );
};

export default PriceButton;
