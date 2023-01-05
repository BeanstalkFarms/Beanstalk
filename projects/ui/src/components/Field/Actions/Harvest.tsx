import React, { useCallback, useMemo } from 'react';
import { Accordion, AccordionDetails, Box, Stack, Typography } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import BigNumber from 'bignumber.js';
import { useAccount as useWagmiAccount, useProvider } from 'wagmi';
import toast from 'react-hot-toast';
import StyledAccordionSummary from '~/components/Common/Accordion/AccordionSummary';
import {
  SmartSubmitButton, TokenInputField, TokenOutputField,
  TxnPreview,
  TxnSeparator
} from '~/components/Common/Form';
import { useSigner } from '~/hooks/ledger/useSigner';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import { ActionType } from '~/util/Actions';
import Farm, { FarmToMode } from '~/lib/Beanstalk/Farm';
import {
  displayFullBN,
  parseError,
  toStringBaseUnitBN
} from '~/util';
import useFarmerField from '~/hooks/farmer/useFarmerField';
import { useFetchFarmerField } from '~/state/farmer/field/updater';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import { BEAN, PODS } from '~/constants/tokens';
import copy from '~/constants/copy';
import FarmModeField from '~/components/Common/Form/FarmModeField';
import TransactionToast from '~/components/Common/TxnToast';
import { ZERO_BN } from '~/constants';
import TokenAdornment from '~/components/Common/Form/TokenAdornment';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import Row from '~/components/Common/Row';
import TokenIcon from '~/components/Common/TokenIcon';

// -----------------------------------------------------------------------

type HarvestFormValues = {
  amount: BigNumber;
  destination: FarmToMode | undefined;
}

type Props = FormikProps<HarvestFormValues> & {
  harvestablePods: BigNumber;
  farm: Farm;
}

const QuickHarvestForm: FC<Props> = ({
  // Custom
  harvestablePods,
  // Formike
  values,
  isSubmitting
}) => {
    /// Derived
    const amount = harvestablePods;
    const isSubmittable = (
      amount
      && amount.gt(0)
      && values.destination !== undefined
    );

    return (
      <Form autoComplete="off" noValidate>
        <Stack gap={1}>
          <Stack px={0.5} spacing={0.5}>
            <Row justifyContent="space-between">
              <Typography color="primary">
                Harvestable Pods
              </Typography>
              <Row gap={0.5}>
                <TokenIcon token={PODS} />
                <Typography variant="h3">
                  {displayFullBN(amount, 0)}
                </Typography>
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
  /// Derived
  const amount = harvestablePods;
  const isSubmittable = (
    amount
    && amount.gt(0)
    && values.destination !== undefined
  );

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
            endAdornment: (
              <TokenAdornment
                token={PODS}
              />
            )
          }}
        />
        {/* Transaction Details */}
        {values.amount?.gt(0) ? (
          <>
            {/* Setting: Destination */}
            <FarmModeField
              name="destination"
            />
            <TxnSeparator mt={-1} />
            <TokenOutputField
              token={BEAN[1]}
              amount={values.amount || ZERO_BN}
            />
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
            <Box>
              <Accordion variant="outlined">
                <StyledAccordionSummary title="Transaction Details" />
                <AccordionDetails>
                  <TxnPreview
                    actions={[
                      {
                        type: ActionType.HARVEST,
                        amount: amount
                      },
                      {
                        type: ActionType.RECEIVE_BEANS,
                        amount: amount,
                        destination: values.destination,
                      },
                    ]}
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
  const account = useWagmiAccount();
  const provider = useProvider();
  const { data: signer } = useSigner();
  const beanstalk = useBeanstalkContract(signer);

  /// Farm
  const farm = useMemo(() => new Farm(provider), [provider]);

  /// Farmer
  const farmerField = useFarmerField();
  const [refetchFarmerField] = useFetchFarmerField();
  const [refetchFarmerBalances] = useFetchFarmerBalances();

  /// Form
  const middleware = useFormMiddleware();
  const initialValues: HarvestFormValues = useMemo(() => ({
    amount: farmerField.harvestablePods || null,
    destination: undefined,
  }), [farmerField.harvestablePods]);

  /// Handlers
  const onSubmit = useCallback(
    async (
      values: HarvestFormValues,
      formActions: FormikHelpers<HarvestFormValues>
    ) => {
      let txToast;
      try {
        middleware.before();
        if (!farmerField.harvestablePods.gt(0)) throw new Error('No Harvestable Pods.');
        if (!farmerField.harvestablePlots) throw new Error('No Harvestable Plots.');
        if (!account?.address) throw new Error('Connect a wallet first.');
        if (!values.destination) throw new Error('No destination set.');

        txToast = new TransactionToast({
          loading: `Harvesting ${displayFullBN(farmerField.harvestablePods, PODS.displayDecimals)} Pods.`,
          success: `Harvest successful. Added ${displayFullBN(farmerField.harvestablePods, PODS.displayDecimals)} Beans to your ${copy.MODES[values.destination]}.`,
        });

        const txn = await beanstalk.harvest(
          Object.keys(farmerField.harvestablePlots).map((harvestIndex) =>
            toStringBaseUnitBN(harvestIndex, 6)
          ),
          values.destination
        );
        txToast.confirming(txn);

        const receipt = await txn.wait();
        await Promise.all([
          refetchFarmerField(),
          refetchFarmerBalances()
        ]);
        txToast.success(receipt);
        formActions.resetForm();
      } catch (err) {
        txToast ? txToast.error(err) : toast.error(parseError(err));
        formActions.setSubmitting(false);
      }
    },
    [
      account?.address,
      beanstalk,
      farmerField.harvestablePlots,
      farmerField.harvestablePods,
      refetchFarmerBalances,
      refetchFarmerField,
      middleware,
    ]
  );

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit}>
      {(formikProps) => (
        <Stack spacing={1}>
          {quick ? (
            <QuickHarvestForm 
              harvestablePods={farmerField.harvestablePods}
              farm={farm}
              {...formikProps}
            />
          ) : (
            <HarvestForm
              harvestablePods={farmerField.harvestablePods}
              farm={farm}
              {...formikProps}
          />
          )}
        </Stack>
      )}
    </Formik>
  );
};

export default Harvest;
