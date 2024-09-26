import React from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  Divider,
  Grid,
  Link,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import { Link as RouterLink } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Token } from '@beanstalk/sdk';
import { AppState, useAppSelector } from '~/state';
import TokenIcon from '~/components/Common/TokenIcon';
import { ONE_BN, ZERO_BN } from '~/constants';
import {
  displayFullBN,
  displayTokenAmount,
  tokenIshEqual,
} from '~/util/Tokens';
import useBDV from '~/hooks/beanstalk/useBDV';
import {
  BeanstalkPalette,
  FontSize,
  IconSize,
} from '~/components/App/muiTheme';
import Fiat from '~/components/Common/Fiat';
import useSetting from '~/hooks/app/useSetting';
import Row from '~/components/Common/Row';
import Stat from '~/components/Common/Stat';
import useUnripeUnderlyingMap from '~/hooks/beanstalk/useUnripeUnderlying';
import stalkIcon from '~/img/beanstalk/stalk-icon.svg';
import logo from '~/img/tokens/bean-logo.svg';
import { FC } from '~/types';
import { useBeanstalkTokens, useTokens } from '~/hooks/beanstalk/useTokens';
import { formatTV } from '~/util';
import SiloAssetApyChip from './SiloAssetApyChip';
import StatHorizontal from '../Common/StatHorizontal';
import BeanProgressIcon from '../Common/BeanProgressIcon';

/**
 * Display a pseudo-table of Whitelisted Silo Tokens.
 * This table is the entry point to deposit Beans, LP, etc.
 */

const ARROW_CONTAINER_WIDTH = 20;
const TOOLTIP_COMPONENT_PROPS = {
  tooltip: {
    sx: {
      maxWidth: 'none !important',
      // boxShadow: '0px 6px 20px 10px rgba(255,255,255,0.3) !important'
    },
  },
};

const Whitelist: FC<{
  farmerSilo: AppState['_farmer']['silo'];
  whitelist: Token[];
}> = ({ farmerSilo, whitelist }) => {
  /// Settings
  const [denomination] = useSetting('denomination');
  const account = useAccount();

  /// Chain
  const { BEAN, UNRIPE_BEAN, UNRIPE_BEAN_WSTETH } = useTokens();
  const { STALK, SEEDS } = useBeanstalkTokens();
  const unripeUnderlyingTokens = useUnripeUnderlyingMap();

  /// State
  const getBDV = useBDV();
  const beanstalkSilo = useAppSelector((state) => state._beanstalk.silo);
  const unripeTokens = useAppSelector((state) => state._bean.unripe);

  return (
    <Card>
      <Box sx={{ overflowX: 'auto' }}>
        <Box sx={{ minWidth: '1100px' }}>
          {/* Header */}
          <Box
            display="flex"
            sx={{
              px: 3, // 1 + 2 from Table Body
              pt: '14px', // manually adjusted
              pb: '14px', // manually adjusted
              borderBottomStyle: 'solid',
              borderBottomColor: 'divider',
              borderBottomWidth: 1,
            }}
          >
            <Grid container alignItems="center">
              <Grid item xs={2.25}>
                <Typography color="text.secondary">Token</Typography>
              </Grid>
              <Grid item xs={1}>
                <Tooltip title="The amount of Stalk and Seeds earned for each 1 Bean Denominated Value (BDV) Deposited in the Silo.">
                  <Typography color="text.secondary">Rewards</Typography>
                </Tooltip>
              </Grid>
              <Grid item xs={2.25} justifyContent="center">
                <Tooltip title="Estimated annual Beans earned by a Stalkholder for Depositing an asset.">
                  <Chip
                    variant="filled"
                    color="primary"
                    label={
                      <Row gap={0.5}>
                        <TokenIcon token={BEAN} />
                        vAPY 24H
                        <Typography color="white" marginTop={-0.25}>
                          |
                        </Typography>
                        7D
                        <Typography color="white" marginTop={-0.25}>
                          |
                        </Typography>
                        30D
                      </Row>
                    }
                    onClick={undefined}
                    size="small"
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={1.25} justifyContent="center">
                <Tooltip title="Estimated annual growth in Stalk for Depositing an asset.">
                  <Typography color="text.primary">
                    <TokenIcon
                      token={{ symbol: 'Stalk', logo: stalkIcon } as Token}
                    />{' '}
                    vAPY
                  </Typography>
                </Tooltip>
              </Grid>
              <Grid item xs={1}>
                <Tooltip title="Total Value Deposited in the Silo.">
                  <Typography color="text.secondary">TVD</Typography>
                </Tooltip>
              </Grid>
              <Grid item xs={2.75}>
                <Typography color="text.secondary">Amount Deposited</Typography>
              </Grid>
              <Grid
                item
                xs={1.5}
                sx={{
                  textAlign: 'right',
                  paddingRight: { xs: 0, md: `${ARROW_CONTAINER_WIDTH}px` },
                }}
              >
                <Tooltip
                  title={
                    <>
                      The value of your Silo deposits for each whitelisted
                      token, denominated in{' '}
                      {denomination === 'bdv' ? 'Beans' : 'USD'}.
                      <br />
                      <Typography
                        color="text.secondary"
                        fontSize={FontSize.sm}
                        fontStyle="italic"
                      >
                        Switch to {denomination === 'bdv' ? 'USD' : 'Beans'}:
                        Option + F
                      </Typography>
                    </>
                  }
                >
                  <Typography color="text.secondary">
                    Value Deposited
                  </Typography>
                </Tooltip>
              </Grid>
            </Grid>
          </Box>
          {/* Rows */}
          <Stack gap={1} p={1}>
            {whitelist.map((token) => {
              const deposited = farmerSilo.balances[token.address]?.deposited;
              const isUnripe =
                tokenIshEqual(token, UNRIPE_BEAN) ||
                tokenIshEqual(token, UNRIPE_BEAN_WSTETH);
              const isUnripeLP =
                isUnripe && token.address === UNRIPE_BEAN_WSTETH.address;

              // Unripe data
              const underlyingToken = isUnripe
                ? unripeUnderlyingTokens[token.address]
                : null;
              const pctUnderlyingDeposited = isUnripe
                ? (
                    beanstalkSilo.balances[token.address]?.deposited.amount ||
                    ZERO_BN
                  ).div(unripeTokens[token.address]?.supply || ONE_BN)
                : ONE_BN;

              const wlSx = {
                textAlign: 'left',
                px: 2,
                py: 1.5,
                borderColor: 'divider',
                borderWidth: '0.5px',
                background: BeanstalkPalette.white,
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'primary.light',
                },
              };

              return (
                <Box key={`${token.address}-${token.chainId}`}>
                  <Button
                    component={RouterLink}
                    to={`/silo/${token.address}`}
                    fullWidth
                    variant="outlined"
                    color="primary"
                    size="large"
                    sx={wlSx}
                  >
                    <Grid container alignItems="center">
                      {/**
                       * Cell: Token
                       */}
                      <Grid item xs={2.25}>
                        <Row gap={1}>
                          <Box
                            component="img"
                            src={token.logo}
                            alt={token.name}
                            css={{
                              height: IconSize.medium,
                              display: 'inline',
                              opacity: 1,
                            }}
                          />
                          <Typography display="inline" color="text.primary">
                            {token.name}
                          </Typography>
                        </Row>
                      </Grid>
                      {/**
                       * Cell: Rewards
                       */}
                      <Grid item xs={1}>
                        <Row gap={0.75}>
                          <Tooltip
                            placement="right"
                            title={
                              <Stack gap={0.25}>
                                1 {token.symbol} ={' '}
                                {displayFullBN(getBDV(token), 6)} BDV
                                <Row gap={0.2}>
                                  <TokenIcon
                                    token={STALK}
                                    css={{
                                      height: '0.8em',
                                      marginTop: '-1px',
                                    }}
                                  />
                                  <Typography color="text.primary" mr={0.2}>
                                    {formatTV(token.rewards?.stalk, 0)}
                                  </Typography>
                                  <TokenIcon token={SEEDS} />
                                  <Typography color="text.primary">
                                    {formatTV(
                                      token.rewards?.seeds,
                                      SEEDS.decimals
                                    )}
                                  </Typography>
                                </Row>
                              </Stack>
                            }
                          >
                            <Box>
                              <Row gap={0.2}>
                                <TokenIcon
                                  token={STALK}
                                  css={{ height: '0.8em', marginTop: '-1px' }}
                                />
                                <Typography color="text.primary" mr={0.2}>
                                  {formatTV(token.rewards?.stalk, 0)}
                                </Typography>
                                <TokenIcon token={SEEDS} />
                                <Typography color="text.primary">
                                  {formatTV(token.rewards?.seeds, 3)}
                                </Typography>
                              </Row>
                            </Box>
                          </Tooltip>
                        </Row>
                      </Grid>
                      {/**
                       * Cell: Bean APY
                       */}
                      <Grid item xs={2.25} justifyContent="center">
                        <SiloAssetApyChip token={token} metric="bean" />
                      </Grid>
                      {/**
                       * Cell: Stalk APY
                       */}
                      <Grid item xs={1.25} justifyContent="center">
                        <SiloAssetApyChip token={token} metric="stalk" />
                      </Grid>
                      {/**
                       * Cell: TVD
                       */}
                      <Grid item xs={1}>
                        <Tooltip
                          placement="right"
                          componentsProps={TOOLTIP_COMPONENT_PROPS}
                          title={
                            isUnripe && underlyingToken ? (
                              <Stack gap={0.5}>
                                <Stack
                                  direction={{ xs: 'column', md: 'row' }}
                                  gap={{ xs: 0, md: 1 }}
                                  alignItems="stretch"
                                >
                                  <Row display={{ xs: 'none', md: 'flex' }}>
                                    =
                                  </Row>
                                  <Box sx={{ px: 1, py: 0.5, maxWidth: 215 }}>
                                    <Stat
                                      title={
                                        <Row gap={0.5}>
                                          <TokenIcon token={underlyingToken} />{' '}
                                          Ripe {underlyingToken.symbol}
                                        </Row>
                                      }
                                      gap={0.25}
                                      variant="h4"
                                      amount={
                                        <Fiat
                                          token={underlyingToken}
                                          amount={
                                            unripeTokens[token.address]
                                              ?.underlying || ZERO_BN
                                          }
                                          chop={false}
                                        />
                                      }
                                      subtitle={`The ${denomination.toUpperCase()} value of the ${
                                        underlyingToken?.symbol
                                      } underlying all ${token.symbol}.`}
                                    />
                                  </Box>
                                  <Row>×</Row>
                                  <Box sx={{ px: 1, py: 0.5, maxWidth: 215 }}>
                                    {isUnripeLP ? (
                                      <Stat
                                        title="Chop Amount"
                                        gap={0.25}
                                        variant="h4"
                                        amount={`${unripeTokens[token.address]?.penalty?.times(100).toFixed(3)}%`}
                                        subtitle="The amount of BEANwstETH received for Chopping 1 urBEANwstETH."
                                      />
                                    ) : (
                                      <Stat
                                        title="Chop Rate"
                                        gap={0.25}
                                        variant="h4"
                                        amount={`1 - ${(
                                          unripeTokens[token.address]
                                            ?.chopPenalty || ZERO_BN
                                        ).toFixed(4)}%`}
                                        subtitle={
                                          <>
                                            The current penalty for Chopping
                                            <br />
                                            {token.symbol} for{' '}
                                            {
                                              unripeUnderlyingTokens[
                                                token.address
                                              ].symbol
                                            }
                                            .{' '}
                                            <Link
                                              href="https://docs.bean.money/almanac/farm/barn#chopping"
                                              target="_blank"
                                              rel="noreferrer"
                                              underline="hover"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                              }}
                                            >
                                              Learn more
                                            </Link>
                                          </>
                                        }
                                      />
                                    )}
                                  </Box>
                                  <Row>×</Row>
                                  <Box sx={{ px: 1, py: 0.5, maxWidth: 215 }}>
                                    <Stat
                                      title="% Deposited"
                                      gap={0.25}
                                      variant="h4"
                                      amount={`${pctUnderlyingDeposited
                                        .times(100)
                                        .toFixed(2)}%`}
                                      subtitle={
                                        <>
                                          The percentage of all {token.symbol}{' '}
                                          that is currently Deposited in the
                                          Silo.
                                        </>
                                      }
                                    />
                                  </Box>
                                </Stack>
                                <Divider sx={{ borderColor: 'divider' }} />
                                <Box sx={{ pl: { xs: 0, md: 2.7 } }}>
                                  <Typography
                                    variant="bodySmall"
                                    color="text.tertiary"
                                    textAlign="left"
                                  >
                                    Total Amount Deposited:{' '}
                                    {displayFullBN(
                                      beanstalkSilo.balances[token.address]
                                        ?.deposited.amount || ZERO_BN,
                                      token.displayDecimals
                                    )}{' '}
                                    {token.symbol}
                                    <br />
                                    Total Supply:{' '}
                                    {displayFullBN(
                                      unripeTokens[token.address]?.supply ||
                                        ZERO_BN
                                    )}{' '}
                                    {token.symbol}
                                    <br />
                                  </Typography>
                                </Box>
                              </Stack>
                            ) : (
                              <Stack
                                direction={{ xs: 'column', md: 'row' }}
                                gap={{ xs: 0, md: 1 }}
                                alignItems="stretch"
                              >
                                <Row display={{ xs: 'none', md: 'flex' }}>
                                  =
                                </Row>
                                <Box sx={{ px: 1, py: 0.5, maxWidth: 245 }}>
                                  <Stat
                                    title={
                                      <Row gap={0.5}>
                                        <TokenIcon token={token} /> Total
                                        Deposited {token.symbol}
                                      </Row>
                                    }
                                    gap={0.25}
                                    variant="h4"
                                    amount={displayTokenAmount(
                                      beanstalkSilo.balances[token.address]
                                        ?.TVD || ZERO_BN,
                                      token,
                                      { showName: false }
                                    )}
                                    subtitle={
                                      <>
                                        The total number of {token.symbol}{' '}
                                        Deposited in the Silo.
                                      </>
                                    }
                                  />
                                </Box>
                                <Row>×</Row>
                                <Box sx={{ px: 1, py: 0.5 }}>
                                  <Stat
                                    title={`${token.symbol} Price`}
                                    gap={0.25}
                                    variant="h4"
                                    amount={
                                      <Fiat token={token} amount={ONE_BN} />
                                    }
                                    subtitle={`The current price of ${token.symbol}.`}
                                  />
                                </Box>
                              </Stack>
                            )
                          }
                        >
                          <Typography display="inline" color="text.primary">
                            {isUnripe ? (
                              <>
                                <Fiat
                                  token={underlyingToken!}
                                  amount={pctUnderlyingDeposited.times(
                                    unripeTokens[token.address]?.underlying ||
                                      ZERO_BN
                                  )}
                                  truncate
                                  chop={false}
                                />
                                <Typography
                                  display="inline"
                                  color={BeanstalkPalette.theme.winter.red}
                                >
                                  *
                                </Typography>
                              </>
                            ) : (
                              <Fiat
                                token={token}
                                amount={
                                  beanstalkSilo.balances[token.address]?.TVD
                                }
                                truncate
                              />
                            )}
                          </Typography>
                        </Tooltip>
                      </Grid>

                      {farmerSilo.error ? (
                        <Grid item xs={5}>
                          <Typography color="error.main">
                            {farmerSilo.error}
                          </Typography>
                        </Grid>
                      ) : (
                        <>
                          {/**
                           * Cell: Deposited Amount
                           */}
                          <Grid item xs={2.5}>
                            <Typography color="text.primary">
                              {/* If this is the entry for Bean deposits,
                               * display Earned Beans and Deposited Beans separately.
                               * Internally they are both considered "Deposited". */}
                              <Tooltip
                                placement="right"
                                title={
                                  tokenIshEqual(token, BEAN) &&
                                  farmerSilo.beans.earned.gt(0) ? (
                                    <>
                                      {displayFullBN(
                                        deposited?.amount || ZERO_BN,
                                        token.displayDecimals
                                      )}{' '}
                                      Deposited BEAN
                                      <br />
                                      +&nbsp;
                                      <Typography
                                        display="inline"
                                        color="primary"
                                      >
                                        {displayFullBN(
                                          farmerSilo.beans.earned || ZERO_BN,
                                          token.displayDecimals
                                        )}
                                      </Typography>{' '}
                                      Earned BEAN
                                      <br />
                                      <Divider
                                        sx={{
                                          my: 0.5,
                                          opacity: 0.7,
                                          borderBottomWidth: 0,
                                          borderColor: 'divider',
                                        }}
                                      />
                                      ={' '}
                                      {displayFullBN(
                                        farmerSilo.beans.earned.plus(
                                          deposited?.amount || ZERO_BN
                                        ),
                                        token.displayDecimals
                                      )}{' '}
                                      BEAN
                                      <br />
                                    </>
                                  ) : (
                                    !tokenIshEqual(token, BEAN) &&
                                    deposited?.amount.gt(0) && (
                                      <Stack gap={0.5}>
                                        <StatHorizontal label="Current BDV:">
                                          {displayFullBN(
                                            deposited?.amount.multipliedBy(
                                              getBDV(token)
                                            ) || ZERO_BN,
                                            token.displayDecimals
                                          )}
                                        </StatHorizontal>
                                        <StatHorizontal label="Recorded BDV:">
                                          {displayFullBN(
                                            deposited?.bdv || ZERO_BN,
                                            token.displayDecimals
                                          )}
                                        </StatHorizontal>
                                      </Stack>
                                    )
                                  )
                                }
                              >
                                {/*
                                 * There are multiple states here:
                                 * - No wallet connected. Show Zero
                                 * - Wallet connected, but we haven't even started loading, ie deposited.amount is undefined. Show Loader
                                 * - Loading: farmerSilo.loading. Show Loader
                                 * - We have data: deposited.amount is defined. Show value
                                 */}

                                {farmerSilo.loading ? (
                                  <BeanProgressIcon
                                    size={10}
                                    enabled
                                    variant="indeterminate"
                                  />
                                ) : deposited?.amount ? (
                                  <span>
                                    {displayFullBN(
                                      deposited?.amount || ZERO_BN,
                                      token.displayDecimals
                                    )}
                                    {tokenIshEqual(token, BEAN) &&
                                    farmerSilo.beans.earned.gt(0) ? (
                                      <Typography
                                        component="span"
                                        color="primary.main"
                                      >
                                        {' + '}
                                        {displayFullBN(
                                          farmerSilo.beans.earned,
                                          token.displayDecimals
                                        )}
                                      </Typography>
                                    ) : null}
                                    &nbsp;{token.symbol}
                                  </span>
                                ) : // Connected and fetcher ran. We must have undefined. Show zero
                                account.isConnected && farmerSilo.ran ? (
                                  <>0 {token.symbol}</>
                                ) : // Connected but fetcher hasn't run yet. Show loader preemptively
                                account.isConnected && !farmerSilo.ran ? (
                                  <BeanProgressIcon
                                    size={10}
                                    enabled
                                    variant="indeterminate"
                                  />
                                ) : // Not connected. Show Zero in the correct denomination.
                                denomination === 'bdv' ? (
                                  <>
                                    <Box
                                      component="img"
                                      src={logo}
                                      alt="BEAN"
                                      sx={{
                                        height: '1em',
                                        marginRight: '0.25em',
                                        display: 'inline',
                                        position: 'relative',
                                        top: 0,
                                        left: 0,
                                      }}
                                    />
                                    <span>0</span>
                                  </>
                                ) : (
                                  <span>$0</span>
                                )}
                              </Tooltip>
                            </Typography>
                          </Grid>

                          {/**
                           * Cell: My Deposits
                           */}
                          <Grid item xs={1.75}>
                            <Row justifyContent="flex-end">
                              <Tooltip
                                placement="left"
                                componentsProps={TOOLTIP_COMPONENT_PROPS}
                                title={
                                  isUnripe ? (
                                    <Stack
                                      direction={{ xs: 'column', md: 'row' }}
                                      gap={{ xs: 0, md: 1 }}
                                      alignItems="stretch"
                                    >
                                      <Box sx={{ px: 1, py: 0.5 }}>
                                        <Stat
                                          title={
                                            <Row gap={0.5}>
                                              <TokenIcon token={token} />{' '}
                                              {token.symbol}
                                            </Row>
                                          }
                                          gap={0.25}
                                          variant="h4"
                                          amount={displayTokenAmount(
                                            deposited?.amount || ZERO_BN,
                                            token,
                                            { showName: false }
                                          )}
                                          subtitle={
                                            <>
                                              The number of {token.symbol}
                                              <br />
                                              you have Deposited in the Silo.
                                            </>
                                          }
                                        />
                                      </Box>
                                      <Row>×</Row>
                                      <Box
                                        sx={{ px: 1, py: 0.5, maxWidth: 215 }}
                                      >
                                        {isUnripeLP ? (
                                          <Stat
                                            title="Chop Amount"
                                            gap={0.25}
                                            variant="h4"
                                            // After Chop Change, update this to: recap rate * Total LP Underlying urBEANETH * BeanEth LP Price
                                            amount={`${unripeTokens[token.address]?.penalty?.times(100).toFixed(3)}%`}
                                            subtitle="The amount of BEANETH received for Chopping 1 urBEANETH."
                                          />
                                        ) : (
                                          <Stat
                                            title="Chop Rate"
                                            gap={0.25}
                                            variant="h4"
                                            amount={`1 - ${(
                                              unripeTokens[token.address]
                                                ?.chopPenalty || ZERO_BN
                                            ).toFixed(4)}%`}
                                            subtitle={
                                              <>
                                                The current penalty for Chopping
                                                <br />
                                                {token.symbol} for{' '}
                                                {
                                                  unripeUnderlyingTokens[
                                                    token.address
                                                  ].symbol
                                                }
                                                .{' '}
                                                <Link
                                                  href="https://docs.bean.money/almanac/farm/barn#chopping"
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  underline="hover"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                  }}
                                                >
                                                  Learn more
                                                </Link>
                                              </>
                                            }
                                          />
                                        )}
                                      </Box>
                                      <Row>×</Row>
                                      <Box
                                        sx={{ px: 1, py: 0.5, maxWidth: 215 }}
                                      >
                                        <Stat
                                          title={`${
                                            unripeUnderlyingTokens[
                                              token.address
                                            ]
                                          } Price`}
                                          gap={0.25}
                                          variant="h4"
                                          amount={
                                            <Fiat
                                              token={
                                                unripeUnderlyingTokens[
                                                  token.address
                                                ]
                                              }
                                              amount={ONE_BN}
                                              chop={false}
                                            />
                                          }
                                          subtitle={`The current price of ${
                                            unripeUnderlyingTokens[
                                              token.address
                                            ].symbol
                                          }.`}
                                        />
                                      </Box>
                                      <Stack
                                        display={{ xs: 'none', md: 'flex' }}
                                        alignItems="center"
                                        justifyContent="center"
                                      >
                                        =
                                      </Stack>
                                    </Stack>
                                  ) : (
                                    ''
                                  )
                                }
                              >
                                <Typography color="text.primary">
                                  <Row gap={0.3}>
                                    {/*
                                     * There are multiple states here:
                                     * - No wallet connected. Show Zero
                                     * - Wallet connected, but we haven't even started loading, ie deposited.amount is undefined. Show Loader
                                     * - Loading: farmerSilo.loading. Show Loader
                                     * - We have data: deposited.amount is defined. Show value
                                     */}
                                    {farmerSilo.loading ? (
                                      // Data is loading, show spinner
                                      <BeanProgressIcon
                                        size={10}
                                        enabled
                                        variant="indeterminate"
                                      />
                                    ) : (
                                      // Data is not loading. Note: this could be either before it starts loading, or after
                                      <>
                                        {deposited?.amount ? (
                                          <>
                                            <Fiat
                                              token={token}
                                              amount={deposited?.amount}
                                            />
                                            {isUnripe ? (
                                              <Typography
                                                display="inline"
                                                color={
                                                  BeanstalkPalette.theme.winter
                                                    .red
                                                }
                                              >
                                                *
                                              </Typography>
                                            ) : null}
                                          </>
                                        ) : account.isConnected &&
                                          farmerSilo.ran ? (
                                          // Connected, the fetch() ran, but we have no data. (usually we have 0 as a default)
                                          // But in this case we must have undefined or null. Show zero
                                          <Fiat
                                            token={token}
                                            amount={ZERO_BN}
                                          />
                                        ) : account.isConnected &&
                                          !farmerSilo.ran ? (
                                          // Connected but haven't started loading. Show loader anyway
                                          <BeanProgressIcon
                                            size={10}
                                            enabled
                                            variant="indeterminate"
                                          />
                                        ) : // Not connected. Show Zero in the correct denomination.
                                        denomination === 'bdv' ? (
                                          <>
                                            <Box
                                              component="img"
                                              src={logo}
                                              alt="BEAN"
                                              sx={{
                                                height: '1em',
                                                marginRight: '0.25em',
                                                display: 'inline',
                                                position: 'relative',
                                                top: 0,
                                                left: 0,
                                              }}
                                            />
                                            <span>0</span>
                                          </>
                                        ) : (
                                          <span>$0</span>
                                        )}
                                      </>
                                    )}
                                  </Row>
                                </Typography>
                              </Tooltip>
                              <Stack
                                // display={{ xs: 'none', md: 'block' }}
                                sx={{ width: ARROW_CONTAINER_WIDTH }}
                                alignItems="center"
                              >
                                <ArrowRightIcon
                                  sx={{
                                    color: 'secondary.main',
                                    marginTop: '3px',
                                  }}
                                />
                              </Stack>
                            </Row>
                          </Grid>
                        </>
                      )}
                    </Grid>
                  </Button>
                </Box>
              );
            })}
          </Stack>
        </Box>
      </Box>
    </Card>
  );
};

export default Whitelist;
