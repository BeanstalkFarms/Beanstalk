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
import useChainId from '~/hooks/chain/useChainId';
import FolderMenu from '../FolderMenu';

type TokenPriceEntry = {
  token: Token;
  price: BigNumber;
  twap: BigNumber;
};

const usePricesAndTWAPByToken = () => {
  const prices = useDataFeedTokenPrices();
  const { ETH, WSTETH, WBTC, WEETH, USDC, USDT } = useTokens();

  return useMemo(() => {
    const tokens = [ETH, WSTETH, WBTC, WEETH, USDC, USDT];

    const entries = tokens.reduce<Record<string, TokenPriceEntry>>(
      (acc, token) => {
        const price = prices[getTokenIndex(token)] || ZERO_BN;
        const twap = prices[`${token.symbol}-TWA`] || ZERO_BN;

        acc[token.address] = { price, twap, token };
        return acc;
      },
      {}
    );

    return {
      underlying: tokens,
      tokenMap: entries,
    };
  }, [ETH, WSTETH, WBTC, WEETH, USDC, USDT, prices]);
};

const UnderlyingPrices: FC<{
  showTWA: boolean;
  tokenPrices: ReturnType<typeof usePricesAndTWAPByToken>;
  togglePrices: () => void;
}> = ({
  tokenPrices: { tokenMap, underlying },
  showTWA = false,
  togglePrices,
}) => {
  const [index, setIndex] = useState(0);

  const currToken = underlying[index];
  const prices = tokenMap[underlying[index]?.address];
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
  tokenPrices: ReturnType<typeof usePricesAndTWAPByToken>;
  togglePrices: () => void;
}> = ({ tokenPrices: { tokenMap, underlying }, togglePrices }) => (
  <Stack
    p={1}
    gap={1}
    sx={{
      border: '1px solid #ecf7fe',
      borderRadius: '10px',
      alignItems: 'stretch',
      backgroundColor: '#f6fafe',
    }}
  >
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
        Prices of Non-Bean Assets
      </Typography>
      <Close sx={{ fontSize: 14, cursor: 'pointer' }} onClick={togglePrices} />
    </Stack>
    <Stack gap={0.5}>
      {underlying.map((token) => {
        const prices = tokenMap[token.address];
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
        const prices = tokenMap[token.address];
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
  </Stack>
);

const PriceButton: FC<ButtonProps> = ({ ...props }) => {
  const chainId = useChainId();
  //
  const [showTWA, setShowTWA] = useState(false);
  const [showPrices, setShowPrices] = useState(false);

  //
  const beanPools = useAppSelector((state) => state._bean.pools);
  const beanTokenData = useAppSelector((state) => state._bean.token);
  const beanPrice = usePrice();
  const season = useSeason();
  const pools = usePools();

  const tokenPrices = usePricesAndTWAPByToken();
  const refetchPools = useThrottledFetchPools();
  const { data: twaDeltaBs } = useTwaDeltaB();

  // Theme
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const isTiny = useMediaQuery('(max-width:350px)');

  // Callbacks
  const toggleTWA = (v: React.ChangeEvent<HTMLInputElement>) =>
    setShowTWA(v.target.checked);
  const togglePrices = () => setShowPrices(!showPrices);

  // Content
  const isLoading = beanPrice.eq(NEW_BN);
  const startIcon = isTiny ? undefined : (
    <BeanProgressIcon size={25} enabled={isLoading} variant="indeterminate" />
  );

  // Derived
  const twaDeltaB = twaDeltaBs?.total || ZERO_BN;

  // calculate based on which pools we're showing.
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
            tokenPrices={tokenPrices}
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
            href: `${BASIN_WELL_LINK}${chainId}/${pool.address}`,
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

  const menuContent = (
    <Stack gap={1}>
      {showPrices ? (
        <PriceOverlayContent
          tokenPrices={tokenPrices}
          togglePrices={togglePrices}
        />
      ) : (
        poolsContent
      )}
    </Stack>
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
          {menuContent}
        </Stack>
      }
      popoverContent={<Stack p={1}>{menuContent}</Stack>}
      hotkey="opt+1, alt+1"
      zeroTopLeftRadius
      {...props}
    />
  );
};

export default PriceButton;
