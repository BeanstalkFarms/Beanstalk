import React, { useCallback, useMemo } from 'react';
import { Box, Divider, Stack } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import BigNumber from 'bignumber.js';
import { DataSource, ERC20Token, StepGenerator, Token } from '@beanstalk/sdk';
import FieldWrapper from '~/components/Common/Form/FieldWrapper';
import AddressInputField from '~/components/Common/Form/AddressInputField';
import {
  FormStateNew,
  FormTxnsFormState,
  SmartSubmitButton,
  TokenAdornment,
  TokenInputField,
  TxnPreview,
} from '~/components/Common/Form';
import { ZERO_BN } from '~/constants';
import { FarmerSilo } from '~/state/farmer/silo';
import useFarmerSiloBalances from '~/hooks/farmer/useFarmerSiloBalances';
import { useFetchBeanstalkSilo } from '~/state/beanstalk/silo/updater';
import BeanstalkSDKOld from '~/lib/Beanstalk';
import useSeason from '~/hooks/beanstalk/useSeason';
import TxnSeparator from '~/components/Common/Form/TxnSeparator';
import {
  displayFullBN,
  displayTokenAmount,
  tokenValueToBN,
  trimAddress,
} from '~/util';
import { FontSize } from '~/components/App/muiTheme';
import { ActionType } from '~/util/Actions';
import TransactionToast from '~/components/Common/TxnToast';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import useSdk, { getNewToOldToken } from '~/hooks/sdk';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import WarningAlert from '~/components/Common/Alert/WarningAlert';
import TxnAccordion from '~/components/Common/TxnAccordion';
import useAccount from '~/hooks/ledger/useAccount';
import useFarmerDepositCrateFromPlant from '~/hooks/farmer/useFarmerDepositCrateFromPlant';
import { FormTxn, FormTxnBuilder } from '~/util/FormTxns';
import AdditionalTxnsAccordion from '~/components/Common/Form/FormTxn/AdditionalTxnsAccordion';
import useFarmerFormTxns from '~/hooks/farmer/form-txn/useFarmerFormTxns';
import useFarmerFormTxnsActions from '~/hooks/farmer/form-txn/useFarmerFormTxnActions';
import useFarmerFormTxnBalances from '~/hooks/farmer/form-txn/useFarmerFormTxnBalances';
import AddPlantTxnToggle from '~/components/Common/Form/FormTxn/AddPlantTxnToggle';

export type TransferFormValues = FormStateNew &
  FormTxnsFormState & {
    to: string;
  };

const TransferForm: FC<
  FormikProps<TransferFormValues> & {
    token: Token;
    siloBalances: FarmerSilo['balances'];
    depositedBalance: BigNumber;
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
  season,
}) => {
  const sdk = useSdk();
  const Bean = sdk.tokens.BEAN;

  /// Claim and Plant
  const { plantableBalance } = useFarmerFormTxnBalances();
  const plantUtil = useFarmerDepositCrateFromPlant();
  const txnActions = useFarmerFormTxnsActions();

  const isUsingPlanted = Boolean(
    values.farmActions.primary?.includes(FormTxn.PLANT) &&
      Bean.equals(whitelistedToken)
  );

  // Results
  /// use this for now until we migrate the forms to use the new sdk classes
  const withdrawResult = useMemo(() => {
    const formTokenState = { ...values.tokens[0] };
    const crates = [
      ...(siloBalances[whitelistedToken.address]?.deposited.crates || []),
    ];

    if (isUsingPlanted) {
      crates.push(plantUtil.crate.asBN);
      const plantAmount = plantableBalance[Bean.address].applied;
      formTokenState.amount = formTokenState.amount?.plus(plantAmount);
    }
    return BeanstalkSDKOld.Silo.Withdraw.withdraw(
      getNewToOldToken(whitelistedToken),
      [formTokenState],
      crates,
      season
    );
  }, [
    Bean,
    isUsingPlanted,
    plantUtil.crate.asBN,
    plantableBalance,
    season,
    siloBalances,
    values.tokens,
    whitelistedToken,
  ]);

  const disabledActions = useMemo(
    () => (whitelistedToken.isUnripe ? [FormTxn.ENROOT] : undefined),
    [whitelistedToken.isUnripe]
  );

  // derived
  const isReady = withdrawResult && withdrawResult.amount.lt(0);

  // Input props
  const InputProps = useMemo(
    () => ({
      endAdornment: <TokenAdornment token={whitelistedToken} />,
    }),
    [whitelistedToken]
  );

  const TokenOutputs = () => {
    if (!isReady) return null;
    if (
      !withdrawResult.amount ||
      !withdrawResult.seeds ||
      !withdrawResult.stalk
    ) {
      return null;
    }
    const { STALK, SEEDS } = sdk.tokens;

    return (
      <TokenOutput>
        <TokenOutput.Row
          token={whitelistedToken}
          amount={withdrawResult.amount || ZERO_BN}
        />
        <TokenOutput.Row
          token={STALK}
          amount={withdrawResult.stalk || ZERO_BN}
          amountTooltip={
            <>
              <div>
                Withdrawing from {withdrawResult.deltaCrates.length} Deposit
                {withdrawResult.deltaCrates.length === 1 ? '' : 's'}:
              </div>
              <Divider sx={{ opacity: 0.2, my: 1 }} />
              {withdrawResult.deltaCrates.map((_crate, i) => (
                <div key={i}>
                  Season {_crate.season.toString()}:{' '}
                  {displayFullBN(_crate.bdv, whitelistedToken.displayDecimals)}{' '}
                  BDV, {displayFullBN(_crate.stalk, STALK.displayDecimals)}{' '}
                  STALK, {displayFullBN(_crate.seeds, SEEDS.displayDecimals)}{' '}
                  SEEDS
                </div>
              ))}
            </>
          }
        />
        <TokenOutput.Row
          token={SEEDS}
          amount={withdrawResult.seeds || ZERO_BN}
        />
      </TokenOutput>
    );
  };

  return (
    <Form autoComplete="off">
      <Stack gap={1}>
        {/* Input Field */}
        <TokenInputField
          name="tokens.0.amount"
          token={whitelistedToken}
          disabled={!depositedBalance || depositedBalance.eq(0)}
          balance={depositedBalance || ZERO_BN}
          balanceLabel="Deposited Balance"
          InputProps={InputProps}
        />
        <AddPlantTxnToggle />
        {depositedBalance?.gt(0) && (
          <>
            <FieldWrapper label="Transfer to">
              <AddressInputField name="to" />
            </FieldWrapper>
            {values.to !== '' && withdrawResult?.amount.abs().gt(0) && (
              <>
                <TxnSeparator />
                <TokenOutputs />
                <WarningAlert>
                  More recent Deposits are Transferred first.
                </WarningAlert>
                <AdditionalTxnsAccordion filter={disabledActions} />
                <Box>
                  <TxnAccordion>
                    <TxnPreview
                      actions={[
                        {
                          type: ActionType.TRANSFER,
                          amount: withdrawResult
                            ? withdrawResult.amount.abs()
                            : ZERO_BN,
                          token: getNewToOldToken(whitelistedToken),
                          stalk: withdrawResult
                            ? withdrawResult.stalk.abs()
                            : ZERO_BN,
                          seeds: withdrawResult
                            ? withdrawResult?.seeds.abs()
                            : ZERO_BN,
                          to: values.to,
                        },
                        {
                          type: ActionType.BASE,
                          message: (
                            <>
                              The following Deposits will be used:
                              <br />
                              <ul
                                css={{
                                  paddingLeft: '25px',
                                  marginTop: '10px',
                                  marginBottom: 0,
                                  fontSize: FontSize.sm,
                                }}
                              >
                                {withdrawResult.deltaCrates.map(
                                  (crate, index) => (
                                    <li key={index}>
                                      {displayTokenAmount(
                                        crate.amount,
                                        whitelistedToken
                                      )}{' '}
                                      from Deposits in Season{' '}
                                      {crate.season.toString()}
                                    </li>
                                  )
                                )}
                              </ul>
                            </>
                          ),
                        },
                        {
                          type: ActionType.END_TOKEN,
                          token: getNewToOldToken(whitelistedToken),
                        },
                      ]}
                      {...txnActions}
                    />
                  </TxnAccordion>
                </Box>
              </>
            )}
          </>
        )}
        <SmartSubmitButton
          loading={isSubmitting}
          disabled={
            !isReady ||
            !depositedBalance ||
            depositedBalance.eq(0) ||
            isSubmitting ||
            values.to === ''
          }
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          tokens={[]}
          mode="auto"
        >
          {!depositedBalance || depositedBalance.eq(0)
            ? 'Nothing to Transfer'
            : 'Transfer'}
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

const Transfer: FC<{ token: ERC20Token }> = ({ token }) => {
  const sdk = useSdk();
  const account = useAccount();
  const formTxns = useFarmerFormTxns();

  /// Beanstalk
  const season = useSeason();

  /// Farmer
  const siloBalances = useFarmerSiloBalances();
  const [refetchSilo] = useFetchBeanstalkSilo();

  /// Form
  const middleware = useFormMiddleware();
  const depositedBalance = siloBalances[token.address]?.deposited.amount;
  const initialValues: TransferFormValues = useMemo(
    () => ({
      tokens: [
        {
          token: token,
          amount: undefined,
        },
      ],
      to: '',
      farmActions: {
        preset: sdk.tokens.BEAN.equals(token) ? 'plant' : 'noPrimary',
        primary: undefined,
        secondary: undefined,
        implied: [FormTxn.MOW],
      },
    }),
    [sdk.tokens.BEAN, token]
  );

  /// Handlers
  const onSubmit = useCallback(
    async (
      values: TransferFormValues,
      formActions: FormikHelpers<TransferFormValues>
    ) => {
      let txToast;
      try {
        middleware.before();
        if (!account) throw new Error('Missing signer');
        if (!values.to) {
          throw new Error('Please enter a valid recipient address.');
        }

        const formData = values.tokens[0];
        const primaryActions = values.farmActions.primary;

        let amount = token.amount((formData?.amount || 0).toString());

        if (amount.lte(0)) throw new Error('Please enter a valid amount.');

        const siloBalance = await sdk.silo.getBalance(token, account, {
          source: DataSource.LEDGER,
        });
        const depositCrates = [...siloBalance.deposited.crates];

        const isUsingPlanted =
          primaryActions?.includes(FormTxn.PLANT) &&
          sdk.tokens.BEAN.equals(token);

        if (isUsingPlanted) {
          const plantData = await FormTxnBuilder.makePlantCrate(sdk, account);
          depositCrates.push(plantData.crate);
          amount = amount.add(plantData.amount);
        }

        const withdrawResult = sdk.silo.siloWithdraw.calculateWithdraw(
          token,
          amount,
          depositCrates,
          season.toNumber()
        );

        if (!withdrawResult || !withdrawResult.crates.length) {
          throw new Error('Nothing to Transfer.');
        }

        const withdrawAmtStr = displayFullBN(
          tokenValueToBN(withdrawResult.amount.abs()),
          token.displayDecimals,
          token.displayDecimals
        );

        txToast = new TransactionToast({
          loading: `Transferring ${withdrawAmtStr} ${
            token.name
          } to ${trimAddress(values.to, true)}.`,
          success: 'Transfer successful.',
        });

        const seasons = withdrawResult.crates.map((crate) =>
          crate.season.toString()
        );
        const amounts = withdrawResult.crates.map((crate) =>
          crate.amount.toBlockchain()
        );

        console.debug('[silo/transfer] transferring: ', {
          withdrawResult,
          calldata: {
            seasons,
            amounts,
          },
        });

        let step: StepGenerator;

        if (seasons.length === 0) {
          throw new Error('Malformatted crates.');
        } else if (seasons.length === 1) {
          console.debug('[silo/transfer] strategy: transferDeposit');
          step = new sdk.farm.actions.TransferDeposit(
            account,
            values.to,
            token.address,
            seasons[0],
            amounts[0]
          );
        } else {
          console.debug('[silo/transfer] strategy: transferDeposits');
          step = new sdk.farm.actions.TransferDeposits(
            account,
            values.to,
            token.address,
            seasons,
            amounts
          );
        }

        const amountIn = token.amount(0);
        const { execute, performed } = await FormTxnBuilder.compile(
          sdk,
          values.farmActions,
          formTxns.getGenerators,
          [step],
          amountIn,
          0.1
        );

        const txn = await execute();
        txToast.confirming(txn);

        const receipt = await txn.wait();
        await formTxns.refetch(performed, { farmerSilo: true }, [refetchSilo]);

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
    [middleware, account, token, sdk, season, refetchSilo, formTxns]
  );

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit}>
      {(formikProps: FormikProps<TransferFormValues>) => (
        <TransferForm
          token={token}
          siloBalances={siloBalances}
          depositedBalance={depositedBalance}
          season={season}
          {...formikProps}
        />
      )}
    </Formik>
  );
};

export default Transfer;
