import React, { useCallback, useEffect, useMemo } from 'react';
import { Box, Divider, Grid, Stack, Typography } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import BigNumber from 'bignumber.js';
import {
  ERC20Token,
  Token,
  TokenSiloBalance,
  TokenValue,
} from '@beanstalk/sdk';
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
import useSdk, { getNewToOldToken } from '~/hooks/sdk';
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
import useFarmerSiloBalanceSdk from '~/hooks/farmer/useFarmerSiloBalanceSdk';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';

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
    siloBalance: TokenSiloBalance | undefined;
    season: BigNumber;
    plantAndDoX: PlantAndDoX | undefined;
  }
> = ({
  // Formik
  values,
  isSubmitting,
  // Custom
  token: whitelistedToken,
  siloBalance,
  season,
  plantAndDoX,
}) => {
  const sdk = useSdk();
  const [migrationNeeded, setMigrationNeeded] = React.useState(false);
  const { BEAN, STALK, SEEDS } = sdk.tokens;

  // Check address on change

  useEffect(() => {
    const check = async (address: string) => {
      try {
        const needed = await sdk.contracts.beanstalk.migrationNeeded(
          address.toLocaleLowerCase()
        );
        setMigrationNeeded(needed);
      } catch (err) {
        console.error(
          'Error while checking if address needs migration: ',
          address,
          err
        );
      }
    };

    if (values.to.length === 42) {
      check(values.to);
    } else {
      setMigrationNeeded(false);
    }
  }, [sdk.contracts.beanstalk, values.to]);

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
    const amount = BEAN.amount(values.tokens[0].amount?.toString() || '0');
    const deposits = siloBalance?.deposits || [];

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
    BEAN,
    isUsingPlant,
    plantAndDoX,
    sdk.silo.siloWithdraw,
    season,
    siloBalance?.deposits,
    values.tokens,
    whitelistedToken,
  ]);

  const disabledActions = useMemo(
    () => (whitelistedToken.isUnripe ? [FormTxn.ENROOT] : undefined),
    [whitelistedToken.isUnripe]
  );

  // derived
  const depositedBalance = siloBalance?.amount;
  const isReady = withdrawResult && !withdrawResult.amount.lt(0);

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
          disabled={!depositedBalance || depositedBalance.eq(0)}
          balance={toBN(depositedBalance || TokenValue.ZERO)}
          balanceLabel="Deposited Balance"
          InputProps={InputProps}
        />
        <AddPlantTxnToggle plantAndDoX={plantAndDoX} actionText="Transfer" />
        {depositedBalance?.gt(0) && (
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
                            token: getNewToOldToken(whitelistedToken),
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
        {migrationNeeded && (
          // <Box>
          //   <Typography variant="body1" color="error.main">
          //     Migration Needed
          //   </Typography>
          //   <Typography variant="body1" color="text.primary">
          //     Transfers can only be made to accounts that have migrated to Silo
          //     v3. The account you are trying to transfer to has not migrated
          //     yet.
          //   </Typography>
          // </Box>
          <Grid
            container
            spacing={0}
            direction="column"
            alignItems="center"
            sx={{ background: '#fdf4e7' }}
          >
            <Box component="section" sx={{ p: 2, minWidth: '400px' }}>
              <Typography variant="h3" align="center">
                Migration Required
              </Typography>
              <br />
              <Typography variant="body1" align="center">
                Transfers can only be made to accounts that have migrated to
                Silo v3. The account you are trying to transfer to has not
                migrated yet.
              </Typography>
              <br />
            </Box>
          </Grid>
        )}
        <SmartSubmitButton
          loading={isSubmitting}
          disabled={
            !isReady ||
            !depositedBalance ||
            depositedBalance.eq(0) ||
            isSubmitting ||
            values.to === '' ||
            migrationNeeded === true
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

const TransferPropProvider: FC<{
  token: ERC20Token;
}> = ({ token }) => {
  const sdk = useSdk();
  const account = useAccount();

  /// Beanstalk
  const season = useSeason();

  /// Farmer
  const [refetchSilo] = useFetchBeanstalkSilo();
  const siloBalance = useFarmerSiloBalanceSdk(token);

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

        if (!siloBalance?.deposits) {
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
          ...siloBalance.deposits,
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
      siloBalance?.deposits,
      token,
      sdk,
      season,
      plantAndDoX,
      txnBundler,
      refetch,
      refetchSilo,
    ]
  );

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit}>
      {(formikProps: FormikProps<TransferFormValues>) => (
        <TransferForm
          token={token}
          siloBalance={siloBalance}
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
