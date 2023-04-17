import React, { useCallback, useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import BigNumber from 'bignumber.js';
import { FarmToMode, Token, TokenValue } from '@beanstalk/sdk';
import {
  FormTxnsFormState,
  SmartSubmitButton,
  TokenInputField,
  TxnPreview,
  TxnSeparator,
} from '~/components/Common/Form';
import { ActionType } from '~/util/Actions';
import { displayFullBN } from '~/util';
import useFarmerField from '~/hooks/farmer/useFarmerField';
import copy from '~/constants/copy';
import FarmModeField from '~/components/Common/Form/FarmModeField';
import TransactionToast from '~/components/Common/TxnToast';
import { ZERO_BN } from '~/constants';
import TokenAdornment from '~/components/Common/Form/TokenAdornment';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import Row from '~/components/Common/Row';
import TokenIcon from '~/components/Common/TokenIcon';
import useSdk from '~/hooks/sdk';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import TxnAccordion from '~/components/Common/TxnAccordion';
import useAccount from '~/hooks/ledger/useAccount';
import useFarmerFormTxnsActions from '~/hooks/farmer/form-txn/useFarmerFormTxnActions';
import AdditionalTxnsAccordion from '~/components/Common/Form/FormTxn/AdditionalTxnsAccordion';
import FormTxnProvider from '~/components/Common/Form/FormTxnProvider';
import { FormTxn, HarvestFarmStep } from '~/lib/Txn';
import useFormTxnContext from '~/hooks/sdk/useFormTxnContext';

// -----------------------------------------------------------------------

type HarvestFormValues = {
  amount: BigNumber;
  destination: FarmToMode | undefined;
} & FormTxnsFormState;

type Props = FormikProps<HarvestFormValues> & {
  PODS: Token;
  harvestablePods: BigNumber;
};

const QuickHarvestForm: FC<Props> = ({
  // Custom
  harvestablePods,
  PODS,
  // Formike
  values,
  isSubmitting,
}) => {
  /// Derived
  const amount = harvestablePods;
  const isSubmittable =
    amount && amount.gt(0) && values.destination !== undefined;

  return (
    <Form autoComplete="off" noValidate>
      <Stack gap={1}>
        <Stack px={0.5} spacing={0.5}>
          <Row justifyContent="space-between">
            <Typography color="primary">Harvestable Pods</Typography>
            <Row gap={0.5}>
              <TokenIcon token={PODS} />
              <Typography variant="h3">{displayFullBN(amount, 0)}</Typography>
            </Row>
          </Row>
          <FarmModeField name="destination" />
        </Stack>
        <SmartSubmitButton
          loading={isSubmitting}
          disabled={!isSubmittable || isSubmitting}
          type="submit"
          variant="contained"
          color="primary"
          size="medium"
          tokens={[]}
          mode="auto"
        >
          Harvest
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

// -----------------------------------------------------------------------

const HarvestForm: FC<Props> = ({
  // Custom
  harvestablePods,
  PODS,
  // Formik
  values,
  isSubmitting,
}) => {
  const sdk = useSdk();
  const txnActions = useFarmerFormTxnsActions();

  /// Derived
  const amount = harvestablePods;
  const isSubmittable =
    amount && amount.gt(0) && values.destination !== undefined;

  return (
    <Form autoComplete="off" noValidate>
      <Stack gap={1}>
        {/* Claimable Token */}
        <TokenInputField
          name="amount"
          balance={amount}
          balanceLabel="Harvestable Balance"
          disabled
          InputProps={{
            endAdornment: <TokenAdornment token={PODS} />,
          }}
        />
        {values.amount?.gt(0) ? (
          <>
            {/* Setting: Destination */}
            <FarmModeField name="destination" />
            <TxnSeparator mt={-1} />
            <TokenOutput>
              <TokenOutput.Row
                token={sdk.tokens.BEAN}
                amount={values.amount || ZERO_BN}
              />
            </TokenOutput>
            {/* <Box>
              <Alert
                color="warning"
                icon={
                  <IconWrapper boxSize={IconSize.medium}><WarningAmberIcon
                    sx={{ fontSize: IconSize.small }} />
                  </IconWrapper>
                }
              >
                You can Harvest your Pods and Deposit Beans into the Silo in one transaction on the&nbsp;
                <Link href={`/#/silo/${bean.address}`}>Bean</Link> or <Link href={`/#/silo/${lp.address}`}>LP</Link> Deposit
                page.
              </Alert>
            </Box> */}
            <AdditionalTxnsAccordion />
            <Box>
              <TxnAccordion defaultExpanded={false}>
                <TxnPreview
                  actions={[
                    {
                      type: ActionType.HARVEST,
                      amount: amount,
                    },
                    {
                      type: ActionType.RECEIVE_BEANS,
                      amount: amount,
                      destination: values.destination,
                    },
                  ]}
                  {...txnActions}
                />
              </TxnAccordion>
            </Box>
          </>
        ) : null}
        <SmartSubmitButton
          loading={isSubmitting}
          disabled={!isSubmittable || isSubmitting}
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          tokens={[]}
          mode="auto"
        >
          Harvest
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

const HarvestPropProvider: FC<{ quick?: boolean }> = ({ quick = false }) => {
  const sdk = useSdk();
  const account = useAccount();

  const pods = sdk.tokens.PODS;

  /// Farmer
  const farmerField = useFarmerField();

  /// Form
  const middleware = useFormMiddleware();
  const { txnBundler, refetch } = useFormTxnContext();

  const initialValues: HarvestFormValues = useMemo(
    () => ({
      amount: farmerField.harvestablePods || null,
      destination: undefined,
      farmActions: {
        preset: 'noPrimary',
        primary: undefined,
        secondary: undefined,
        exclude: [FormTxn.HARVEST],
      },
    }),
    [farmerField.harvestablePods]
  );

  /// Handlers
  const onSubmit = useCallback(
    async (
      values: HarvestFormValues,
      formActions: FormikHelpers<HarvestFormValues>
    ) => {
      let txToast;
      try {
        middleware.before();

        if (!account) {
          throw new Error('Connect a wallet first.');
        }
        if (!farmerField.harvestablePods.gt(0)) {
          throw new Error('No Harvestable Pods.');
        }
        if (!farmerField.harvestablePlots) {
          throw new Error('No Harvestable Plots.');
        }
        if (!values.destination) {
          throw new Error('No destination set.');
        }

        txToast = new TransactionToast({
          loading: `Harvesting ${displayFullBN(
            farmerField.harvestablePods,
            pods.displayDecimals
          )} Pods.`,
          success: `Harvest successful. Added ${displayFullBN(
            farmerField.harvestablePods,
            pods.displayDecimals
          )} Beans to your ${copy.MODES[values.destination]}.`,
        });

        const _plotIds = Object.keys(farmerField.harvestablePlots);
        const plotIds = _plotIds.map((plotIndex) =>
          pods.amount(plotIndex).toBlockchain()
        );

        const harvestTxn = new HarvestFarmStep(sdk, plotIds);
        harvestTxn.build(values.destination);

        const actionsPerformed = txnBundler.setFarmSteps(values.farmActions);
        const { execute } = await txnBundler.bundle(
          harvestTxn,
          TokenValue.ZERO,
          0.1
        );

        const txn = await execute();
        txToast.confirming(txn);

        const receipt = await txn.wait();

        await refetch(actionsPerformed, {
          farmerField: true,
          farmerBalances: true,
        });

        txToast.success(receipt);
        formActions.resetForm();
      } catch (err) {
        if (txToast) {
          txToast.error(err);
        } else {
          const errorToast = new TransactionToast({});
          errorToast.error(err);
        }
      } finally {
        formActions.setSubmitting(false);
      }
    },
    [
      middleware,
      account,
      farmerField.harvestablePods,
      farmerField.harvestablePlots,
      pods,
      sdk,
      txnBundler,
      refetch,
    ]
  );

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit}>
      {(formikProps) => (
        <Stack spacing={1}>
          {quick ? (
            <QuickHarvestForm
              harvestablePods={farmerField.harvestablePods}
              PODS={pods}
              {...formikProps}
            />
          ) : (
            <HarvestForm
              harvestablePods={farmerField.harvestablePods}
              PODS={pods}
              {...formikProps}
            />
          )}
        </Stack>
      )}
    </Formik>
  );
};

const Harvest: React.FC<{ quick?: boolean }> = (props) => (
  <FormTxnProvider>
    <HarvestPropProvider {...props} />
  </FormTxnProvider>
);

export default Harvest;
