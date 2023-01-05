import React, { useMemo } from 'react';
import {
  ButtonProps,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import throttle from 'lodash/throttle';
import { useTheme } from '@mui/material/styles';
import { useSelector } from 'react-redux';
import usePools from '~/hooks/beanstalk/usePools';
import PoolCard from '~/components/Silo/PoolCard';
import BeanProgressIcon from '~/components/Common/BeanProgressIcon';
import useSeason from '~/hooks/beanstalk/useSeason';
import usePrice from '~/hooks/beanstalk/usePrice';
import { displayBeanPrice, displayBN } from '~/util/Tokens';
import { CURVE_LINK, NEW_BN, ZERO_BN } from '~/constants';
import { useFetchPools } from '~/state/bean/pools/updater';
import { AppState } from '~/state';
import FolderMenu from '../FolderMenu';

// ------------------------------------------------------------

import { FC } from '~/types';

const PriceButton: FC<ButtonProps> = ({ ...props }) => {
  // Data
  const pools     = usePools();
  const season    = useSeason();
  const beanPrice = usePrice();
  const beanPools = useSelector<AppState, AppState['_bean']['pools']>(
    (state) => state._bean.pools
  );
  const [_refetchPools] = useFetchPools();
  const refetchPools = useMemo(() => throttle(_refetchPools, 10_000), [_refetchPools]); // max refetch = 10s

  // Theme
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const isTiny   = useMediaQuery('(max-width:350px)');

  // Content
  const isLoading = beanPrice.eq(NEW_BN);
  const startIcon = isTiny ? undefined : (
    <BeanProgressIcon size={25} enabled={isLoading} variant="indeterminate" />
  );
  const poolsContent = Object.values(pools).map((pool, index) => (
    <PoolCard
      key={`${pool.address}-${index}`}
      pool={pool}
      poolState={beanPools[pool.address]}
      ButtonProps={{
        // FIXME: change link when more pools are added
        href: CURVE_LINK,
        // href: `https://etherscan.io/address/${pool.address}`,
        target: '_blank',
        rel: 'noreferrer',
      }}
    />
  ));

  return (
    <FolderMenu
      onOpen={refetchPools}
      startIcon={startIcon}
      buttonContent={
        <>${displayBeanPrice(beanPrice.gt(0) ? beanPrice : ZERO_BN, isMobile ? 2 : 4)}</>
      }
      drawerContent={
        <Stack sx={{ p: 2 }} gap={1}>
          <Typography variant="h4">
            Pools — Season {displayBN(season || ZERO_BN)}
          </Typography>
          <Stack gap={1}>{poolsContent}</Stack>
        </Stack>
      }
      popoverContent={<Stack gap={1} p={1}>{poolsContent}</Stack>}
      hotkey="opt+1, alt+1"
      {...props}
    />
  );
};

export default PriceButton;
