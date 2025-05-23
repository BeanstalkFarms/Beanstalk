import React, { useCallback, useMemo } from 'react';
import { Box, Divider, Stack } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import BigNumber from 'bignumber.js';
import { Deposit, ERC20Token, Token, TokenValue } from '@beanstalk/sdk';
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
import { useFetchBeanstalkSilo } from '~/state/beanstalk/silo/updater';
import useSeason from '~/hooks/beanstalk/useSeason';
import TxnSeparator from '~/components/Common/Form/TxnSeparator';
import {
  displayFullBN,
  displayTokenAmount,
  tokenValueToBN,
  transform,
  trimAddress,
} from '~/util';
import { FontSize } from '~/components/App/muiTheme';
import { ActionType } from '~/util/Actions';
import TransactionToast from '~/components/Common/TxnToast';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import useSdk from '~/hooks/sdk';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import WarningAlert from '~/components/Common/Alert/WarningAlert';
import TxnAccordion from '~/components/Common/TxnAccordion';
import useAccount from '~/hooks/ledger/useAccount';
import AdditionalTxnsAccordion from '~/components/Common/Form/FormTxn/AdditionalTxnsAccordion';
import useFarmerFormTxnsActions from '~/hooks/farmer/form-txn/useFarmerFormTxnActions';
import AddPlantTxnToggle from '~/components/Common/Form/FormTxn/AddPlantTxnToggle';
import FormTxnProvider from '~/components/Common/Form/FormTxnProvider';
import useFormTxnContext from '~/hooks/sdk/useFormTxnContext';
import {
  FormTxn,
  PlantAndDoX,
  TransferFarmStep,
  WithdrawFarmStep,
} from '~/lib/Txn';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import { useGetLegacyToken } from '~/hooks/beanstalk/useTokens';
import { useTokenDepositsContext } from '../Token/TokenDepositsContext';

/// tokenValueToBN is too long
/// remove me when we migrate everything to TokenValue & DecimalBigNumber
const toBN = tokenValueToBN;

export type TransferFormValues = FormStateNew &
  FormTxnsFormState & {
    to: string;
  };

const TransferForm: FC<
  FormikProps<TransferFormValues> & {
    token: Token;
    season: BigNumber;
    plantAndDoX: PlantAndDoX | undefined;
    max: BigNumber;
    transferrableDeposits: {
      [k: string]: Deposit<TokenValue>;
    };
  }
> = ({
  // Formik
  values,
  isSubmitting,
  // Custom
  token: whitelistedToken,
  max,
  transferrableDeposits,
  season,
  plantAndDoX,
}) => {
  const sdk = useSdk();
  const { BEAN, STALK, SEEDS } = sdk.tokens;
  const getLegacyToken = useGetLegacyToken();

  // Check address on change

  /// Claim and Plant
  const txnActions = useFarmerFormTxnsActions({ mode: 'plantToggle' });
  const isUsingPlant = Boolean(
    values.farmActions.primary?.includes(FormTxn.PLANT) &&
      BEAN.equals(whitelistedToken) &&
      plantAndDoX
  );
  const farmerSilo = useFarmerSilo();
  const earnedBeans = transform(farmerSilo.beans.earned, 'tokenValue', BEAN);
  const earnedStalk = transform(farmerSilo.stalk.earned, 'tokenValue', STALK);
  const earnedSeeds = transform(farmerSilo.seeds.earned, 'tokenValue', SEEDS);

  // Results
  const withdrawResult = useMemo(() => {
    const amount = whitelistedToken.amount(
      values.tokens[0].amount?.toString() || '0'
    );
    const deposits = Object.values(transferrableDeposits);
    if (max.eq(0)) return null;
    if (!isUsingPlant && (amount.lte(0) || !deposits.length)) return null;
    if (isUsingPlant && plantAndDoX?.getAmount().lte(0)) return null;

    // FIXME: stems
    return WithdrawFarmStep.calculateWithdraw(
      sdk.silo.siloWithdraw,
      whitelistedToken,
      deposits,
      amount,
      season.toNumber()
    );
  }, [
    max,
    isUsingPlant,
    plantAndDoX,
    sdk.silo.siloWithdraw,
    season,
    transferrableDeposits,
    values.tokens,
    whitelistedToken,
  ]);

  const disabledActions = useMemo(
    () => (whitelistedToken.isUnripe ? [FormTxn.ENROOT] : undefined),
    [whitelistedToken.isUnripe]
  );

  // derived
  // const depositedBalance = siloBalance?.amount;
  const isReady = withdrawResult && !withdrawResult?.amount.lt(0);

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

    return (
      <TokenOutput>
        <TokenOutput.Row
          token={whitelistedToken}
          amount={(isUsingPlant
            ? withdrawResult.amount.add(earnedBeans)
            : withdrawResult.amount
          ).mul(-1)}
        />
        <TokenOutput.Row
          token={STALK}
          amount={(isUsingPlant
            ? withdrawResult.stalk.add(earnedStalk)
            : withdrawResult.stalk
          ).mul(-1)}
          amountTooltip={
            <>
              <div>
                Transferring from {withdrawResult.crates.length} Deposit
                {withdrawResult.crates.length === 1 ? '' : 's'}:
              </div>
              <Divider sx={{ opacity: 0.2, my: 1 }} />
              {withdrawResult.crates.map((_crate, i) => (
                <div key={i}>
                  Stem {_crate.stem.toString()}:{' '}
                  {displayFullBN(_crate.bdv, whitelistedToken.displayDecimals)}{' '}
                  BDV,{' '}
                  {displayFullBN(_crate.stalk.total, STALK.displayDecimals)}{' '}
                  STALK, {displayFullBN(_crate.seeds, SEEDS.displayDecimals)}{' '}
                  SEEDS
                </div>
              ))}
            </>
          }
        />
        <TokenOutput.Row
          token={SEEDS}
          amount={(isUsingPlant
            ? withdrawResult.seeds.add(earnedSeeds)
            : withdrawResult.seeds
          ).mul(-1)}
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
          disabled={!max || max.eq(0)}
          balance={max}
          balanceLabel="Deposited Balance"
          InputProps={InputProps}
        />
        <AddPlantTxnToggle plantAndDoX={plantAndDoX} actionText="Transfer" />
        {max?.gt(0) && (
          <>
            <FieldWrapper label="Transfer to">
              <AddressInputField name="to" />
            </FieldWrapper>
            {values.to !== '' &&
              withdrawResult?.amount.add(earnedBeans).abs().gt(0) && (
                <>
                  <TxnSeparator />
                  <TokenOutputs />
                  {withdrawResult?.amount.abs().gt(0) && (
                    <WarningAlert>
                      More recent Deposits are Transferred first.
                    </WarningAlert>
                  )}
                  <AdditionalTxnsAccordion filter={disabledActions} />
                  <Box>
                    <TxnAccordion>
                      <TxnPreview
                        actions={[
                          {
                            type: ActionType.TRANSFER,
                            amount: withdrawResult
                              ? toBN(
                                  (isUsingPlant
                                    ? withdrawResult.amount.add(earnedBeans)
                                    : withdrawResult.amount
                                  ).abs()
                                )
                              : ZERO_BN,
                            token: getLegacyToken(whitelistedToken),
                            stalk: withdrawResult
                              ? toBN(
                                  (isUsingPlant
                                    ? withdrawResult.stalk.add(earnedStalk)
                                    : withdrawResult.stalk
                                  ).abs()
                                )
                              : ZERO_BN,
                            seeds: withdrawResult
                              ? toBN(
                                  (isUsingPlant
                                    ? withdrawResult.seeds.add(earnedSeeds)
                                    : withdrawResult.seeds
                                  ).abs()
                                )
                              : ZERO_BN,
                            to: values.to,
                          },
                          withdrawResult?.amount.abs().gt(0)
                            ? {
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
                                      {isUsingPlant && (
                                        <li key="earnedBeanCrate">
                                          {`${displayTokenAmount(
                                            earnedBeans,
                                            sdk.tokens.BEAN,
                                            { showName: false }
                                          )} Earned Beans`}
                                        </li>
                                      )}
                                      {withdrawResult.crates.map(
                                        (crate, index) => (
                                          <li key={index}>
                                            {displayTokenAmount(
                                              crate.amount,
                                              whitelistedToken
                                            )}{' '}
                                            from Deposits at Stem{' '}
                                            {crate.stem.toString()}
                                          </li>
                                        )
                                      )}
                                    </ul>
                                  </>
                                ),
                              }
                            : undefined,
                          {
                            type: ActionType.END_TOKEN,
                            token: getLegacyToken(whitelistedToken),
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
            !isReady || !max || max.eq(0) || isSubmitting || values.to === ''
          }
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          tokens={[]}
          mode="auto"
        >
          {!max || max.eq(0) ? 'Nothing to Transfer' : 'Transfer'}
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

const TransferPropProvider: FC<{
  token: ERC20Token;
}> = ({ token }) => {
  const sdk = useSdk();
  const account = useAccount();
  const {
    selected: selectedDeposits,
    depositsById,
    clear,
  } = useTokenDepositsContext();

  const { max, transferrableDeposits } = useMemo(() => {
    const entries = Object.entries(depositsById).filter(([key, _]) =>
      selectedDeposits.has(key)
    );

    const transferrable = Object.fromEntries(entries);

    const maxAmount = Object.values(transferrable).reduce(
      (acc, deposit) => acc.add(deposit.amount),
      TokenValue.ZERO
    );

    return {
      max: transform(maxAmount, 'bnjs', token),
      transferrableDeposits: transferrable,
    };
  }, [selectedDeposits, depositsById, token]);

  /// Beanstalk
  const season = useSeason();

  /// Farmer
  const [refetchSilo] = useFetchBeanstalkSilo();

  /// Form
  const middleware = useFormMiddleware();
  const { txnBundler, plantAndDoX, refetch } = useFormTxnContext();

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

        const deposits = Object.values(transferrableDeposits);

        if (!deposits?.length) {
          throw new Error('No balances found');
        }

        const formData = values.tokens[0];
        const primaryActions = values.farmActions.primary;

        const { plantAction } = plantAndDoX;

        const isPlanting =
          plantAndDoX &&
          primaryActions?.includes(FormTxn.PLANT) &&
          sdk.tokens.BEAN.equals(token);

        const baseAmount = token.amount((formData?.amount || 0).toString());

        const totalAmount =
          isPlanting && plantAction
            ? baseAmount.add(plantAction.getAmount())
            : baseAmount;

        if (totalAmount.lte(0)) throw new Error('Invalid amount.');

        const transferTxn = new TransferFarmStep(sdk, token, account, [
          ...Object.values(transferrableDeposits),
        ]);

        transferTxn.build(
          values.to,
          baseAmount,
          season.toNumber(),
          isPlanting ? plantAction : undefined
        );

        if (!transferTxn.withdrawResult) {
          throw new Error('Nothing to withdraw');
        }

        const withdrawAmtStr = displayFullBN(
          transferTxn.withdrawResult.amount.abs(),
          token.displayDecimals,
          token.displayDecimals
        );

        txToast = new TransactionToast({
          loading: `Transferring ${withdrawAmtStr} ${
            token.name
          } to ${trimAddress(values.to, true)}.`,
          success: 'Transfer successful.',
        });

        const actionsPerformed = txnBundler.setFarmSteps(values.farmActions);

        const { execute } = await txnBundler.bundle(
          transferTxn,
          // we can pass in 0 here b/c TransferFarmStep already receives it's input amount in build();
          token.amount(0),
          0.1
        );
        const txn = await execute();
        txToast.confirming(txn);

        const receipt = await txn.wait();
        await refetch(actionsPerformed, { farmerSilo: true }, [refetchSilo]);

        txToast.success(receipt);

        formActions.resetForm();
        clear();
      } catch (err) {
        if (txToast) {
          if (err instanceof Error) {
            if (err.message.includes('SafeMath: subtraction overflow')) {
              txToast.error({
                code: 'CALL_EXCEPTION',
                message:
                  'Germinating Bean Deposits currently cannot be Transferred. A fix is being implemented. In the meantime, you can Transfer in 2 Seasons once your Bean Deposits are no longer Germinating. See Discord for details.',
              });
            } else {
              txToast.error(err);
            }
          } else {
            txToast.error(err);
          }
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
      token,
      sdk,
      season,
      plantAndDoX,
      txnBundler,
      refetch,
      refetchSilo,
      clear,
      transferrableDeposits,
    ]
  );

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit}>
      {(formikProps: FormikProps<TransferFormValues>) => (
        <TransferForm
          token={token}
          max={max}
          transferrableDeposits={transferrableDeposits}
          season={season}
          plantAndDoX={plantAndDoX.plantAction}
          {...formikProps}
        />
      )}
    </Formik>
  );
};

const Transfer: React.FC<{
  token: ERC20Token;
}> = (props) => (
  <FormTxnProvider>
    <TransferPropProvider {...props} />
  </FormTxnProvider>
);

export default Transfer;
