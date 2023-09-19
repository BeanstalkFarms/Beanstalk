import React, { useCallback, useMemo, useState } from 'react';
import { Stack, Typography, Grid, Box } from '@mui/material';
import BigNumber from 'bignumber.js';
import ResizablePieChart, {
  PieDataPoint,
} from '~/components/Common/Charts/PieChart';
import { displayBN, displayFullBN } from '~/util';
import useBeanstalkSiloBreakdown, {
  StateID,
  STATE_CONFIG,
} from '~/hooks/beanstalk/useBeanstalkBalancesBreakdown';
import useWhitelist from '~/hooks/beanstalk/useWhitelist';
import TokenRow from '~/components/Common/Balances/TokenRow';
import useChainConstant from '~/hooks/chain/useChainConstant';
import { BEAN, UNRIPE_BEAN, UNRIPE_BEAN_CRV3 } from '~/constants/tokens';
import { FC } from '~/types';
import StatHorizontal from '../StatHorizontal';
import { useAppSelector } from '~/state';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
import useUnripeUnderlyingMap from '~/hooks/beanstalk/useUnripeUnderlying';
import { ERC20Token } from '~/classes/Token';
import useSiloTokenToFiat from '~/hooks/beanstalk/useSiloTokenToFiat';

const BeanstalkBalances: FC<{
  breakdown: ReturnType<typeof useBeanstalkSiloBreakdown>;
}> = ({ breakdown }) => {
  // Constants
  const WHITELIST = useWhitelist();
  const getChainToken = useGetChainToken();
  const Bean = useChainConstant(BEAN);
  const urBean = getChainToken(UNRIPE_BEAN);
  const urBeanCrv3 = getChainToken(UNRIPE_BEAN_CRV3);
  const availableTokens = useMemo(
    () => Object.keys(breakdown.tokens),
    [breakdown.tokens]
  );
  const beanPrice = breakdown.tokens[Bean.address]?.value.div(
    breakdown.tokens[Bean.address]?.amount
  );
  const unripeTokens = useAppSelector(
    (state) => state._bean.unripe
  );
  const loadingUnripe = Object.keys(unripeTokens).length === 0;
  
  const unripeUnderlyingTokens = useUnripeUnderlyingMap();
  const siloTokenToFiat = useSiloTokenToFiat();

  function isTokenUnripe(tokenAddress: string) {
    return (tokenAddress.toLowerCase() === urBean.address || tokenAddress.toLowerCase() === urBeanCrv3.address);
  }

  // Drilldown against a State of Token (DEPOSITED, WITHDRAWN, etc.)
  const [hoverAddress, setHoverAddress] = useState<
    keyof typeof breakdown.tokens
  >(availableTokens[0]);
  const allowNewHoverState = true;

  ///
  useMemo(() => {
    setHoverAddress(availableTokens[0]);
  }, [availableTokens]);

  // Drilldown handlers
  const onMouseOutContainer = useCallback(() => {
    if (!allowNewHoverState) {
      setHoverAddress(availableTokens[0]);
    }
  }, [allowNewHoverState, availableTokens]);

  const onMouseOver = useCallback(
    (address: string) =>
      allowNewHoverState ? () => setHoverAddress(address) : undefined,
    [allowNewHoverState]
  );

  const onClick = useCallback(
    (address: string) => () => {
      setHoverAddress(address);
    },
    []
  );

  //
  const hoverToken = hoverAddress ? WHITELIST[hoverAddress] : undefined;
  const assetLabel = hoverToken?.name || 'Token';

  function getUnripeBreakdown(token: ERC20Token, amount: BigNumber) {
    if (!token || !amount || !isTokenUnripe(token.address) || loadingUnripe) return { bdv: BigNumber(0), usd: BigNumber(0) };

    const ratio = amount.div(unripeTokens[token.address].supply);
    const ratioAmount = unripeTokens[token.address].underlying.multipliedBy(ratio);
    const bdv = siloTokenToFiat(
      token,
      ratioAmount,
      'bdv',
      false
    );
    const usd = siloTokenToFiat(
      token,
      ratioAmount,
      'usd',
      false
    );

    return ({ bdv: bdv, usd: usd });
  }

  function amountTooltip(token: ERC20Token, amount: BigNumber, isBreakdown?: boolean) {
    if (!beanPrice || !token || !amount || loadingUnripe) return undefined;

    const isUnripe = isTokenUnripe(token.address);
    const underlyingToken = isUnripe ? unripeUnderlyingTokens[token.address] : token;
    const tokenAmount = isUnripe ? unripeTokens[token.address].underlying : amount;
    const bdv = isBreakdown && isUnripe 
      ? getUnripeBreakdown(token, amount).bdv 
      : siloTokenToFiat(
          underlyingToken,
          tokenAmount,
          'bdv',
          false
        );

    return (
      <Stack gap={0.5}>
        <StatHorizontal label="Token Amount">
          {displayFullBN(amount, 2, 2)}
        </StatHorizontal>
        <StatHorizontal label="BDV">
          {displayFullBN(bdv, 2, 2)}
        </StatHorizontal>
      </Stack>
    );
  }

  // Compile Pie chart data
  const pieChartData = useMemo(() => {
    if (hoverAddress && breakdown.tokens[hoverAddress]) {
      const thisAddress = breakdown.tokens[hoverAddress];
      if (!thisAddress?.byState) return [];
      return Object.keys(thisAddress.byState).reduce<PieDataPoint[]>(
        (prev, state) => {
          const value = thisAddress.byState[state].value;
          if (value) {
            prev.push({
              // Required for PieChart
              label: STATE_CONFIG[state as StateID][0],
              value: value.toNumber(),
              color: STATE_CONFIG[state as StateID][1],
              // Additional
              state: state,
            });
          }
          return prev;
        },
        []
      );
    }
    return [];
  }, [hoverAddress, breakdown]);

  return (
    <Grid
      container
      direction="row"
      alignItems="center"
      sx={{ mb: 4, mt: { md: 0, xs: 0 }, minHeight: 300 }}
      rowSpacing={2}
    >
      {/**
       * Left column:
       *   Show each whitelisted Token and the total combined USD
       *   value of that Token across all states.
       */}
      <Grid item xs={12} md={4}>
        <Stack
          px={{ xs: 0, md: 1 }}
          py={1}
          onMouseLeave={onMouseOutContainer}
          onBlur={onMouseOutContainer}
        >
          {availableTokens.map((address) => (
            <TokenRow
              key={address}
              label={WHITELIST[address].name}
              color={WHITELIST[address].color}
              showColor={!hoverAddress}
              token={WHITELIST[address]}
              value={
                isTokenUnripe(address) && !loadingUnripe
                  ? displayBN(
                      siloTokenToFiat(
                        unripeUnderlyingTokens[address],
                        unripeTokens[address].underlying,
                        'usd',
                        false
                      )
                    )
                  : displayBN(breakdown.tokens[address].value)
              }
              isFaded={hoverAddress !== null && hoverAddress !== address}
              isSelected={hoverAddress === address}
              onMouseOver={onMouseOver(address)}
              onClick={onClick(address)}
              amountTooltip={amountTooltip(
                WHITELIST[address],
                breakdown.tokens[address].amount
              )}
            />
          ))}
        </Stack>
      </Grid>
      {/**
       * Center Column:
       * Show a pie chart breaking down each of the above Tokens.
       */}
      <Grid item xs={12} md={4}>
        <Box
          display="flex"
          justifyContent="center"
          sx={{ height: 235, py: { xs: 1, md: 0 }, px: 1 }}
        >
          <ResizablePieChart
            title={hoverAddress ? assetLabel : `All ${assetLabel}s`}
            data={breakdown.totalValue.gt(0) ? pieChartData : undefined}
          />
        </Box>
      </Grid>
      {/**
       * Right column:
       * When hovering over a Token, show a breakdown of the
       * individual states of that token.
       */}
      <Grid item xs={12} md={4}>
        {hoverAddress && hoverToken && breakdown.tokens[hoverAddress] ? (
          <Stack gap={1}>
            <Typography
              variant="h4"
              sx={{ display: { xs: 'none', md: 'block' }, mx: 0.75 }}
            >
              {hoverToken.name}
            </Typography>
            <Box>
              {pieChartData.map((dp) => {
                const state = dp.state as StateID;
                const tokenState =
                  breakdown.tokens[hoverAddress].byState[state];
                const isUnripe = isTokenUnripe(hoverToken.address);
                let unripeValue = BigNumber(0);
                if (!tokenState.value || !tokenState.amount) return null;
                if (isUnripe) {
                  unripeValue = getUnripeBreakdown(hoverToken, tokenState.amount).usd;
                }
                return (
                  <TokenRow
                    key={state}
                    label={dp.label}
                    color={dp.color}
                    showColor={tokenState.value.gt(0)}
                    isFaded={false}
                    value={displayFullBN(isUnripe ? unripeValue : tokenState.value, 2, 2)
                    }
                    labelTooltip={STATE_CONFIG[state][2](
                      hoverToken === Bean ? 'Beans' : hoverToken.symbol
                    )}
                    amountTooltip={amountTooltip(
                      hoverToken,
                      tokenState.amount,
                      true
                    )}
                  />
                );
              })}
            </Box>
          </Stack>
        ) : (
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{ pt: 5, pb: 5 }}
          >
            <Typography color="text.secondary">
              Hover over a {assetLabel.toLowerCase()} to see breakdown
            </Typography>
          </Stack>
        )}
      </Grid>
    </Grid>
  );
};

export default BeanstalkBalances;
