import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  FormControlLabel,
  FormControlLabelProps,
  FormGroup,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import BigNumberJS from 'bignumber.js';
import { Token, TokenValue } from '@beanstalk/sdk';
import { ethers } from 'ethers';
import Overview from '~/components/Silo/Overview';
import RewardsSummary from '~/components/Silo/RewardsSummary';
import Whitelist from '~/components/Silo/Whitelist';
import PageHeader from '~/components/Common/PageHeader';
import DropdownIcon from '~/components/Common/DropdownIcon';
import useFarmerBalancesBreakdown from '~/hooks/farmer/useFarmerBalancesBreakdown';
import useToggle from '~/hooks/display/useToggle';
import useRevitalized from '~/hooks/farmer/useRevitalized';
import useSeason from '~/hooks/beanstalk/useSeason';
import { AppState } from '~/state';
import GuideButton from '~/components/Common/Guide/GuideButton';
import {
  CLAIM_SILO_REWARDS,
  HOW_TO_DEPOSIT_IN_THE_SILO,
  UNDERSTAND_SILO_VAPY,
} from '~/util/Guides';

import { FC } from '~/types';
import useSdk from '~/hooks/sdk';
import { ZERO_BN } from '~/constants';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import Row from '~/components/Common/Row';
import { displayFullBN, selectCratesForEnrootNew, transform } from '~/util';
import useBDV from '~/hooks/beanstalk/useBDV';
import Centered from '~/components/Common/ZeroState/Centered';
import useAccount from '~/hooks/ledger/useAccount';
import useQuoteAgnostic from '~/hooks/ledger/useQuoteAgnostic';
import GasTag from '~/components/Common/GasTag';
import TransactionToast from '~/components/Common/TxnToast';
import { useFetchFarmerSilo } from '~/state/farmer/silo/updater';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import useSilo from '~/hooks/beanstalk/useSilo';
import useSetting from '~/hooks/app/useSetting';
import SeedGaugeDetails from '~/components/Silo/SeedGauge';
import {
  useBeanstalkTokens,
  useTokens,
  useWhitelistedTokens,
} from '~/hooks/beanstalk/useTokens';

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
const Connector: FC<{ top: number }> = ({ top }) => (
  <Box
    sx={{
      height: 'calc(24px)',
      width: '1.5px',
      backgroundColor: 'rgba(0,0,0, 0.25)',
      position: 'absolute',
      left: 8.5,
      top: top,
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
  const getBDV = useBDV();
  const sdk = useSdk();
  const {
    UNRIPE_BEAN: urBean,
    UNRIPE_BEAN_WSTETH: urBeanWstETH,
    BEAN,
  } = useTokens();
  const { STALK, SEEDS } = useBeanstalkTokens();

  // Are we impersonating a different account while not in dev mode
  const isImpersonating =
    !!useSetting('impersonatedAccount')[0] && !import.meta.env.DEV;

  /// Calculate Unripe Silo Balance

  const balances = farmerSilo.balances;
  const unripeDepositedBalance = balances[
    urBean.address
  ]?.deposited.amount.plus(balances[urBeanWstETH.address]?.deposited.amount);

  const [refetchFarmerSilo] = useFetchFarmerSilo();
  const account = useAccount();
  const enrootData = useMemo(
    () => selectCratesForEnrootNew(sdk, balances, getBDV),
    [balances, getBDV, sdk]
  );

  const tokens = useMemo(
    () => [...sdk.tokens.siloWhitelist],
    [sdk.tokens.siloWhitelist]
  );

  const getInitialState = useCallback(() => {
    // Only mow if the user has grown stalk for a given token
    const mow = new Set<string>();
    farmerSilo.stalk.grownByToken.forEach((grown, token) => {
      if (grown.gt(0)) {
        mow.add(token.address);
      }
    });

    // Only plant if the user has Earned Beans
    const plant = farmerSilo.beans.earned.gt(0);

    // Only enroot if the user has revitalized stalk/seeds
    const enroot = revitalizedStalk?.gt(0) || revitalizedSeeds?.gt(0);

    return {
      mow,
      plant,
      enroot,
    };
  }, [
    farmerSilo.beans.earned,
    farmerSilo.stalk.grownByToken,
    revitalizedSeeds,
    revitalizedStalk,
  ]);

  /// Local state
  const [open, show, hide] = useToggle();
  const [claiming, setClaiming] = useState(false);
  const [claimState, setClaimState] = useState(getInitialState());

  const onChangePlant = useCallback(
    (e: any) => {
      setClaimState((prevState) => {
        const newMow = prevState.mow;

        // When checking either of the plant boxes, we force BEAN to be Mown
        if (e.target.checked) {
          newMow.add(BEAN.address); // no-op if already added
        }

        return {
          ...prevState,
          mow: newMow,
          plant: e.target.checked,
        };
      });
    },
    [BEAN.address]
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
          amountStalk = amountStalk.plus(transform(grownStalk, 'bnjs', STALK));
        }
      }
    });

    if (claimState.plant) {
      amountBean = amountBean.plus(farmerSilo.beans.earned);
      amountStalk = amountStalk.plus(farmerSilo.stalk.earned);
      amountSeeds = amountSeeds.plus(farmerSilo.seeds.earned);
    }

    if (claimState.enroot) {
      amountStalk = amountStalk.plus(revitalizedStalk || ZERO_BN);
      amountSeeds = amountSeeds.plus(revitalizedSeeds || ZERO_BN);
    }

    return {
      empty: amountBean.eq(0) && amountStalk.eq(0) && amountSeeds.eq(0),
      output: new Map<Token, TokenValue>([
        [
          BEAN,
          transform(
            amountBean.isNaN() ? ZERO_BN : amountBean,
            'tokenValue',
            BEAN
          ),
        ],
        [
          STALK,
          transform(
            amountStalk.isNaN() ? ZERO_BN : amountStalk,
            'tokenValue',
            STALK
          ),
        ],
        [
          SEEDS,
          transform(
            amountSeeds.isNaN() ? ZERO_BN : amountSeeds,
            'tokenValue',
            SEEDS
          ),
        ],
      ]),
    };
  }, [
    BEAN,
    SEEDS,
    STALK,
    claimState.mow,
    claimState.enroot,
    claimState.plant,
    farmerSilo.beans.earned,
    farmerSilo.seeds.earned,
    farmerSilo.stalk.earned,
    farmerSilo.stalk.grownByToken,
    revitalizedSeeds,
    revitalizedStalk,
    tokens,
  ]);

  const buildWorkflow = useCallback(
    (c: typeof claimState) => {
      if (!account) return;
      const workflow = sdk.farm.create();

      // const forcedToMow = new Set<Token>();
      // if (c.plant) {
      //   forcedToMow.add(sdk.tokens.BEAN);
      // }

      // if (c.enroot) {
      //   sdk.tokens.unripeTokens.forEach((token) => {
      //     if (enrootData[token.address]?.crates.length > 0) {
      //       forcedToMow.add(token);
      //     }
      //   });
      // }

      const toMow = [...c.mow];

      if (toMow.length === 1) {
        workflow.add(() =>
          sdk.contracts.beanstalk.interface.encodeFunctionData('mow', [
            account,
            toMow[0],
          ])
        );
      } else if (toMow.length > 1) {
        workflow.add(() =>
          sdk.contracts.beanstalk.interface.encodeFunctionData('mowMultiple', [
            account,
            toMow,
          ])
        );
      }

      if (c.plant) {
        workflow.add(() =>
          sdk.contracts.beanstalk.interface.encodeFunctionData('plant')
        );
      }

      if (c.enroot) {
        Object.values(enrootData).forEach((v) => {
          workflow.add(() => v.encoded);
        });
      }

      return workflow;
    },
    [enrootData, sdk, account]
  );

  const gasMultiplier = 1.2;

  const quoteGas = useCallback(async () => {
    const farm = buildWorkflow(claimState);
    if (!farm) {
      console.error('No workflow');
      return;
    }

    if (farm.length === 0 || isImpersonating) return;

    await farm.estimate(ethers.BigNumber.from(0));

    return farm.estimateGas(ethers.BigNumber.from(0), { slippage: 0 });
  }, [buildWorkflow, claimState, isImpersonating]);

  const [gas, isEstimatingGas, estimateGas] = useQuoteAgnostic(quoteGas);

  useEffect(() => {
    if (open) {
      estimateGas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimState, open]);

  const handleSubmit = useCallback(async () => {
    let txToast;
    try {
      const farm = buildWorkflow(claimState);
      if (!farm) return;

      setClaiming(true);

      txToast = new TransactionToast({
        loading: `Claiming rewards...`,
        success: 'Claim successful.',
      });

      await farm.estimate(ethers.BigNumber.from(0));

      const adjustedGas = gas
        ? Math.floor(gas.toNumber() * gasMultiplier)
        : undefined;
      const txn = await farm.execute(
        ethers.BigNumber.from(0),
        { slippage: 0 },
        adjustedGas ? { gasLimit: adjustedGas } : undefined
      );
      txToast.confirming(txn);

      const receipt = await txn.wait();
      txToast.success(receipt);

      await Promise.all([refetchFarmerSilo()]);
    } catch (err) {
      if (txToast) {
        txToast.error(err);
      } else {
        const errorToast = new TransactionToast({});
        errorToast.error(err);
      }
    } finally {
      setClaiming(false);
    }

    // Reset form
  }, [buildWorkflow, claimState, gas, refetchFarmerSilo]);

  const mounted = useRef<true | undefined>();
  useEffect(() => {
    if (mounted.current === undefined) return;
    if (claiming === false) {
      setClaimState(getInitialState());
    }
    mounted.current = true;
  }, [claiming, getInitialState]);

  const canClaim =
    farmerSilo?.beans?.earned?.gt(0) || breakdown.totalValue?.gt(0);

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
                open={open && canClaim}
                disabled={!canClaim}
                light
              />
            }
            onClick={open ? hide : show}
            disabled={!canClaim}
          >
            Claim
          </Button>
        </Box>
      </Stack>
      {open && canClaim && (
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
                    const amount =
                      farmerSilo.stalk.grownByToken.get(token) ||
                      sdk.tokens.STALK.amount(0);
                    const disabled = amount.eq(0);
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
                        stat={disabled ? 0 : displayFullBN(amount, 2, 0, true)}
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
                    <Connector top={29} />
                    <Connector top={69.5} />
                    <FormControlLabelStat
                      label="Earned Beans"
                      stat={displayFullBN(farmerSilo.beans.earned, 2, 0, true)}
                      disabled={farmerSilo.beans.earned.lte(0)}
                      checked={claimState.plant}
                      onChange={onChangePlant}
                    />
                    <FormControlLabelStat
                      label="Earned Stalk"
                      stat={displayFullBN(farmerSilo.stalk.earned, 2, 0, true)}
                      disabled={farmerSilo.beans.earned.lte(0)}
                      checked={claimState.plant}
                      onChange={onChangePlant}
                    />
                    <FormControlLabelStat
                      label="Plantable Seeds"
                      stat={displayFullBN(farmerSilo.seeds.earned, 2, 0, true)}
                      disabled={farmerSilo.seeds.earned.lte(0)}
                      checked={claimState.plant}
                      onChange={onChangePlant}
                    />
                  </FormGroup>
                </Box>
                <Box>
                  <Typography variant="h4">Enroot</Typography>
                  <FormGroup sx={{ position: 'relative' }}>
                    <Connector top={29} />
                    <FormControlLabelStat
                      label="Revitalized Stalk"
                      stat={displayFullBN(
                        revitalizedStalk || ZERO_BN,
                        2,
                        0,
                        true
                      )}
                      disabled={!revitalizedStalk || revitalizedStalk.lte(0)}
                      checked={claimState.enroot}
                      onChange={onChangeEnroot}
                    />
                    <FormControlLabelStat
                      label="Revitalized Seeds"
                      stat={displayFullBN(
                        revitalizedSeeds || ZERO_BN,
                        2,
                        0,
                        true
                      )}
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
                <TokenOutput danger={false}>
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
                  />
                  <TokenOutput.Row
                    token={sdk.tokens.STALK}
                    amount={output.get(sdk.tokens.STALK)!}
                    hideIfZero
                  />
                  <TokenOutput.Row
                    token={sdk.tokens.SEEDS}
                    amount={output.get(sdk.tokens.SEEDS)!}
                    hideIfZero
                  />
                </TokenOutput>
                <Button
                  disabled={empty || isImpersonating}
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={handleSubmit}
                >
                  {isImpersonating ? 'Impersonating Account' : 'Claim Rewards'}
                </Button>
                <Row justifyContent="flex-end" spacing={0.5}>
                  {isEstimatingGas ? (
                    <CircularProgress thickness={3} size={16} />
                  ) : (
                    <div />
                  )}
                  <Chip
                    variant="filled"
                    color="secondary"
                    label={
                      <GasTag
                        px={0}
                        gasLimit={BigNumberJS(
                          Math.floor((gas?.toNumber() || 0) * gasMultiplier)
                        )}
                      />
                    }
                  />
                </Row>
              </Stack>
            </Grid>
          </Grid>
        </Box>
      )}
    </Card>
  );
};

const SiloPage: FC<{}> = () => {
  /// State
  const { whitelist } = useWhitelistedTokens();
  const farmerSilo = useFarmerSilo();
  const beanstalkSilo = useSilo();

  const [whitelistVisible, setWhitelistVisible] = useState(true);

  const breakdown = useFarmerBalancesBreakdown();
  const season = useSeason();
  const { revitalizedStalk, revitalizedSeeds } = useRevitalized();

  const handleSetWhitelistVisible = (val: boolean, callback?: () => void) => {
    if (val === whitelistVisible) return;
    setWhitelistVisible(val);
    callback?.();
  };

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
              guides={[
                UNDERSTAND_SILO_VAPY,
                HOW_TO_DEPOSIT_IN_THE_SILO,
                CLAIM_SILO_REWARDS,
              ]}
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
        <SeedGaugeDetails setWhitelistVisible={handleSetWhitelistVisible} />
        <Box display={whitelistVisible ? 'block' : 'none'}>
          <Whitelist whitelist={whitelist} farmerSilo={farmerSilo} />
        </Box>
      </Stack>
    </Container>
  );
};

export default SiloPage;

/* <RewardsDialog
  open={open}
  handleClose={hide}
  beans={farmerSilo.beans}
  stalk={farmerSilo.stalk}
  seeds={farmerSilo.seeds}
  revitalizedStalk={revitalizedStalk}
  revitalizedSeeds={revitalizedSeeds}
/> */
