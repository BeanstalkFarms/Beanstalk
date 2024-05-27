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
import { ReportGmailerrorred } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAccount } from 'wagmi';
import { Pool, Token } from '~/classes';
import { AppState } from '~/state';
import TokenIcon from '~/components/Common/TokenIcon';
import {
  BEAN,
  SEEDS,
  STALK,
  UNRIPE_BEAN,
  UNRIPE_BEAN_WETH,
} from '~/constants/tokens';
import { AddressMap, ONE_BN, ZERO_BN } from '~/constants';
import { displayFullBN, displayTokenAmount } from '~/util/Tokens';
import useBDV from '~/hooks/beanstalk/useBDV';
import {
  BeanstalkPalette,
  FontSize,
  IconSize,
} from '~/components/App/muiTheme';
import Fiat from '~/components/Common/Fiat';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
import useSetting from '~/hooks/app/useSetting';
import Row from '~/components/Common/Row';
import Stat from '~/components/Common/Stat';
import useUnripeUnderlyingMap from '~/hooks/beanstalk/useUnripeUnderlying';
import stalkIcon from '~/img/beanstalk/stalk-icon.svg';
import logo from '~/img/tokens/bean-logo.svg';
import { FC } from '~/types';
import { useIsTokenDeprecated } from '~/hooks/beanstalk/useWhitelist';
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
  config: {
    whitelist: Token[];
    poolsByAddress: AddressMap<Pool>;
  };
}> = ({ farmerSilo, config }) => {
  /// Settings
  const [denomination] = useSetting('denomination');
  const account = useAccount();
  const checkIfDeprecated = useIsTokenDeprecated();

  /// Chain
  const getChainToken = useGetChainToken();
  const Bean = getChainToken(BEAN);
  const urBean = getChainToken(UNRIPE_BEAN);
  const urBeanWeth = getChainToken(UNRIPE_BEAN_WETH);
  const unripeUnderlyingTokens = useUnripeUnderlyingMap();

  /// State
  // const apyQuery = useAPY();
  const getBDV = useBDV();
  const beanstalkSilo = useSelector<AppState, AppState['_beanstalk']['silo']>(
    (state) => state._beanstalk.silo
  );
  const unripeTokens = useSelector<AppState, AppState['_bean']['unripe']>(
    (state) => state._bean.unripe
  );

  return (
    <Card>
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
          <Grid item md={2.25} xs={4}>
            <Typography color="text.secondary">Token</Typography>
          </Grid>
          <Grid item md={1} xs={0} display={{ xs: 'none', md: 'block' }}>
            <Tooltip title="The amount of Stalk and Seeds earned for each 1 Bean Denominated Value (BDV) Deposited in the Silo.">
              <Typography color="text.secondary">Rewards</Typography>
            </Tooltip>
          </Grid>
          <Grid
            item
            md={2.25}
            xs={0}
            display={{ xs: 'none', md: 'flex' }}
            justifyContent="center"
          >
            <Tooltip title="Estimated annual Beans earned by a Stalkholder for Depositing an asset.">
              <Chip
                variant="filled"
                color="primary"
                label={
                  <Row gap={0.5}>
                    <TokenIcon token={BEAN[1]} />
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
          <Grid
            item
            md={1.25}
            xs={0}
            display={{ xs: 'none', md: 'flex' }}
            justifyContent="center"
          >
            <Tooltip title="Estimated annual growth in Stalk for Depositing an asset.">
              <Typography color="text.primary">
                <TokenIcon
                  token={{ symbol: 'Stalk', logo: stalkIcon } as Token}
                />{' '}
                vAPY
              </Typography>
            </Tooltip>
          </Grid>
          <Grid item md={1} xs={0} display={{ xs: 'none', md: 'block' }}>
            <Tooltip title="Total Value Deposited in the Silo.">
              <Typography color="text.secondary">TVD</Typography>
            </Tooltip>
          </Grid>
          <Grid item md={2.75} xs={0} display={{ xs: 'none', md: 'block' }}>
            <Typography color="text.secondary">Amount Deposited</Typography>
          </Grid>
          <Grid
            item
            md={1.5}
            xs={8}
            sx={{
              textAlign: 'right',
              paddingRight: { xs: 0, md: `${ARROW_CONTAINER_WIDTH}px` },
            }}
          >
            <Tooltip
              title={
                <>
                  The value of your Silo deposits for each whitelisted token,
                  denominated in {denomination === 'bdv' ? 'Beans' : 'USD'}.
                  <br />
                  <Typography
                    color="text.secondary"
                    fontSize={FontSize.sm}
                    fontStyle="italic"
                  >
                    Switch to {denomination === 'bdv' ? 'USD' : 'Beans'}: Option
                    + F
                  </Typography>
                </>
              }
            >
              <Typography color="text.secondary">Value Deposited</Typography>
            </Tooltip>
          </Grid>
        </Grid>
      </Box>
      {/* Rows */}
      <Stack gap={1} p={1}>
        {config.whitelist.map((token) => {
          const deposited = farmerSilo.balances[token.address]?.deposited;
          const isUnripe = token === urBean || token === urBeanWeth;
          const isDeprecated = checkIfDeprecated(token.address);

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

          const depSx = {
            textAlign: 'left',
            px: 2,
            py: 1.5,
            height: '90px',
            borderColor: '#d2ebfd',
            borderWidth: '0.5px',
            background: BeanstalkPalette.white,
            '&:hover': {
              borderColor: '#dae8f2',
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
                sx={isDeprecated ? depSx : wlSx}
              >
                <Grid container alignItems="center">
                  {/**
                   * Cell: Token
                   */}
                  <Grid
                    item
                    md={isDeprecated ? 6.75 : 2.25}
                    xs={isDeprecated ? 7 : 7}
                  >
                    <Row gap={1}>
                      <Box
                        component="img"
                        src={token.logo}
                        alt={token.name}
                        css={{
                          height: IconSize.medium,
                          display: 'inline',
                          opacity: isDeprecated ? 0.2 : 1,
                        }}
                      />
                      <Typography
                        display="inline"
                        color={isDeprecated ? 'text.tertiary' : 'text.primary'}
                      >
                        {token.name}
                      </Typography>
                    </Row>
                    {isDeprecated && (
                      <Chip
                        icon={<ReportGmailerrorred />}
                        variant="outlined"
                        sx={{
                          border: 'none',
                          color: '#9ca3ad',
                          backgroundColor: '#f2f7fd',
                          marginTop: '5px',
                          padding: '15px 10px',
                        }}
                        size="small"
                        label="Removed from Deposit Whitelist in BIP-45"
                      />
                    )}
                  </Grid>
                  {!isDeprecated && (
                    /**
                     * Cell: Rewards
                     */
                    <Grid
                      item
                      md={1}
                      xs={0}
                      display={{ xs: 'none', md: 'block' }}
                    >
                      <Row gap={0.75}>
                        <Tooltip
                          placement="right"
                          title={
                            <>
                              1 {token.symbol} = {displayFullBN(getBDV(token))}{' '}
                              BDV
                            </>
                          }
                        >
                          <Box>
                            <Row gap={0.2}>
                              <TokenIcon
                                token={STALK}
                                css={{ height: '0.8em', marginTop: '-1px' }}
                              />
                              <Typography color="text.primary" mr={0.2}>
                                {token.rewards?.stalk}
                              </Typography>
                              <TokenIcon token={SEEDS} />
                              <Typography color="text.primary">
                                {Math.round(
                                  (token.rewards?.seeds || 0 + Number.EPSILON) *
                                    100
                                ) / 100}
                              </Typography>
                            </Row>
                          </Box>
                        </Tooltip>
                      </Row>
                    </Grid>
                  )}
                  {/**
                   * Cell: Bean APY
                   */}
                  {!isDeprecated && (
                    <Grid
                      item
                      md={2.25}
                      xs={0}
                      display={{ xs: 'none', md: 'flex' }}
                      justifyContent="center"
                    >
                      <SiloAssetApyChip token={token} metric="bean" />
                    </Grid>
                  )}
                  {/**
                   * Cell: Stalk APY
                   */}
                  {!isDeprecated && (
                    <Grid
                      item
                      md={1.25}
                      xs={0}
                      display={{ xs: 'none', md: 'flex' }}
                      justifyContent="center"
                    >
                      <SiloAssetApyChip token={token} metric="stalk" />
                    </Grid>
                  )}
                  {/**
                   * Cell: TVD
                   */}
                  <Grid
                    item
                    md={1}
                    xs={0}
                    display={{ xs: 'none', md: 'block' }}
                  >
                    <Tooltip
                      placement="right"
                      componentsProps={TOOLTIP_COMPONENT_PROPS}
                      title={
                        isUnripe ? (
                          <Stack gap={0.5}>
                            <Stack
                              direction={{ xs: 'column', md: 'row' }}
                              gap={{ xs: 0, md: 1 }}
                              alignItems="stretch"
                            >
                              <Row display={{ xs: 'none', md: 'flex' }}>=</Row>
                              <Box sx={{ px: 1, py: 0.5, maxWidth: 215 }}>
                                <Stat
                                  title={
                                    <Row gap={0.5}>
                                      <TokenIcon token={underlyingToken!} />{' '}
                                      Ripe {underlyingToken!.symbol}
                                    </Row>
                                  }
                                  gap={0.25}
                                  variant="h4"
                                  amount={
                                    <Fiat
                                      token={underlyingToken!}
                                      amount={
                                        unripeTokens[token.address]
                                          ?.underlying || ZERO_BN
                                      }
                                      chop={false}
                                    />
                                  }
                                  subtitle={`The ${denomination.toUpperCase()} value of the ${
                                    underlyingToken!.symbol
                                  } underlying all ${token.symbol}.`}
                                />
                              </Box>
                              <Row>×</Row>
                              <Box sx={{ px: 1, py: 0.5, maxWidth: 245 }}>
                                <Stat
                                  title="% Deposited"
                                  gap={0.25}
                                  variant="h4"
                                  amount={`${pctUnderlyingDeposited
                                    .times(100)
                                    .toFixed(2)}%`}
                                  subtitle={
                                    <>
                                      The percentage of all {token.symbol} that
                                      is currently Deposited in the Silo.
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
                                  unripeTokens[token.address]?.supply || ZERO_BN
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
                            <Row display={{ xs: 'none', md: 'flex' }}>=</Row>
                            <Box sx={{ px: 1, py: 0.5, maxWidth: 245 }}>
                              <Stat
                                title={
                                  <Row gap={0.5}>
                                    <TokenIcon token={token} /> Total Deposited{' '}
                                    {token.symbol}
                                  </Row>
                                }
                                gap={0.25}
                                variant="h4"
                                amount={displayTokenAmount(
                                  beanstalkSilo.balances[token.address]
                                    ?.deposited.amount || ZERO_BN,
                                  token,
                                  { showName: false }
                                )}
                                subtitle={
                                  <>
                                    The total number of {token.symbol} Deposited
                                    in the Silo.
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
                                amount={<Fiat token={token} amount={ONE_BN} />}
                                subtitle={`The current price of ${token.symbol}.`}
                              />
                            </Box>
                          </Stack>
                        )
                      }
                    >
                      <Typography
                        display="inline"
                        color={isDeprecated ? 'text.tertiary' : 'text.primary'}
                      >
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
                              beanstalkSilo.balances[token.address]?.deposited
                                .amount
                            }
                            truncate
                          />
                        )}
                      </Typography>
                    </Tooltip>
                  </Grid>

                  {farmerSilo.error ? (
                    <Grid item md={5}>
                      <Typography color="error.main">
                        {farmerSilo.error}
                      </Typography>
                    </Grid>
                  ) : (
                    <>
                      {/**
                       * Cell: Deposited Amount
                       */}
                      <Grid
                        item
                        md={2.5}
                        xs={0}
                        display={{ xs: 'none', md: 'block' }}
                      >
                        <Typography
                          color={
                            isDeprecated ? 'text.tertiary' : 'text.primary'
                          }
                        >
                          {/* If this is the entry for Bean deposits,
                           * display Earned Beans and Deposited Beans separately.
                           * Internally they are both considered "Deposited". */}
                          <Tooltip
                            placement="right"
                            title={
                              token.equals(Bean) &&
                              farmerSilo.beans.earned.gt(0) ? (
                                <>
                                  {displayFullBN(
                                    deposited?.amount || ZERO_BN,
                                    token.displayDecimals
                                  )}{' '}
                                  Deposited BEAN
                                  <br />
                                  +&nbsp;
                                  <Typography display="inline" color="primary">
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
                                !token.equals(Bean) &&
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
                                {token.equals(Bean) &&
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
                      <Grid item md={1.75} xs={5}>
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
                                  <Box sx={{ px: 1, py: 0.5, maxWidth: 215 }}>
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
                                          The current penalty for chopping
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
                                  </Box>
                                  <Row>×</Row>
                                  <Box sx={{ px: 1, py: 0.5, maxWidth: 215 }}>
                                    <Stat
                                      title={`${
                                        unripeUnderlyingTokens[token.address]
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
                                        unripeUnderlyingTokens[token.address]
                                          .symbol
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
                            <Typography
                              color={
                                isDeprecated ? 'text.tertiary' : 'text.primary'
                              }
                            >
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
                                              BeanstalkPalette.theme.winter.red
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
                                      <Fiat token={token} amount={ZERO_BN} />
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
                            display={{ xs: 'none', md: 'block' }}
                            sx={{ width: ARROW_CONTAINER_WIDTH }}
                            alignItems="center"
                          >
                            <ArrowRightIcon
                              sx={{ color: 'secondary.main', marginTop: '3px' }}
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
    </Card>
  );
};

export default Whitelist;
