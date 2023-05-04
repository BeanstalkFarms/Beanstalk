import React, { useCallback, useMemo } from 'react';
import { Box, Divider, Stack } from '@mui/material';
import BigNumber from 'bignumber.js';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import { useSelector } from 'react-redux';
import {
  Token,
  ERC20Token,
  TokenSiloBalance,
  TokenValue,
  BeanstalkSDK,
} from '@beanstalk/sdk';
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
import useSeason from '~/hooks/beanstalk/useSeason';
import { displayFullBN, tokenValueToBN } from '~/util';
import TransactionToast from '~/components/Common/TxnToast';
import { AppState } from '~/state';
import { ActionType } from '~/util/Actions';
import { ZERO_BN } from '~/constants';
import { useFetchBeanstalkSilo } from '~/state/beanstalk/silo/updater';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import useSdk, { getNewToOldToken } from '~/hooks/sdk';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import WarningAlert from '~/components/Common/Alert/WarningAlert';
import TxnAccordion from '~/components/Common/TxnAccordion';
import useAccount from '~/hooks/ledger/useAccount';
import AdditionalTxnsAccordion from '~/components/Common/Form/FormTxn/AdditionalTxnsAccordion';
import useFarmerFormTxnsActions from '~/hooks/farmer/form-txn/useFarmerFormTxnActions';
import AddPlantTxnToggle from '~/components/Common/Form/FormTxn/AddPlantTxnToggle';
import useFarmerSiloBalancesAsync from '~/hooks/farmer/useFarmerSiloBalancesAsync';
import FormTxnProvider from '~/components/Common/Form/FormTxnProvider';
import useFormTxnContext from '~/hooks/sdk/useFormTxnContext';
import { FormTxn, PlantAndDoX, WithdrawFarmStep } from '~/lib/Txn';

// -----------------------------------------------------------------------

/// tokenValueToBN is too long
/// remove me when we migrate everything to TokenValue & DecimalBigNumber
const toBN = tokenValueToBN;

type WithdrawFormValues = FormStateNew & FormTxnsFormState;

const WithdrawForm: FC<
  FormikProps<WithdrawFormValues> & {
    token: Token;
    siloBalance: TokenSiloBalance | undefined;
    withdrawSeasons: BigNumber;
    season: BigNumber;
    sdk: BeanstalkSDK;
    plantAndDoX: PlantAndDoX;
  }
> = ({
  // Formik
  values,
  isSubmitting,
  // Custom
  token: whitelistedToken,
  siloBalance,
  withdrawSeasons,
  season,
  sdk,
  plantAndDoX,
}) => {
  const { BEAN } = sdk.tokens;

  // Input props
  const InputProps = useMemo(
    () => ({
      endAdornment: <TokenAdornment token={whitelistedToken} />,
    }),
    [whitelistedToken]
  );

  // claim and plant
  const txActions = useFarmerFormTxnsActions();
  const isUsingPlant = Boolean(
    values.farmActions.primary?.includes(FormTxn.PLANT) &&
      sdk.tokens.BEAN.equals(whitelistedToken)
  );

  // Results
  const withdrawResult = useMemo(() => {
    const amount = BEAN.amount(values.tokens[0].amount?.toString() || '0');
    const crates = siloBalance?.deposited.crates || [];

    if (!isUsingPlant && (amount.lte(0) || !crates.length)) return null;
    if (isUsingPlant && plantAndDoX.getAmount().lte(0)) return null;

    return WithdrawFarmStep.calculateWithdraw(
      sdk.silo.siloWithdraw,
      whitelistedToken,
      crates,
      amount,
      season.toNumber(),
      isUsingPlant ? plantAndDoX : undefined
    );
  }, [
    BEAN,
    isUsingPlant,
    plantAndDoX,
    sdk.silo.siloWithdraw,
    season,
    siloBalance?.deposited.crates,
    values.tokens,
    whitelistedToken,
  ]);

  /// derived
  const depositedBalance = siloBalance?.deposited.amount;

  const isReady = withdrawResult && !withdrawResult.amount.lt(0);

  const disabledActions = useMemo(
    () => (whitelistedToken.isUnripe ? [FormTxn.ENROOT] : undefined),
    [whitelistedToken.isUnripe]
  );

  return (
    <Form autoComplete="off" noValidate>
      {/* Form Content */}
      <Stack gap={1}>
        {/* Input Field */}
        <TokenInputField
          name="tokens.0.amount"
          token={whitelistedToken}
          disabled={!depositedBalance || depositedBalance.eq(0)}
          balance={toBN(depositedBalance || TokenValue.ZERO) || ZERO_BN}
          balanceLabel="Deposited Balance"
          InputProps={InputProps}
        />
        <AddPlantTxnToggle />
        {isReady ? (
          <Stack direction="column" gap={1}>
            <TxnSeparator />
            <TokenOutput>
              <TokenOutput.Row
                token={sdk.tokens.STALK}
                amount={withdrawResult.stalk.mul(-1)}
                amountTooltip={
                  <>
                    <div>
                      Withdrawing from {withdrawResult.crates.length} Deposit
                      {withdrawResult.crates.length === 1 ? '' : 's'}:
                    </div>
                    <Divider sx={{ opacity: 0.2, my: 1 }} />
                    {withdrawResult.crates.map((_crate, i) => (
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
                amount={withdrawResult.seeds.mul(-1)}
              />
            </TokenOutput>
            <WarningAlert>
              You can Claim your Withdrawn assets at the start of the next
              Season.
            </WarningAlert>
            <AdditionalTxnsAccordion filter={disabledActions} />
            <Box>
              <TxnAccordion>
                <TxnPreview
                  actions={[
                    {
                      type: ActionType.WITHDRAW,
                      amount: toBN(withdrawResult.amount),
                      token: getNewToOldToken(whitelistedToken),
                    },
                    {
                      type: ActionType.UPDATE_SILO_REWARDS,
                      stalk: toBN(withdrawResult.stalk),
                      seeds: toBN(withdrawResult.seeds),
                    },
                    {
                      type: ActionType.IN_TRANSIT,
                      amount: toBN(withdrawResult.amount),
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

const WithdrawPropProvider: FC<{
  token: ERC20Token;
  // TEMPORARY. will be remove when sdk types are moved to redux
  siloBalance: ReturnType<typeof useFarmerSiloBalancesAsync>;
}> = ({ token, siloBalance }) => {
  const sdk = useSdk();
  const { txnBundler, plantAndDoX, refetch } = useFormTxnContext();
  const account = useAccount();

  /// Beanstalk
  const season = useSeason();
  const withdrawSeasons = useSelector<AppState, BigNumber>(
    (state) => state._beanstalk.silo.withdrawSeasons
  );

  /// Farmer
  const [farmerBalances, fetchFarmerBalances] = siloBalance;
  const [refetchSilo] = useFetchBeanstalkSilo();

  /// Form
  const middleware = useFormMiddleware();
  const initialValues: WithdrawFormValues = useMemo(
    () => ({
      tokens: [
        {
          token: token,
          amount: undefined,
        },
      ],
      farmActions: {
        preset: sdk.tokens.BEAN.equals(token) ? 'plant' : 'noPrimary',
        primary: undefined,
        secondary: undefined,
        implied: [FormTxn.MOW],
      },
    }),
    [sdk.tokens.BEAN, token]
  );

  const onSubmit = useCallback(
    async (
      values: WithdrawFormValues,
      formActions: FormikHelpers<WithdrawFormValues>
    ) => {
      let txToast;
      try {
        middleware.before();
        if (!account) throw new Error('Missing signer');
        if (!farmerBalances?.deposited.crates) {
          throw new Error('No balances found');
        }

        const formData = values.tokens[0];
        const primaryActions = values.farmActions.primary;

        const addPlant =
          primaryActions?.includes(FormTxn.PLANT) &&
          sdk.tokens.BEAN.equals(token);

        const baseAmount = token.amount((formData?.amount || 0).toString());

        const totalAmount = addPlant
          ? baseAmount.add(plantAndDoX.getAmount())
          : baseAmount;

        if (totalAmount.lte(0)) throw new Error('Invalid amount.');

        const withdrawTxn = new WithdrawFarmStep(sdk, token, [
          ...farmerBalances.deposited.crates,
        ]);

        withdrawTxn.build(
          baseAmount,
          season.toNumber(),
          addPlant ? plantAndDoX : undefined
        );

        if (!withdrawTxn.withdrawResult) {
          throw new Error('Nothing to Withdraw.');
        }

        const withdrawAmtStr = displayFullBN(
          withdrawTxn.withdrawResult.amount.abs(),
          token.displayDecimals,
          token.displayDecimals
        );

        txToast = new TransactionToast({
          loading: `Withdrawing ${withdrawAmtStr} ${token.name} from the Silo...`,
          success: `Withdraw successful. Your ${token.name} will be available to Claim at the start of the next Season.`,
        });

        const actionsPerformed = txnBundler.setFarmSteps(values.farmActions);
        const { execute } = await txnBundler.bundle(
          withdrawTxn,
          // we can pass in 0 here b/c WithdrawFarmStep already receives it's input amount in build();
          token.amount(0),
          0.1
        );

        const txn = await execute();

        txToast.confirming(txn);
        const receipt = await txn.wait();

        await refetch(actionsPerformed, { farmerSilo: true }, [
          refetchSilo,
          fetchFarmerBalances,
        ]);

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
    [
      middleware,
      account,
      farmerBalances?.deposited.crates,
      sdk,
      token,
      plantAndDoX,
      season,
      txnBundler,
      refetch,
      refetchSilo,
      fetchFarmerBalances,
    ]
  );

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit}>
      {(formikProps) => (
        <WithdrawForm
          token={token}
          withdrawSeasons={withdrawSeasons}
          siloBalance={farmerBalances}
          season={season}
          sdk={sdk}
          plantAndDoX={plantAndDoX}
          {...formikProps}
        />
      )}
    </Formik>
  );
};

const Withdraw: React.FC<{
  token: ERC20Token;
  // TEMPORARY. will be remove when sdk types are moved to redux
  siloBalance: ReturnType<typeof useFarmerSiloBalancesAsync>;
}> = (props) => (
  <FormTxnProvider>
    <WithdrawPropProvider {...props} />
  </FormTxnProvider>
);

export default Withdraw;
