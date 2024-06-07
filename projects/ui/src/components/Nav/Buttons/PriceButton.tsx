import React, { useMemo, useState } from 'react';
import {
  ButtonProps,
  Stack,
  Typography,
  useMediaQuery,
  Box,
  Link,
  Switch,
  Chip,
  Avatar,
} from '@mui/material';
import throttle from 'lodash/throttle';
import { useTheme } from '@mui/material/styles';
import { Close } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import usePools from '~/hooks/beanstalk/usePools';
import PoolCard from '~/components/Silo/PoolCard';
import BeanProgressIcon from '~/components/Common/BeanProgressIcon';
import useSeason from '~/hooks/beanstalk/useSeason';
import usePrice from '~/hooks/beanstalk/usePrice';
import { displayBeanPrice, displayBN } from '~/util/Tokens';
import { BASIN_WELL_LINK, CURVE_LINK, NEW_BN, ZERO_BN } from '~/constants';
import { useFetchPools } from '~/state/bean/pools/updater';
import { AppState } from '~/state';
import ethereumLogo from '~/img/tokens/eth-logo-circled.svg';

// ------------------------------------------------------------

import { FC } from '~/types';
import useDataFeedTokenPrices from '~/hooks/beanstalk/useDataFeedTokenPrices';
import FolderMenu from '../FolderMenu';

const poolLinks: { [key: string]: string } = {
  '0xc9c32cd16bf7efb85ff14e0c8603cc90f6f2ee49': CURVE_LINK,
  '0xbea0e11282e2bb5893bece110cf199501e872bad': `${BASIN_WELL_LINK}0xbea0e11282e2bb5893bece110cf199501e872bad`,
};

const PriceButton: FC<ButtonProps> = ({ ...props }) => {
  const [showDeprecated, setShowDeprecated] = useState(false);

  const pools = usePools(showDeprecated);
  for (const [address, pool] of Object.entries(pools)) {
    pool.link = poolLinks[address];
  }
  const [showTWA, setShowTWA] = useState(false);
  const [showPrices, setShowPrices] = useState(false);
  const season = useSeason();
  const beanPrice = usePrice();
  const beanPools = useSelector<AppState, AppState['_bean']['pools']>(
    (state) => state._bean.pools
  );

  const toggleDisplayedPools = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    setShowDeprecated(!showDeprecated);
  };

  const toggleTWA = (v: React.ChangeEvent<HTMLInputElement>) =>
    setShowTWA(v.target.checked);

  const togglePrices = () => setShowPrices(!showPrices);

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

  // calculate based on which pools we're shoing.
  // This is very weird code here, but we're just working with what we got
  const combinedDeltaB = Object.entries(beanPools)
    .map(([address, value]) => ({ ...value, address }))
    .filter((item) => Object.keys(pools).includes(item.address))
    .reduce((accumulator, pool) => pool.deltaB.plus(accumulator), ZERO_BN);

  const poolsContent = (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <Chip
            size="small"
            sx={{ backgroundColor: '#f6fafe', color: '#647265' }}
            avatar={<Avatar src={ethereumLogo} />}
            onClick={togglePrices}
            label={
              <span>
                {showTWA ? (
                  <> ${tokenPrices['ETH-TWA']?.toFixed(2) || 0}</>
                ) : (
                  <> ${tokenPrices.eth?.toFixed(2) || 0}</>
                )}

                <ArrowOutwardIcon sx={{ fontSize: 12, marginLeft: '5px' }} />
              </span>
            }
          />
        </div>
        <div>
          <Chip
            sx={{ backgroundColor: '#f6fafe', color: '#647265' }}
            size="small"
            label={
              <span>
                {showTWA ? (
                  <>
                    Total TWA deltaB:{' '}
                    <strong>
                      {beanTokenData.deltaB.gte(0) && '+'}
                      {displayBN(beanTokenData.deltaB, true)}
                    </strong>
                  </>
                ) : (
                  <>
                    Total deltaB:{' '}
                    <strong>
                      {combinedDeltaB.gte(0) && '+'}
                      {displayBN(combinedDeltaB, true)}
                    </strong>
                  </>
                )}
              </span>
            }
          />
        </div>
      </Box>
      {Object.values(pools).map((pool, index) => (
        <PoolCard
          key={`${pool.address}-${index}`}
          pool={pool}
          poolState={beanPools[pool.address]}
          useTWA={showTWA}
          ButtonProps={{
            href: `${pool.link}`,
            target: '_blank',
            rel: 'noreferrer',
          }}
        />
      ))}
      <div>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f7f7f7',
            border: '1px solid #ecf7fe',
            padding: '5px 10px;',
            borderRadius: '10px',
            alignItems: 'stretch',
            ...(showTWA
              ? { backgroundColor: '#f6fafe', color: '#647265' }
              : {}),
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography
              variant="bodySmall"
              sx={{ fontWeight: 600, fontSize: '12px', color: '#595959' }}
            >
              Show deltaB as time-weighted average
            </Typography>
            <Switch
              checked={showTWA}
              onChange={toggleTWA}
              inputProps={{ 'aria-label': 'controlled' }}
            />
          </Box>
          <Typography
            variant="bodySmall"
            sx={{ color: '#9ca39b', fontSize: '13px' }}
          >
            {showTWA ? (
              <>
                {' '}
                Beanstalk uses the time-weighted average deltaB to determine how
                many Beans and Soil to mint each Season.
              </>
            ) : (
              <>
                {' '}
                Show the time-weighted average shortage or excess of Beans in
                each pool since the beginning of the Season.
              </>
            )}
          </Typography>

          {/*  Leaving here for reference
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>Cumulative Instantaneous deltaB:</div>
            <div>
              {combinedDeltaB.gte(0) && '+'}
              {displayBN(combinedDeltaB, true)}
            </div>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>Cumulative Time-Weighted deltaB:</div>
            <div>
              {beanTokenData.deltaB.gte(0) && '+'}
              {displayBN(beanTokenData.deltaB, true)}
            </div>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>Instantaneous ETH Price:</div>
            <div>${tokenPrices.eth?.toFixed(2) || 0}</div>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>Time-Weighted ETH Price:</div>
            <div>${tokenPrices['ETH-TWA']?.toFixed(2) || 0}</div>
          </Box> */}
        </Box>
        <Box
          sx={{ padding: '5px', textAlign: 'center', fontSize: '12px' }}
          maxWidth="sm"
        >
          <Link
            onClick={toggleDisplayedPools}
            sx={{ color: '#647265', cursor: 'pointer' }}
          >
            {showDeprecated
              ? 'Show only whitelisted pools'
              : 'Show dewhitelisted pools'}
          </Link>
        </Box>
      </div>
    </>
  );

  const priceContent = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #ecf7fe',
        borderRadius: '10px',
        alignItems: 'stretch',
        backgroundColor: '#f6fafe',
        padding: '10px',
        gap: '10px',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
          Prices of Non-Bean Assets
        </Typography>
        <Close
          sx={{ fontSize: 14, cursor: 'pointer' }}
          onClick={togglePrices}
        />
      </Box>

      {/* ETH Price */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box display="flex" flexDirection="row">
          <Avatar
            sx={{ width: 18, height: 18, marginRight: '5px' }}
            src={ethereumLogo}
          />{' '}
          ETH Price
        </Box>
        <div>${tokenPrices.eth?.toFixed(2) || 0}</div>
      </Box>

      {/* TWA ETH Price */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box display="flex" flexDirection="row">
          <Avatar
            sx={{ width: 18, height: 18, marginRight: '5px' }}
            src={ethereumLogo}
          />{' '}
          TWA ETH Price
        </Box>
        <div>${tokenPrices['ETH-TWA']?.toFixed(2) || 0}</div>
      </Box>

      <Box sx={{ marginTop: '100px' }}>
        <Typography
          sx={{ color: '#647265', fontSize: '12px', lineHeight: '14px' }}
        >
          TWA prices indicate the prices of the non-Bean asset over the last
          hour according to Beanstalk.
        </Typography>
      </Box>
    </Box>
  );

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
          {showPrices ? priceContent : poolsContent}
        </Stack>
      }
      hotkey="opt+1, alt+1"
      zeroTopLeftRadius
      {...props}
    />
  );
};

export default PriceButton;
