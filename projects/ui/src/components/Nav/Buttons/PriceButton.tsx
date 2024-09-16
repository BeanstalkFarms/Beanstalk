import React, { useEffect, useMemo, useState } from 'react';
import {
  ButtonProps,
  Stack,
  Typography,
  useMediaQuery,
  Box,
  Switch,
  Chip,
  Avatar,
  Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Close } from '@mui/icons-material';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import usePools from '~/hooks/beanstalk/usePools';
import PoolCard from '~/components/Silo/PoolCard';
import BeanProgressIcon from '~/components/Common/BeanProgressIcon';
import useSeason from '~/hooks/beanstalk/useSeason';
import usePrice from '~/hooks/beanstalk/usePrice';
import {
  displayBeanPrice,
  displayBN,
  displayUSD,
  getTokenIndex,
} from '~/util/Tokens';
import { BASIN_WELL_LINK, NEW_BN, ZERO_BN } from '~/constants';
import { useThrottledFetchPools } from '~/state/bean/pools/updater';
import { useAppSelector } from '~/state';

// ------------------------------------------------------------

import { FC } from '~/types';
import useDataFeedTokenPrices from '~/hooks/beanstalk/useDataFeedTokenPrices';
import useTwaDeltaB from '~/hooks/beanstalk/useTwaDeltaB';
import { useTokens } from '~/hooks/beanstalk/useTokens';
import { Token } from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import FolderMenu from '../FolderMenu';

type PriceEntry = {
  price: BigNumber;
  twap: BigNumber;
};

const usePricesByToken = (
  prices: ReturnType<typeof useDataFeedTokenPrices>
) => {
  const { ETH, WSTETH, WBTC, WEETH, USDC, USDT } = useTokens();

  return useMemo(() => {
    const tokens = [ETH, WSTETH, WBTC, WEETH, USDC, USDT];

    const entries = tokens.reduce<Record<string, PriceEntry>>((acc, token) => {
      const price = prices[getTokenIndex(token)] || ZERO_BN;
      const twap = prices[`${token.symbol}-TWA`] || ZERO_BN;

      acc[token.address] = { price, twap };
      return acc;
    }, {});

    return entries;
  }, [ETH, WSTETH, WBTC, WEETH, USDC, USDT, prices]);
};

const UnderlyingPrices: FC<{
  showTWA: boolean;
  underlying: Token[];
  pricesByToken: ReturnType<typeof usePricesByToken>;
  togglePrices: () => void;
}> = ({ pricesByToken, showTWA = false, togglePrices, underlying }) => {
  const [index, setIndex] = useState(0);

  const currToken = underlying[index];
  const prices = pricesByToken[underlying[index]?.address];
  const price = showTWA ? prices?.twap : prices?.price;

  useEffect(() => {
    const intervalId = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % underlying.length);
    }, 2000);

    return () => clearInterval(intervalId);
  }, [underlying.length]);

  return (
    <Chip
      size="small"
      sx={{ backgroundColor: '#f6fafe', color: '#647265' }}
      avatar={<Avatar src={currToken?.logo} />}
      onClick={togglePrices}
      label={
        <Typography component="span" sx={{ textAlign: 'left' }}>
          <>{displayUSD(price || 0)}</>
          <ArrowOutwardIcon sx={{ fontSize: 12, marginLeft: '5px' }} />
        </Typography>
      }
    />
  );
};

const PriceDisplay = ({
  token,
  price,
  isTWA = false,
}: {
  token: Token;
  price: BigNumber;
  isTWA?: boolean;
}) => (
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
        src={token.logo}
      />
      {`${isTWA ? 'TWA ' : ''}${token.symbol} Price`}
    </Box>
    <div>{displayUSD(price)}</div>
  </Box>
);

const PriceOverlayContent: FC<{
  tokenPrices: ReturnType<typeof usePricesByToken>;
  underlying: Token[];
  togglePrices: () => void;
}> = ({ tokenPrices, underlying, togglePrices }) => (
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
      <Close sx={{ fontSize: 14, cursor: 'pointer' }} onClick={togglePrices} />
    </Box>
    <Stack gap={0.5}>
      {underlying.map((token) => {
        const prices = tokenPrices[token.address];
        return (
          <PriceDisplay
            key={`${token.symbol}-price`}
            token={token}
            price={prices?.price || ZERO_BN}
          />
        );
      })}
      <Box py={1}>
        <Divider sx={{ borderWidth: '0.5px', borderBottom: 0 }} />
      </Box>
      {underlying.map((token) => {
        const prices = tokenPrices[token.address];
        return (
          <PriceDisplay
            key={`${token.symbol}-price-TWA`}
            token={token}
            price={prices?.twap || ZERO_BN}
            isTWA
          />
        );
      })}
    </Stack>
    <Box sx={{ marginTop: 2 }}>
      <Typography
        sx={{ color: '#647265', fontSize: '12px', lineHeight: '14px' }}
      >
        TWA prices indicate the prices of the non-Bean asset over the last hour
        according to Beanstalk.
      </Typography>
    </Box>
  </Box>
);

const PriceButton: FC<ButtonProps> = ({ ...props }) => {
  const [showTWA, setShowTWA] = useState(false);
  const [showPrices, setShowPrices] = useState(false);

  const beanPools = useAppSelector((state) => state._bean.pools);
  const beanTokenData = useAppSelector((state) => state._bean.token);

  const tokenPrices = useDataFeedTokenPrices();
  const pricesByToken = usePricesByToken(tokenPrices);
  const beanPrice = usePrice();
  const season = useSeason();
  const pools = usePools();

  // Theme
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const isTiny = useMediaQuery('(max-width:350px)');

  const { ETH, WSTETH, WBTC, WEETH, USDC, USDT } = useTokens();
  const underlying = [ETH, WSTETH, WBTC, WEETH, USDC, USDT];
  const { data: twaDeltaBs } = useTwaDeltaB();

  const twaDeltaB = twaDeltaBs?.total || ZERO_BN;

  const toggleTWA = (v: React.ChangeEvent<HTMLInputElement>) =>
    setShowTWA(v.target.checked);
  const togglePrices = () => setShowPrices(!showPrices);

  const refetchPools = useThrottledFetchPools();

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
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <Stack gap={0.5}>
          <UnderlyingPrices
            showTWA={showTWA}
            underlying={underlying}
            pricesByToken={pricesByToken}
            togglePrices={togglePrices}
          />
        </Stack>
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
                      {displayBN(twaDeltaB, true)}
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
            href: `${BASIN_WELL_LINK}${pool.address}`,
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
        </Box>
      </div>
    </>
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
          {showPrices ? (
            <PriceOverlayContent
              tokenPrices={pricesByToken}
              underlying={underlying}
              togglePrices={togglePrices}
            />
          ) : (
            poolsContent
          )}
        </Stack>
      }
      hotkey="opt+1, alt+1"
      zeroTopLeftRadius
      {...props}
    />
  );
};

export default PriceButton;

/*  
Leaving here for reference
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
</Box> 
*/
