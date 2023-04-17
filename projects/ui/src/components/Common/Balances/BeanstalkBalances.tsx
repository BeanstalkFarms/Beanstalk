import React, { useCallback, useMemo, useState } from 'react';
import { Stack, Typography, Grid, Box } from '@mui/material';
import ResizablePieChart, { PieDataPoint } from '~/components/Common/Charts/PieChart';
import { displayBN, displayFullBN } from '~/util';
import useBeanstalkSiloBreakdown, { StateID, STATE_CONFIG } from '~/hooks/beanstalk/useBeanstalkBalancesBreakdown';
import useWhitelist from '~/hooks/beanstalk/useWhitelist';
import TokenRow from '~/components/Common/Balances/TokenRow';
import useChainConstant from '~/hooks/chain/useChainConstant';
import { BEAN } from '~/constants/tokens';
import { FC } from '~/types';

const BeanstalkBalances: FC<{
  breakdown: ReturnType<typeof useBeanstalkSiloBreakdown>;
}> = ({
  breakdown,
}) => {
  // Constants
  const WHITELIST = useWhitelist();
  const Bean = useChainConstant(BEAN);
  const availableTokens = useMemo(() => Object.keys(breakdown.tokens), [breakdown.tokens]);

  // Drilldown against a State of Token (DEPOSITED, WITHDRAWN, etc.)
  const [hoverAddress, setHoverAddress] = useState<keyof typeof breakdown.tokens>(availableTokens[0]);
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
  
  const onMouseOver = useCallback((address: string) => (
    allowNewHoverState ? () => setHoverAddress(address) : undefined
  ), [allowNewHoverState]);

  const onClick = useCallback((address: string) => () => {
    setHoverAddress(address);
  }, []);

  //
  const hoverToken = hoverAddress ? WHITELIST[hoverAddress] : undefined;
  const assetLabel = hoverToken?.name || 'Token';

  // Compile Pie chart data
  const pieChartData = useMemo(() => {
    if (hoverAddress && breakdown.tokens[hoverAddress]) {
      const thisAddress = breakdown.tokens[hoverAddress];
      if (!thisAddress?.byState) return [];
      return Object.keys(thisAddress.byState).reduce<PieDataPoint[]>((prev, state) => {
        const amount = thisAddress.byState[state].amount;
        if (amount) {
          prev.push({
            // Required for PieChart
            label: STATE_CONFIG[state as StateID][0],
            value: amount.toNumber(),
            color: STATE_CONFIG[state as StateID][1],
            // Additional
            state: state,
          });
        }
        return prev;
      }, []);
    }
    return [];
  }, [hoverAddress, breakdown]);

  return (
    <Grid container direction="row" alignItems="center" sx={{ mb: 4, mt: { md: 0, xs: 0 }, minHeight: 300 }} rowSpacing={2}>
      {/**
        * Left column:
        *   Show each whitelisted Token and the total combined USD
        *   value of that Token across all states.
        */}
      <Grid item xs={12} md={4}>
        <Stack px={{ xs: 0, md: 1 }} py={1} onMouseLeave={onMouseOutContainer} onBlur={onMouseOutContainer}>
          {availableTokens.map((address) => (
            <TokenRow
              key={address}
              label={WHITELIST[address].name}
              color={WHITELIST[address].color}
              showColor={!hoverAddress}
              token={WHITELIST[address]}
              amount={displayBN(breakdown.tokens[address].amount)}
              isFaded={hoverAddress !== null && hoverAddress !== address}
              isSelected={hoverAddress === address}
              onMouseOver={onMouseOver(address)}
              onClick={onClick(address)}
            />
          ))}
        </Stack>
      </Grid>
      {/**
        * Center Column:
        * Show a pie chart breaking down each of the above Tokens.
        */}
      <Grid item xs={12} md={4}>
        <Box display="flex" justifyContent="center" sx={{ height: 235, py: { xs: 1, md: 0 }, px: 1 }}>
          <ResizablePieChart
            title={(
              hoverAddress
                ? assetLabel
                : `All ${assetLabel}s`
            )}
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
        {(hoverAddress && hoverToken && breakdown.tokens[hoverAddress]) ? (
          <Stack gap={1}>
            <Typography variant="h4" sx={{ display: { xs: 'none', md: 'block' }, mx: 0.75 }}>
              {hoverToken.name}
            </Typography>
            <Box>
              {pieChartData.map((dp) => {
                const state = dp.state as StateID;
                const tokenState = breakdown.tokens[hoverAddress].byState[state];
                if (!tokenState.amount) return null;
                return (
                  <TokenRow
                    key={state}
                    label={dp.label}
                    color={dp.color}
                    showColor={tokenState.amount.gt(0)}
                    isFaded={false}
                    amount={displayFullBN(tokenState.amount, 2, 2)}
                    labelTooltip={STATE_CONFIG[state][2](
                      hoverToken === Bean
                        ? 'Beans'
                        : hoverToken.symbol
                    )}
                  />
                );
              })}
            </Box>
          </Stack>
        ) : (
          <Stack alignItems="center" justifyContent="center" sx={{ pt: 5, pb: 5 }}>
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
