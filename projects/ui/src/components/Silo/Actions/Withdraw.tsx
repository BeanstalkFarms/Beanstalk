import React, { useCallback, useMemo } from 'react';
import { Accordion, AccordionDetails, Alert, Box, Divider, Stack } from '@mui/material';
import BigNumber from 'bignumber.js';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Token } from '~/classes';
import { SEEDS, STALK } from '~/constants/tokens';
import StyledAccordionSummary from '~/components/Common/Accordion/AccordionSummary';
import {
  FormState,
  TxnPreview,
  TokenOutputField,
  TokenInputField,
  TokenAdornment,
  TxnSeparator,
  SmartSubmitButton
} from '~/components/Common/Form';
import BeanstalkSDK from '~/lib/Beanstalk';
import useSeason from '~/hooks/beanstalk/useSeason';
import { FarmerSilo } from '~/state/farmer/silo';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import { displayFullBN, parseError, toStringBaseUnitBN } from '~/util';
import TransactionToast from '~/components/Common/TxnToast';
import { useSigner } from '~/hooks/ledger/useSigner';
import { ERC20Token } from '~/classes/Token';
import { AppState } from '~/state';
import { ActionType } from '~/util/Actions';
import { ZERO_BN } from '~/constants';
import { useFetchFarmerSilo } from '~/state/farmer/silo/updater';
import { useFetchBeanstalkSilo } from '~/state/beanstalk/silo/updater';
import IconWrapper from '../../Common/IconWrapper';
import { IconSize } from '../../App/muiTheme';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';

// -----------------------------------------------------------------------

type WithdrawFormValues = FormState;

const WithdrawForm : FC<
  FormikProps<WithdrawFormValues> & {
    token: Token;
    siloBalances: FarmerSilo['balances'];
    depositedBalance: BigNumber;
    withdrawSeasons: BigNumber;
    season: BigNumber;
  }
> = ({
  // Formik
  values,
  isSubmitting,
  submitForm,
  // Custom
  token: whitelistedToken,
  siloBalances,
  depositedBalance,
  withdrawSeasons,
  season,
}) => {
  // Input props
  const InputProps = useMemo(() => ({
    endAdornment: (
      <TokenAdornment token={whitelistedToken} />
    )
  }), [whitelistedToken]);

  // Confirmation dialog
  // const CONFIRM_DELAY = 2000; // ms
  // const [confirming, setConfirming] = useState(false);
  // const [allowConfirm, setAllowConfirm] = useState(false);
  // const [fill, setFill] = useState('');
  // const onClose = useCallback(() => {
  //   setConfirming(false);
  //   setAllowConfirm(false);
  //   setFill('');
  // }, []);
  // const onOpen  = useCallback(() => {
  //   setConfirming(true);
  //   setTimeout(() => {
  //     setFill('fill');
  //   }, 0);
  //   setTimeout(() => {
  //     setAllowConfirm(true);
  //   }, CONFIRM_DELAY);
  // }, []);
  // const onSubmit = useCallback(() => {
  //   submitForm();
  //   onClose();
  // }, [onClose, submitForm]);

  // Results
  const withdrawResult = BeanstalkSDK.Silo.Withdraw.withdraw(
    whitelistedToken,
    values.tokens,
    siloBalances[whitelistedToken.address]?.deposited.crates || [], // fallback
    season,
  );
  const isReady = (withdrawResult && withdrawResult.amount.lt(0));

  // For the Withdraw form, move this fragment outside of the return
  // statement because it's displayed twice (once in the form and)
  // once in the final popup
  const tokenOutputs = isReady ? (
    <>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1} justifyContent="center">
        <Box sx={{ flex: 1 }}>
          <TokenOutputField
            token={STALK}
            amount={withdrawResult.stalk}
            amountTooltip={(
              <>
                <div>Withdrawing from {withdrawResult.deltaCrates.length} Deposit{withdrawResult.deltaCrates.length === 1 ? '' : 's'}:</div>
                <Divider sx={{ opacity: 0.2, my: 1 }} />
                {withdrawResult.deltaCrates.map((_crate, i) => (
                  <div key={i}>
                    Season {_crate.season.toString()}: {displayFullBN(_crate.bdv, whitelistedToken.displayDecimals)} BDV, {displayFullBN(_crate.stalk, STALK.displayDecimals)} STALK, {displayFullBN(_crate.seeds, SEEDS.displayDecimals)} SEEDS
                  </div>
                ))}
              </>
            )}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <TokenOutputField
            token={SEEDS}
            amount={withdrawResult.seeds}
          />
        </Box>
      </Stack>
      <Alert
        color="warning"
        icon={<IconWrapper boxSize={IconSize.medium}><WarningAmberIcon sx={{ fontSize: IconSize.small }} /></IconWrapper>}
      >
        You can Claim your Withdrawn assets at the start of the next Season.
      </Alert>
    </>
  ) : null;

  return (
    <Form autoComplete="off" noValidate>
      {/* Confirmation Dialog */}
      {/* <StyledDialog open={confirming} onClose={onClose}>
        <StyledDialogTitle onClose={onClose}>Confirm Silo Withdrawal</StyledDialogTitle>
        <StyledDialogContent sx={{ pb: 1 }}>
          <Stack direction="column" gap={1}>
            <Box>
              <Typography variant="body2">
                You will forfeit .0001% ownership of Beanstalk. Withdrawing will burn your Grown Stalk & Seeds associated with your initial Deposit. 
              </Typography>
            </Box>
            {tokenOutputs}
          </Stack>
        </StyledDialogContent>
        <StyledDialogActions>
          <Button disabled={!allowConfirm} type="submit" onClick={onSubmit} variant="contained" color="warning" size="large" fullWidth sx={{ position: 'relative', overflow: 'hidden' }}>
            <Box
              sx={{
                background: 'rgba(0,0,0,0.03)',
                // display: !allowConfirm ? 'none' : 'block',
                width: '100%',
                transition: `height ${CONFIRM_DELAY}ms linear`,
                height: '0%',
                position: 'absolute',
                left: 0,
                bottom: 0,
                '&.fill': {
                  transition: `height ${CONFIRM_DELAY}ms linear`,
                  height: '100%',
                }
              }}
              className={fill}
            />
            Confirm Withdrawal
          </Button>
        </StyledDialogActions>
      </StyledDialog> */}
      {/* Form Content */}
      <Stack gap={1}>
        <TokenInputField
          name="tokens.0.amount"
          token={whitelistedToken}
          disabled={!depositedBalance || depositedBalance.eq(0)}
          balance={depositedBalance || ZERO_BN}
          balanceLabel="Deposited Balance"
          InputProps={InputProps}
        />
        {isReady ? (
          <Stack direction="column" gap={1}>
            <TxnSeparator />
            {tokenOutputs}
            <Box>
              <Accordion defaultExpanded variant="outlined">
                <StyledAccordionSummary title="Transaction Details" />
                <AccordionDetails>
                  <TxnPreview
                    actions={[
                      {
                        type: ActionType.WITHDRAW,
                        amount: withdrawResult.amount,
                        token: whitelistedToken,
                      },
                      {
                        type: ActionType.UPDATE_SILO_REWARDS,
                        stalk: withdrawResult.stalk,
                        seeds: withdrawResult.seeds,
                      },
                      {
                        type: ActionType.IN_TRANSIT,
                        amount: withdrawResult.amount,
                        token: whitelistedToken,
                        withdrawSeasons
                      }
                    ]}
                  />
                </AccordionDetails>
              </Accordion>
            </Box>
          </Stack>
        ) : null}
        <SmartSubmitButton
          loading={isSubmitting}
          disabled={!isReady || isSubmitting}
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          tokens={[]}
          mode="auto"
        >
          Withdraw
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

// -----------------------------------------------------------------------

const Withdraw : FC<{ token: ERC20Token; }> = ({ token }) => {
  /// Ledger
  const { data: signer } = useSigner();
  const beanstalk = useBeanstalkContract(signer);
  
  /// Beanstalk
  const season = useSeason();
  const withdrawSeasons = useSelector<AppState, BigNumber>((state) => state._beanstalk.silo.withdrawSeasons);

  /// Farmer
  const farmerSilo          = useFarmerSilo();
  const siloBalances        = farmerSilo.balances;
  const [refetchFarmerSilo] = useFetchFarmerSilo();
  const [refetchSilo]       = useFetchBeanstalkSilo();
  
  /// Form
  const middleware = useFormMiddleware();
  const depositedBalance = siloBalances[token.address]?.deposited.amount;
  const initialValues : WithdrawFormValues = useMemo(() => ({
    tokens: [
      {
        token: token,
        amount: undefined,
      },
    ],
  }), [token]);

  /// Handlers
  const onSubmit = useCallback(async (values: WithdrawFormValues, formActions: FormikHelpers<WithdrawFormValues>) => {
    let txToast;
    try {
      middleware.before();

      const withdrawResult = BeanstalkSDK.Silo.Withdraw.withdraw(
        token,
        values.tokens,
        siloBalances[token.address]?.deposited.crates,
        season,
      );

      if (!withdrawResult) throw new Error('Nothing to Withdraw.');
      
      let call;
      const seasons = withdrawResult.deltaCrates.map((crate) => crate.season.toString());
      const amounts = withdrawResult.deltaCrates.map((crate) => toStringBaseUnitBN(crate.amount.abs(), token.decimals));
      
      console.debug('[silo/withdraw] withdrawing: ', {
        withdrawResult,
        calldata: {
          seasons,
          amounts,
        },
      });
      
      /// Optimize the call used depending on the
      /// number of crates.
      if (seasons.length === 0) {
        throw new Error('Malformatted crates.');
      } else if (seasons.length === 1) {
        if (farmerSilo.beans.earned.gt(0)) {
          console.debug('[silo/withdraw] strategy: plant + withdrawDeposit');
          call = beanstalk.farm([
            beanstalk.interface.encodeFunctionData('plant'),
            beanstalk.interface.encodeFunctionData('withdrawDeposit', [
              token.address,
              seasons[0],
              amounts[0],
            ])
          ]);
        } else {
          console.debug('[silo/withdraw] strategy: withdrawDeposit');
          call = beanstalk.withdrawDeposit(
            token.address,
            seasons[0],
            amounts[0],
          );
        }
      } else if (farmerSilo.beans.earned.gt(0)) {
        console.debug('[silo/withdraw] strategy: plant + withdrawDeposits');
        call = beanstalk.farm([
          beanstalk.interface.encodeFunctionData('plant'),
          beanstalk.interface.encodeFunctionData('withdrawDeposits', [
            token.address,
            seasons,
            amounts,
          ])
        ]);
      } else {
        console.debug('[silo/withdraw] strategy: withdrawDeposits');
        call = beanstalk.withdrawDeposits(
          token.address,
          seasons,
          amounts,
        );
      }

      txToast = new TransactionToast({
        loading: `Withdrawing ${displayFullBN(withdrawResult.amount.abs(), token.displayDecimals, token.displayDecimals)} ${token.name} from the Silo...`,
        success: `Withdraw successful. Your ${token.name} will be available to Claim at the start of the next Season.`,
      });

      const txn = await call;
      txToast.confirming(txn);

      const receipt = await txn.wait();
      await Promise.all([
        refetchFarmerSilo(),
        refetchSilo(),
      ]);
      txToast.success(receipt);
      formActions.resetForm();
    } catch (err) {
      txToast ? txToast.error(err) : toast.error(parseError(err));
      formActions.setSubmitting(false);
    }
  }, [
    siloBalances,
    farmerSilo.beans.earned,
    beanstalk,
    token,
    season,
    refetchFarmerSilo,
    refetchSilo,
    middleware,
  ]);

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit}>
      {(formikProps) => (
        <WithdrawForm
          token={token}
          siloBalances={siloBalances}
          depositedBalance={depositedBalance}
          withdrawSeasons={withdrawSeasons}
          season={season}
          {...formikProps}
        />
      )}
    </Formik>
  );
};

export default Withdraw;
