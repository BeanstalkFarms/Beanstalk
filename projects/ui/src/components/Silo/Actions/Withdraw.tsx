import React, { useCallback, useMemo } from 'react';
import { Box, Divider, Stack } from '@mui/material';
import BigNumber from 'bignumber.js';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import { useSelector } from 'react-redux';
import { Token, ERC20Token, DataSource, StepGenerator } from '@beanstalk/sdk';
import { SEEDS, STALK } from '~/constants/tokens';
import {
  TxnPreview,
  TokenInputField,
  TokenAdornment,
  TxnSeparator,
  SmartSubmitButton,
  FormStateNew,
  FormTxnsFormState,
} from '~/components/Common/Form';
import BeanstalkSDKOld from '~/lib/Beanstalk';
import useSeason from '~/hooks/beanstalk/useSeason';
import { FarmerSilo } from '~/state/farmer/silo';
import { displayFullBN, tokenValueToBN } from '~/util';
import TransactionToast from '~/components/Common/TxnToast';
import { AppState } from '~/state';
import { ActionType } from '~/util/Actions';
import { ZERO_BN } from '~/constants';
import { useFetchBeanstalkSilo } from '~/state/beanstalk/silo/updater';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import useSdk, { getNewToOldToken } from '~/hooks/sdk';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import WarningAlert from '~/components/Common/Alert/WarningAlert';
import TxnAccordion from '~/components/Common/TxnAccordion';
import useFarmerDepositCrateFromPlant from '~/hooks/farmer/useFarmerDepositCrateFromPlant';
import useAccount from '~/hooks/ledger/useAccount';
import { FormTxn, FormTxnBuilder } from '~/util/FormTxns';
import FormTxnsPrimaryOptions from '~/components/Common/Form/FormTxnsPrimaryOptions';
import FormTxnsSecondaryOptions from '~/components/Common/Form/FormTxnsSecondaryOptions';
import useFarmerFormTxns from '~/hooks/farmer/form-txn/useFarmerFormTxns';
import useFarmerFormTxnBalances from '~/hooks/farmer/form-txn/useFarmerFormTxnBalances';
import useFarmerFormTxnsActions from '~/hooks/farmer/form-txn/useFarmerFormTxnActions';

// -----------------------------------------------------------------------

type WithdrawFormValues = FormStateNew & FormTxnsFormState;

const WithdrawForm: FC<
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
  // Custom
  token: whitelistedToken,
  siloBalances,
  depositedBalance,
  withdrawSeasons,
  season,
}) => {
  const sdk = useSdk();

  // Input props
  const InputProps = useMemo(
    () => ({
      endAdornment: <TokenAdornment token={whitelistedToken} />,
    }),
    [whitelistedToken]
  );

  // claim and plant
  const { plantableBalance } = useFarmerFormTxnBalances();
  const { crate: plantDepositCrate } = useFarmerDepositCrateFromPlant();
  const txActions = useFarmerFormTxnsActions();

  const shouldAppendPlantDepositCrate =
    values.farmActions.primary?.includes(FormTxn.PLANT) &&
    sdk.tokens.BEAN.equals(whitelistedToken);

  // Results
  /// use this for now until we migrate the forms to use the new sdk classes
  const withdrawResult = useMemo(() => {
    const crates = [
      ...(siloBalances[whitelistedToken.address]?.deposited.crates || []),
    ];
    if (shouldAppendPlantDepositCrate) crates.push(plantDepositCrate.asBN);

    return BeanstalkSDKOld.Silo.Withdraw.withdraw(
      getNewToOldToken(whitelistedToken),
      values.tokens,
      crates,
      season
    );
  }, [
    plantDepositCrate.asBN,
    season,
    shouldAppendPlantDepositCrate,
    siloBalances,
    values.tokens,
    whitelistedToken,
  ]);

  const isReady = withdrawResult && withdrawResult.amount.lt(0);

  return (
    <Form autoComplete="off" noValidate>
      {/* Form Content */}
      <Stack gap={1}>
        {/* Input Field */}
        <TokenInputField
          name="tokens.0.amount"
          token={whitelistedToken}
          disabled={!depositedBalance || depositedBalance.eq(0)}
          balance={depositedBalance || ZERO_BN}
          balanceLabel="Deposited Balance"
          InputProps={InputProps}
          additionalBalance={
            plantableBalance[whitelistedToken.address]?.applied
          }
          belowComponent={<FormTxnsPrimaryOptions />}
        />
        {isReady ? (
          <Stack direction="column" gap={1}>
            <TxnSeparator />
            <TokenOutput>
              <TokenOutput.Row
                token={sdk.tokens.STALK}
                amount={withdrawResult.stalk}
                amountTooltip={
                  <>
                    <div>
                      Withdrawing from {withdrawResult.deltaCrates.length}{' '}
                      Deposit
                      {withdrawResult.deltaCrates.length === 1 ? '' : 's'}:
                    </div>
                    <Divider sx={{ opacity: 0.2, my: 1 }} />
                    {withdrawResult.deltaCrates.map((_crate, i) => (
                      <div key={i}>
                        Season {_crate.season.toString()}:{' '}
                        {displayFullBN(
                          _crate.bdv,
                          whitelistedToken.displayDecimals
                        )}{' '}
                        BDV,{' '}
                        {displayFullBN(_crate.stalk, STALK.displayDecimals)}{' '}
                        STALK,{' '}
                        {displayFullBN(_crate.seeds, SEEDS.displayDecimals)}{' '}
                        SEEDS
                      </div>
                    ))}
                  </>
                }
              />
              <TokenOutput.Row
                token={sdk.tokens.SEEDS}
                amount={withdrawResult.seeds}
              />
            </TokenOutput>
            <WarningAlert>
              You can Claim your Withdrawn assets at the start of the next
              Season.
            </WarningAlert>
            <FormTxnsSecondaryOptions />
            <Box>
              <TxnAccordion>
                <TxnPreview
                  actions={[
                    {
                      type: ActionType.WITHDRAW,
                      amount: withdrawResult.amount,
                      token: getNewToOldToken(whitelistedToken),
                    },
                    {
                      type: ActionType.UPDATE_SILO_REWARDS,
                      stalk: withdrawResult.stalk,
                      seeds: withdrawResult.seeds,
                    },
                    {
                      type: ActionType.IN_TRANSIT,
                      amount: withdrawResult.amount,
                      token: getNewToOldToken(whitelistedToken),
                      withdrawSeasons,
                    },
                  ]}
                  {...txActions}
                />
              </TxnAccordion>
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

const Withdraw: FC<{ token: ERC20Token }> = ({ token }) => {
  const sdk = useSdk();
  const account = useAccount();
  const formTxn = useFarmerFormTxns();

  /// Beanstalk
  const season = useSeason();
  const withdrawSeasons = useSelector<AppState, BigNumber>(
    (state) => state._beanstalk.silo.withdrawSeasons
  );

  /// Farmer
  const farmerSilo = useFarmerSilo();
  const siloBalances = farmerSilo.balances;
  const [refetchSilo] = useFetchBeanstalkSilo();

  /// Form
  const middleware = useFormMiddleware();
  const depositedBalance = siloBalances[token.address]?.deposited.amount;
  const initialValues: WithdrawFormValues = useMemo(() => {
    const _preset = sdk.tokens.BEAN.equals(token) ? 'plant' : 'noPrimary';

    return {
      tokens: [
        {
          token: token,
          amount: undefined,
        },
      ],
      farmActions: {
        preset: _preset,
        primary: undefined,
        secondary: undefined,
        implied: [FormTxn.MOW],
      },
    };
  }, [sdk.tokens.BEAN, token]);

  /// Handlers
  const onSubmit = useCallback(
    async (
      values: WithdrawFormValues,
      formActions: FormikHelpers<WithdrawFormValues>
    ) => {
      let txToast;
      try {
        middleware.before();
        if (!account) throw new Error('Missing signer');

        const formData = values.tokens[0];
        const amount = token.amount((formData?.amount || 0).toString());
        const primaryActions = values.farmActions.primary;

        if (amount.lte(0)) throw new Error('Invalid amount.');

        const siloBalance = await sdk.silo.getBalance(token, account, {
          source: DataSource.LEDGER,
        });
        const depositCrates = [...siloBalance.deposited.crates];

        const shouldAppendCrate =
          primaryActions?.includes(FormTxn.PLANT) &&
          sdk.tokens.BEAN.equals(token);

        if (shouldAppendCrate) {
          const { crate: plantCrate } = await FormTxnBuilder.makePlantCrate(
            sdk,
            account
          );
          depositCrates.push(plantCrate);
        }

        const withdrawResult = sdk.silo.siloWithdraw.calculateWithdraw(
          token,
          amount,
          depositCrates,
          season.toNumber()
        );

        if (!withdrawResult || !withdrawResult.crates.length) {
          throw new Error('Nothing to Withdraw.');
        }

        const withdrawAmtStr = displayFullBN(
          tokenValueToBN(withdrawResult.amount.abs()),
          token.displayDecimals,
          token.displayDecimals
        );

        txToast = new TransactionToast({
          loading: `Withdrawing ${withdrawAmtStr} ${token.name} from the Silo...`,
          success: `Withdraw successful. Your ${token.name} will be available to Claim at the start of the next Season.`,
        });

        const seasons = withdrawResult.crates.map((crate) =>
          crate.season.toString()
        );
        const amounts = withdrawResult.crates.map(
          (crate) => crate.amount.blockchainString
        );

        let step: StepGenerator;
        // Optimize call based on number of crates
        if (seasons.length === 0) {
          throw new Error('Malformatted crates.');
        } else if (seasons.length === 1) {
          console.debug('[silo/withdraw] strategy: withdrawDeposit');
          step = new sdk.farm.actions.WithdrawDeposit(
            token.address,
            seasons[0],
            amounts[0]
          );
        } else {
          console.debug('[silo/withdraw] strategy: withdrawDeposits');
          step = new sdk.farm.actions.WithdrawDeposits(
            token.address,
            seasons,
            amounts
          );
        }

        const amountIn = token.amount(0);

        const { execute, performed } = await FormTxnBuilder.compile(
          sdk,
          values.farmActions,
          formTxn.getGenerators,
          [step],
          amountIn,
          0.1
        );

        const txn = await execute();

        txToast.confirming(txn);
        const receipt = await txn.wait();

        await formTxn.refetch(
          performed,
          {
            farmerSilo: true,
          },
          [refetchSilo]
        );

        txToast.success(receipt);
        formActions.resetForm();
      } catch (err) {
        if (txToast) {
          txToast.error(err);
        } else {
          const toast = new TransactionToast({});
          toast.error(err);
        }
        formActions.setSubmitting(false);
      }
    },
    [middleware, account, token, sdk, season, refetchSilo, formTxn]
  );

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

/* Confirmation Dialog */
/* <StyledDialog open={confirming} onClose={onClose}>
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
</StyledDialog> */
