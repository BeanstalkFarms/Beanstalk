import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Checkbox,
  Container,
  FormControlLabel,
  FormControlLabelProps,
  FormGroup,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { useSelector } from 'react-redux';
import BigNumberJS from 'bignumber.js';
import { Token, TokenValue } from '@beanstalk/sdk';
import Overview from '~/components/Silo/Overview';
import RewardsSummary from '~/components/Silo/RewardsSummary';
import Whitelist from '~/components/Silo/Whitelist';
import PageHeader from '~/components/Common/PageHeader';
import DropdownIcon from '~/components/Common/DropdownIcon';
import useWhitelist from '~/hooks/beanstalk/useWhitelist';
import usePools from '~/hooks/beanstalk/usePools';
import useFarmerBalancesBreakdown from '~/hooks/farmer/useFarmerBalancesBreakdown';
import useToggle from '~/hooks/display/useToggle';
import useRevitalized from '~/hooks/farmer/useRevitalized';
import useSeason from '~/hooks/beanstalk/useSeason';
import { AppState } from '~/state';
import { UNRIPE_BEAN, UNRIPE_BEAN_CRV3 } from '~/constants/tokens';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
import GuideButton from '~/components/Common/Guide/GuideButton';
import { CLAIM_SILO_REWARDS, HOW_TO_DEPOSIT_IN_THE_SILO } from '~/util/Guides';

import { FC } from '~/types';
import useSdk from '~/hooks/sdk';
import { ZERO_BN } from '~/constants';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import Row from '~/components/Common/Row';
import { displayFullBN, selectCratesForEnrootNew, transform } from '~/util';
import useBDV from '~/hooks/beanstalk/useBDV';
import Centered from '~/components/Common/ZeroState/Centered';
import useMigrationNeeded from '~/hooks/farmer/useMigrationNeeded';

const FormControlLabelStat: FC<
  Partial<FormControlLabelProps> & {
    label: any;
    stat: any;
    onChange: any;
    checked: any;
  }
> = ({ label, stat, checked, onChange, ...props }) => (
  <FormControlLabel
    sx={{ display: 'flex', '& > span.MuiFormControlLabel-label': { flex: 1 } }}
    {...props}
    control={
      <Checkbox
        sx={{ position: 'relative', zIndex: 2 }}
        size="small"
        checked={checked}
        onChange={onChange}
      />
    }
    label={
      <Row justifyContent="space-between" width="100%" flex={1}>
        <span>{label}</span>
        <span>{stat}</span>
      </Row>
    }
  />
);
const Link = (
  <Box
    sx={{
      height: 'calc(24px)',
      width: '1.5px',
      backgroundColor: 'rgba(0,0,0, 0.25)',
      position: 'absolute',
      left: 8.5,
      top: 29,
      zIndex: 1,
    }}
  />
);

const RewardsBar: FC<{
  breakdown: ReturnType<typeof useFarmerBalancesBreakdown>;
  farmerSilo: AppState['_farmer']['silo'];
  revitalizedStalk: BigNumberJS | undefined;
  revitalizedSeeds: BigNumberJS | undefined;
}> = ({ breakdown, farmerSilo, revitalizedStalk, revitalizedSeeds }) => {
  /// Helpers
  const getChainToken = useGetChainToken();

  /// Calculate Unripe Silo Balance
  const urBean = getChainToken(UNRIPE_BEAN);
  const urBeanCrv3 = getChainToken(UNRIPE_BEAN_CRV3);

  const balances = farmerSilo.balances;
  const unripeDepositedBalance = balances[
    urBean.address
  ]?.deposited.amount.plus(balances[urBeanCrv3.address]?.deposited.amount);

  /// Local state
  const [open, show, hide] = useToggle();

  const sdk = useSdk();
  const tokens = useMemo(
    () => [...sdk.tokens.siloWhitelist],
    [sdk.tokens.siloWhitelist]
  );

  const [claimState, setClaimState] = useState({
    mow: new Set([...sdk.tokens.siloWhitelistAddresses]),
    plant: false,
    enroot: false,
  });

  const migrationNeeded = useMigrationNeeded();
  const getBDV = useBDV();
  const enrootData = useMemo(() => {
    const selectedCratesByToken = selectCratesForEnrootNew(
      sdk,
      balances,
      getBDV
    );

    // const enrootData = Object.keys(selectedCratesByToken).map(
    //   (key) => selectedCratesByToken[key].encoded
    // );
    return selectedCratesByToken;
  }, [balances, getBDV, sdk]);

  const onChangePlant = useCallback(
    (e: any) => {
      setClaimState((prevState) => {
        const newMow = prevState.mow;

        // When checking either of the plant boxes, we force BEAN to be Mown
        if (e.target.checked) {
          newMow.add(sdk.tokens.BEAN.address); // no-op if already added
        }

        return {
          ...prevState,
          mow: newMow,
          plant: e.target.checked,
        };
      });
    },
    [sdk.tokens.BEAN.address]
  );

  const onChangeEnroot = useCallback(
    (e: any) => {
      setClaimState((prevState) => {
        const newMow = prevState.mow;

        // When checking either of the enroot boxes, we force urBEAN and/or urBEAN3CRV
        // to be Mown if the user has valid crates to mow
        if (e.target.checked) {
          // newMow.add(sdk.tokens.BEAN.address);
          sdk.tokens.unripeTokens.forEach((token) => {
            if (enrootData[token.address]?.crates.length > 0) {
              newMow.add(token.address);
            }
          });
        }

        return {
          ...prevState,
          mow: newMow,
          enroot: e.target.checked,
        };
      });
    },
    [enrootData, sdk.tokens.unripeTokens]
  );

  const { empty, output } = useMemo(() => {
    let amountBean = ZERO_BN;
    let amountStalk = ZERO_BN;
    let amountSeeds = ZERO_BN;

    tokens.forEach((token) => {
      if (claimState.mow.has(token.address)) {
        const grownStalk = farmerSilo.stalk.grownByToken.get(token);
        if (grownStalk) {
          amountStalk = amountStalk.plus(
            transform(grownStalk, 'bnjs', sdk.tokens.STALK)
          );
        }
      }
    });

    if (claimState.plant) {
      amountBean = amountBean.plus(farmerSilo.beans.earned);
      amountStalk = amountStalk.plus(farmerSilo.stalk.earned);
    }

    if (claimState.enroot) {
      amountStalk = amountStalk.plus(revitalizedStalk || ZERO_BN);
      amountSeeds = amountSeeds.plus(revitalizedSeeds || ZERO_BN);
    }

    return {
      empty: amountBean.eq(0) && amountStalk.eq(0) && amountSeeds.eq(0),
      output: new Map<Token, TokenValue>([
        [sdk.tokens.BEAN, transform(amountBean, 'tokenValue', sdk.tokens.BEAN)],
        [
          sdk.tokens.STALK,
          transform(amountStalk, 'tokenValue', sdk.tokens.STALK),
        ],
        [
          sdk.tokens.SEEDS,
          transform(amountSeeds, 'tokenValue', sdk.tokens.SEEDS),
        ],
      ]),
    };
  }, [claimState, farmerSilo, revitalizedSeeds, revitalizedStalk, sdk, tokens]);

  if (migrationNeeded === true) {
    return (
      <Card>
        <Centered width="100%" textAlign="center" spacing={1} py={1}>
          <Typography variant="h3">
            To claim Silo rewards, migrate to Silo V3.
          </Typography>
          <Typography variant="body1">
            You can view your Deposits below.
          </Typography>
        </Centered>
      </Card>
    );
  }

  return (
    <Card>
      <Stack
        sx={{ p: 1.5 }}
        direction={{ xs: 'column', lg: 'row' }}
        justifyContent={{ lg: 'space-between' }}
        alignItems={{ xs: 'auto', lg: 'center' }}
        rowGap={1.5}
      >
        <RewardsSummary
          beans={farmerSilo.beans}
          stalk={farmerSilo.stalk}
          seeds={farmerSilo.seeds}
          revitalizedStalk={revitalizedStalk}
          revitalizedSeeds={revitalizedSeeds}
          hideRevitalized={unripeDepositedBalance?.eq(0)}
        />
        <Box
          justifySelf={{ xs: 'auto', lg: 'flex-end' }}
          width={{ xs: '100%', lg: 'auto' }}
        >
          <Button
            size="medium"
            variant="contained"
            sx={{ width: '100%', whiteSpace: 'nowrap' }}
            endIcon={
              <DropdownIcon
                open={open}
                disabled={breakdown.totalValue?.eq(0)}
                light
              />
            }
            onClick={open ? hide : show}
            disabled={breakdown.totalValue?.eq(0)}
          >
            Claim
          </Button>
        </Box>
      </Stack>
      {open && (
        <Box
          sx={{
            backgroundColor: 'rgba(244, 244, 244, 0.4)',
            p: 1.5,
          }}
        >
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Typography variant="h4">Mow</Typography>
              <Box>
                <FormGroup>
                  {tokens.map((token) => {
                    const disabled =
                      balances[token.address].deposited.amount.lte(0);
                    const required =
                      // Mowing BEAN is required if `plant` is checked
                      (claimState.plant &&
                        token.address === sdk.tokens.BEAN.address) ||
                      // Mowing an Unripe token is required if `enroot` is checked and
                      // we have enrootable crates for that token
                      (claimState.enroot &&
                        enrootData[token.address]?.crates.length > 0);
                    return (
                      <FormControlLabelStat
                        key={token.address}
                        label={`Grown Stalk from ${token.symbol}`}
                        stat={
                          disabled
                            ? 0
                            : displayFullBN(
                                farmerSilo.stalk.grownByToken.get(token) ||
                                  ZERO_BN,
                                4
                              )
                        }
                        disabled={disabled || required}
                        checked={
                          disabled ? false : claimState.mow.has(token.address)
                        }
                        onChange={(e: any) => {
                          setClaimState((prevState) => {
                            // Planting requires mowing BEAN
                            if (required) {
                              return prevState;
                            }

                            const newMow = new Set(prevState.mow);
                            e.target.checked
                              ? newMow.add(token.address)
                              : newMow.delete(token.address);

                            return {
                              ...prevState,
                              mow: newMow,
                            };
                          });
                        }}
                      />
                    );
                  })}
                </FormGroup>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="h4">Plant</Typography>
                  {/* <Typography variant="bodySmall">Claim your seignorage.</Typography> */}
                  <FormGroup sx={{ position: 'relative' }}>
                    {Link}
                    <FormControlLabelStat
                      label="Earned Beans"
                      stat={displayFullBN(farmerSilo.beans.earned)}
                      disabled={farmerSilo.beans.earned.lte(0)}
                      checked={claimState.plant}
                      onChange={onChangePlant}
                    />
                    <FormControlLabelStat
                      label="Earned Stalk"
                      stat={displayFullBN(farmerSilo.stalk.earned)}
                      disabled={farmerSilo.beans.earned.lte(0)}
                      checked={claimState.plant}
                      onChange={onChangePlant}
                    />
                  </FormGroup>
                </Box>
                <Box>
                  <Typography variant="h4">Enroot</Typography>
                  <FormGroup sx={{ position: 'relative' }}>
                    {Link}
                    <FormControlLabelStat
                      label="Revitalized Stalk"
                      stat={displayFullBN(revitalizedStalk || ZERO_BN, 4)}
                      disabled={!revitalizedStalk || revitalizedStalk.lte(0)}
                      checked={claimState.enroot}
                      onChange={onChangeEnroot}
                    />
                    <FormControlLabelStat
                      label="Revitalized Seeds"
                      stat={displayFullBN(revitalizedSeeds || ZERO_BN, 4)}
                      disabled={!revitalizedSeeds || revitalizedSeeds.lte(0)}
                      checked={claimState.enroot}
                      onChange={onChangeEnroot}
                    />
                  </FormGroup>
                </Box>
              </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack spacing={1}>
                <TokenOutput>
                  {empty && (
                    <Centered>
                      <Typography variant="body1" color="text.secondary">
                        Select Silo rewards to claim
                      </Typography>
                    </Centered>
                  )}
                  <TokenOutput.Row
                    token={sdk.tokens.BEAN}
                    label="Deposited BEAN"
                    amount={output.get(sdk.tokens.BEAN)!}
                    hideIfZero
                    // amountSuffix={` @ ${displayBN(podLineLength)}`}
                  />
                  <TokenOutput.Row
                    token={sdk.tokens.STALK}
                    amount={output.get(sdk.tokens.STALK)!}
                    hideIfZero
                    // amountSuffix={` @ ${displayBN(podLineLength)}`}
                  />
                  <TokenOutput.Row
                    token={sdk.tokens.SEEDS}
                    amount={output.get(sdk.tokens.SEEDS)!}
                    hideIfZero
                    // amountSuffix={` @ ${displayBN(podLineLength)}`}
                  />
                </TokenOutput>
                <Button
                  disabled={empty}
                  variant="contained"
                  fullWidth
                  size="large"
                >
                  Claim Rewards
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Box>
      )}
    </Card>
  );
};

const SiloPage: FC<{}> = () => {
  /// Chain Constants
  const whitelist = useWhitelist();
  const pools = usePools();

  /// State
  const farmerSilo = useSelector<AppState, AppState['_farmer']['silo']>(
    (state) => state._farmer.silo
  );
  const beanstalkSilo = useSelector<AppState, AppState['_beanstalk']['silo']>(
    (state) => state._beanstalk.silo
  );
  const breakdown = useFarmerBalancesBreakdown();
  const season = useSeason();
  const { revitalizedStalk, revitalizedSeeds } = useRevitalized();

  const config = useMemo(
    () => ({
      whitelist: Object.values(whitelist),
      poolsByAddress: pools,
    }),
    [whitelist, pools]
  );

  return (
    <Container maxWidth="lg">
      <Stack gap={2}>
        <PageHeader
          title="The Silo"
          description="Earn yield and participate in Beanstalk governance by depositing whitelisted assets"
          href="https://docs.bean.money/almanac/farm/silo"
          // makes guide display to the right of the title on mobile
          OuterStackProps={{ direction: 'row' }}
          control={
            <GuideButton
              title="The Farmers' Almanac: Silo Guides"
              guides={[HOW_TO_DEPOSIT_IN_THE_SILO, CLAIM_SILO_REWARDS]}
            />
          }
        />
        <Overview
          breakdown={breakdown}
          farmerSilo={farmerSilo}
          beanstalkSilo={beanstalkSilo}
          season={season}
        />
        <RewardsBar
          breakdown={breakdown}
          farmerSilo={farmerSilo}
          revitalizedStalk={revitalizedStalk}
          revitalizedSeeds={revitalizedSeeds}
        />
        <Whitelist config={config} farmerSilo={farmerSilo} />
        {/* <RewardsDialog
          open={open}
          handleClose={hide}
          beans={farmerSilo.beans}
          stalk={farmerSilo.stalk}
          seeds={farmerSilo.seeds}
          revitalizedStalk={revitalizedStalk}
          revitalizedSeeds={revitalizedSeeds}
        /> */}
      </Stack>
    </Container>
  );
};

export default SiloPage;
