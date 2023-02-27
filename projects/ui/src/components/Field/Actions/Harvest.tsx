import React, { useCallback, useMemo } from 'react';
import {
  Accordion,
  AccordionDetails,
  Box,
  Stack,
  Typography,
} from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import BigNumber from 'bignumber.js';
import StyledAccordionSummary from '~/components/Common/Accordion/AccordionSummary';
import {
  ClaimAndPlantFormState,
  SmartSubmitButton,
  TokenInputField,
  TxnPreview,
  TxnSeparator,
} from '~/components/Common/Form';
import { ActionType } from '~/util/Actions';
import { FarmToMode } from '~/lib/Beanstalk/Farm';
import { displayFullBN } from '~/util';
import useFarmerField from '~/hooks/farmer/useFarmerField';
import { PODS } from '~/constants/tokens';
import copy from '~/constants/copy';
import FarmModeField from '~/components/Common/Form/FarmModeField';
import TransactionToast from '~/components/Common/TxnToast';
import { ZERO_BN } from '~/constants';
import TokenAdornment from '~/components/Common/Form/TokenAdornment';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import Row from '~/components/Common/Row';
import TokenIcon from '~/components/Common/TokenIcon';
import ClaimPlant, { ClaimPlantAction } from '~/util/ClaimPlant';
import useSdk from '~/hooks/sdk';
import useClaimAndPlantActions from '~/hooks/farmer/claim-plant/useFarmerClaimPlantActions';
import ClaimAndPlantAdditionalOptions from '~/components/Common/Form/ClaimAndPlantAdditionalOptions';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import useFarmerClaimAndPlantOptions from '~/hooks/farmer/claim-plant/useFarmerClaimPlantOptions';

// -----------------------------------------------------------------------

type HarvestFormValues = {
  amount: BigNumber;
  destination: FarmToMode | undefined;
} & ClaimAndPlantFormState;

type Props = FormikProps<HarvestFormValues> & {
  harvestablePods: BigNumber;
};

const QuickHarvestForm: FC<Props> = ({
  // Custom
  harvestablePods,
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
  // Formik
  values,
  isSubmitting,
}) => {
  const sdk = useSdk();
  const claimPlantOptions = useFarmerClaimAndPlantOptions();
  /// Derived
  const amount = harvestablePods;
  const isSubmittable =
    amount && amount.gt(0) && values.destination !== undefined;

    const claimPlantTxnActions = useMemo(() => {
      const { selected, additional } = values.farmActions;
      return claimPlantOptions.getTxnActions(
        selected,
        additional
      );
    }, [claimPlantOptions, values.farmActions]);

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
        {/* Transaction Details */}
        {values.amount?.gt(0) ? (
          <>
            {/* Setting: Destination */}
            <FarmModeField name="destination" />
            <TxnSeparator mt={-1} />
            {/* Token Outputs */}
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
            {/* Additional Txns */}
            <ClaimAndPlantAdditionalOptions />
            {/* Txn Summary */}
            <Box>
              <Accordion variant="outlined">
                <StyledAccordionSummary title="Transaction Details" />
                <AccordionDetails>
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
                    {...claimPlantTxnActions}
                  />
                </AccordionDetails>
              </Accordion>
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

const Harvest: FC<{ quick?: boolean }> = ({ quick }) => {
  ///
  const sdk = useSdk();
  const claimPlant = useClaimAndPlantActions();

  /// Farmer
  const farmerField = useFarmerField();

  /// Form
  const middleware = useFormMiddleware();
  const initialValues: HarvestFormValues = useMemo(
    () => ({
      amount: farmerField.harvestablePods || null,
      destination: undefined,
      farmActions: {
        options: ClaimPlant.presets.none,
        selected: undefined,
        additional: undefined,
        exclude: [ClaimPlantAction.HARVEST],
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
        const account = await sdk.getAccount();
        if (!account) throw new Error('Connect a wallet first.');
        if (!farmerField.harvestablePods.gt(0)) {
          throw new Error('No Harvestable Pods.');
        }
        if (!farmerField.harvestablePlots) {
          throw new Error('No Harvestable Plots.');
        }
        if (!values.destination) throw new Error('No destination set.');

        txToast = new TransactionToast({
          loading: `Harvesting ${displayFullBN(
            farmerField.harvestablePods,
            PODS.displayDecimals
          )} Pods.`,
          success: `Harvest successful. Added ${displayFullBN(
            farmerField.harvestablePods,
            PODS.displayDecimals
          )} Beans to your ${copy.MODES[values.destination]}.`,
        });

        const { workflow: harvest } = ClaimPlant.getAction(
          ClaimPlantAction.HARVEST
        )(sdk, {
          plotIds: Object.keys(farmerField.harvestablePlots).map(
            (harvestIdx) =>
              sdk.tokens.PODS.amount(harvestIdx.toString()).blockchainString
          ),
          toMode: values.destination,
        });

        const { execute, actionsPerformed } = await ClaimPlant.build(
          sdk,
          claimPlant.buildActions(values.farmActions.selected),
          claimPlant.buildActions(values.farmActions.additional),
          harvest,
          sdk.tokens.BEAN.amount(0), // no amount in
          { slippage: 0.1 }
        );

        const txn = await execute();
        txToast.confirming(txn);

        const receipt = await txn.wait();

        await claimPlant.refetch(actionsPerformed, {
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
        formActions.setSubmitting(false);
      }
    },
    [
      middleware,
      sdk,
      farmerField.harvestablePods,
      farmerField.harvestablePlots,
      claimPlant,
    ]
  );

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit}>
      {(formikProps) => (
        <Stack spacing={1}>
          {quick ? (
            <QuickHarvestForm
              harvestablePods={farmerField.harvestablePods}
              {...formikProps}
            />
          ) : (
            <HarvestForm
              harvestablePods={farmerField.harvestablePods}
              {...formikProps}
            />
          )}
        </Stack>
      )}
    </Formik>
  );
};

export default Harvest;
