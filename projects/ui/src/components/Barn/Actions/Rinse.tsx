import React, { useCallback, useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import {
  FormTxnsFormState,
  SmartSubmitButton,
  TokenAdornment,
  TokenInputField,
  TxnSeparator,
} from '~/components/Common/Form';
import TxnPreview from '~/components/Common/Form/TxnPreview';
import TxnAccordion from '~/components/Common/TxnAccordion';
import FarmModeField from '~/components/Common/Form/FarmModeField';
import TransactionToast from '~/components/Common/TxnToast';
import useFarmerFertilizer from '~/hooks/farmer/useFarmerFertilizer';
import { FarmToMode } from '~/lib/Beanstalk/Farm';
import { displayFullBN } from '~/util';
import { ZERO_BN } from '~/constants';
import { ActionType } from '~/util/Actions';
import copy from '~/constants/copy';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import Row from '~/components/Common/Row';
import TokenIcon from '~/components/Common/TokenIcon';
import useSdk from '~/hooks/sdk';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import useFarmerFormTxnsActions from '~/hooks/farmer/form-txn/useFarmerFormTxnActions';
import { FormTxn, FormTxnBuilder } from '~/util/FormTxns';
import useFarmerFormTxns from '~/hooks/farmer/form-txn/useFarmerFormTxns';
import AdditionalTxnsAccordion from '~/components/Common/Form/FormTxn/AdditionalTxnsAccordion';

// ---------------------------------------------------

type RinseFormValues = {
  destination: FarmToMode | undefined;
  amount: BigNumber;
} & FormTxnsFormState;

// ---------------------------------------------------

const QuickRinseForm: FC<FormikProps<RinseFormValues>> = ({
  values,
  isSubmitting,
}) => {
  const SPROUTS = useSdk().tokens.SPROUTS;
  /// Extract
  const amountSprouts = values.amount;
  const isSubmittable =
    amountSprouts?.gt(0) && values.destination !== undefined;

  return (
    <Form autoComplete="off" noValidate>
      <Stack gap={1}>
        <Stack sx={{ px: 0.5 }} spacing={0.5}>
          <Row justifyContent="space-between">
            <Typography color="primary">Rinsable Sprouts</Typography>
            <Row gap={0.5}>
              <TokenIcon token={SPROUTS} />
              <Typography variant="h3">
                {displayFullBN(amountSprouts, 0)}
              </Typography>
            </Row>
          </Row>
          <FarmModeField name="destination" />
        </Stack>
        {/* Submit */}
        <SmartSubmitButton
          loading={isSubmitting}
          disabled={!isSubmittable}
          type="submit"
          variant="contained"
          color="primary"
          size="medium"
          tokens={[]}
          mode="auto"
        >
          Rinse
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

const RinseForm: FC<FormikProps<RinseFormValues>> = ({
  values,
  isSubmitting,
}) => {
  const sdk = useSdk();
  const { SPROUTS, BEAN } = sdk.tokens;

  /// Extract
  const amountSprouts = values.amount;
  const isSubmittable =
    amountSprouts?.gt(0) && values.destination !== undefined;

  const formTxnActions = useFarmerFormTxnsActions();

  /// Farm actions Txn actions
  return (
    <Form autoComplete="off" noValidate>
      <Stack gap={1}>
        {/* Inputs */}
        <TokenInputField
          token={SPROUTS}
          balanceLabel="Rinsable Balance"
          balance={amountSprouts || ZERO_BN}
          name="amount"
          disabled
          // MUI
          fullWidth
          InputProps={{
            endAdornment: <TokenAdornment token={SPROUTS} />,
          }}
        />
        <FarmModeField name="destination" />
        {amountSprouts?.gt(0) ? (
          <>
            <TxnSeparator />
            <TokenOutput>
              <TokenOutput.Row token={BEAN} amount={amountSprouts} />
            </TokenOutput>
            <AdditionalTxnsAccordion />
            <Box sx={{ width: '100%', mt: 0 }}>
              <TxnAccordion defaultExpanded={false}>
                <TxnPreview
                  actions={[
                    {
                      type: ActionType.RINSE,
                      amount: amountSprouts,
                    },
                    {
                      type: ActionType.RECEIVE_BEANS,
                      amount: amountSprouts,
                      destination: values.destination,
                    },
                  ]}
                  {...formTxnActions}
                />
              </TxnAccordion>
            </Box>
          </>
        ) : null}
        {/* Submit */}
        <SmartSubmitButton
          loading={isSubmitting}
          disabled={!isSubmittable}
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          tokens={[]}
          mode="auto"
        >
          Rinse
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

const Rinse: FC<{ quick?: boolean }> = ({ quick }) => {
  /// Wallet connection
  const sdk = useSdk();
  const farmerFormTxns = useFarmerFormTxns();

  /// Farmer
  const farmerBarn = useFarmerFertilizer();

  /// Form
  const middleware = useFormMiddleware();
  const initialValues: RinseFormValues = useMemo(
    () => ({
      destination: undefined,
      amount: farmerBarn.fertilizedSprouts,
      farmActions: {
        preset: 'noPrimary',
        primary: undefined,
        secondary: undefined,
        exclude: [FormTxn.RINSE],
      },
    }),
    [farmerBarn.fertilizedSprouts]
  );

  /// Handlers
  const onSubmit = useCallback(
    async (
      values: RinseFormValues,
      formActions: FormikHelpers<RinseFormValues>
    ) => {
      let txToast;
      try {
        const { SPROUTS } = sdk.tokens;
        middleware.before();
        const account = await sdk.getAccount();
        if (!account) throw new Error('Connect a wallet first.');
        if (!farmerBarn.fertilizedSprouts) {
          throw new Error('No Sprouts to Rinse.');
        }
        if (!values.destination) throw new Error('No destination set.');

        txToast = new TransactionToast({
          loading: `Rinsing ${displayFullBN(
            farmerBarn.fertilizedSprouts,
            SPROUTS.displayDecimals
          )} Sprouts...`,
          success: `Rinse successful. Added ${displayFullBN(
            farmerBarn.fertilizedSprouts,
            SPROUTS.displayDecimals
          )} Beans to your ${copy.MODES[values.destination]}.`,
        });

        const rinseFormTxnFunction = FormTxnBuilder.getFunction(FormTxn.RINSE);

        const rinseStep = rinseFormTxnFunction(sdk, {
          tokenIds: farmerBarn.balances.map((bal) => bal.token.id.toString()),
          toMode: values.destination,
        }).getSteps();

        const { execute, performed } = await FormTxnBuilder.compile(
          sdk,
          values.farmActions,
          farmerFormTxns.getGenerators,
          rinseStep,
          sdk.tokens.BEAN.amount(0), // Rinse doesn't need any input so we can just use 0,
          0.1
        );

        const txn = await execute();
        txToast.confirming(txn);

        const receipt = await txn.wait();

        await farmerFormTxns.refetch(performed);

        txToast.success(receipt);
        formActions.resetForm({
          values: {
            destination: FarmToMode.INTERNAL,
            amount: ZERO_BN,
            farmActions: {
              preset: 'noPrimary',
              primary: undefined,
              secondary: undefined,
              exclude: [FormTxn.RINSE],
            },
          },
        });
      } catch (err) {
        if (txToast) {
          txToast.error(err);
        } else {
          const errorToast = new TransactionToast({});
          errorToast.error(err);
        }
      }
    },
    [
      sdk,
      middleware,
      farmerBarn.fertilizedSprouts,
      farmerBarn.balances,
      farmerFormTxns,
    ]
  );

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={onSubmit}
      enableReinitialize
    >
      {(formikProps) => {
        if (quick) {
          return <QuickRinseForm {...formikProps} />;
        }
        return <RinseForm {...formikProps} />;
      }}
    </Formik>
  );
};

export default Rinse;
