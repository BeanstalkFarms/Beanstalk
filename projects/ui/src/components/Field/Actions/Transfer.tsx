import React, { useCallback, useMemo } from 'react';
import { Accordion, AccordionDetails, Box, Stack } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import BigNumber from 'bignumber.js';
import AddressInputField from '~/components/Common/Form/AddressInputField';
import FieldWrapper from '~/components/Common/Form/FieldWrapper';
import {
  PlotFragment,
  PlotSettingsFragment,
  SmartSubmitButton,
  TxnPreview,
  TxnSeparator,
} from '~/components/Common/Form';
import TransactionToast from '~/components/Common/TxnToast';
import PlotInputField from '~/components/Common/Form/PlotInputField';
import { useSigner } from '~/hooks/ledger/useSigner';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useAccount from '~/hooks/ledger/useAccount';
import useFarmerPlots from '~/hooks/farmer/useFarmerPlots';
import useHarvestableIndex from '~/hooks/beanstalk/useHarvestableIndex';
import { ZERO_BN } from '~/constants';
import { PODS } from '~/constants/tokens';
import { displayFullBN, toStringBaseUnitBN, trimAddress } from '~/util';
import { ActionType } from '~/util/Actions';
import StyledAccordionSummary from '~/components/Common/Accordion/AccordionSummary';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import { useFetchFarmerField } from '~/state/farmer/field/updater';

import { FC } from '~/types';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import useSdk from '~/hooks/sdk';

export type TransferFormValues = {
  plot: PlotFragment;
  to: string | null;
  settings: PlotSettingsFragment & {
    slippage: number; // 0.1%
  };
};

export interface SendFormProps {}

const TransferForm: FC<SendFormProps & FormikProps<TransferFormValues>> = ({
  values,
  isValid,
  isSubmitting,
}) => {
  const sdk = useSdk();
  /// Data
  const plots = useFarmerPlots();
  const harvestableIndex = useHarvestableIndex();

  /// Derived
  const plot = values.plot;
  const isReady =
    plot.index && values.to && plot.start && plot.amount?.gt(0) && isValid;

  return (
    <Form autoComplete="off">
      <Stack gap={1}>
        <PlotInputField plots={plots} />
        {plot.index && (
          <FieldWrapper label="Transfer to">
            <AddressInputField name="to" />
          </FieldWrapper>
        )}
        {/* Txn info */}
        {values.to && plot.amount && plot.start && plot.index && (
          <>
            <TxnSeparator />
            <TokenOutput>
              <TokenOutput.Row
                amount={plot.amount.negated()}
                token={sdk.tokens.PODS}
              />
            </TokenOutput>
            <Box>
              <Accordion variant="outlined">
                <StyledAccordionSummary title="Transaction Details" />
                <AccordionDetails>
                  <TxnPreview
                    actions={[
                      {
                        type: ActionType.TRANSFER_PODS,
                        amount: plot.amount || ZERO_BN,
                        address: values.to !== null ? values.to : '',
                        placeInLine: new BigNumber(plot.index)
                          .minus(harvestableIndex)
                          .plus(plot.start),
                      },
                      {
                        type: ActionType.END_TOKEN,
                        token: PODS,
                      },
                    ]}
                  />
                </AccordionDetails>
              </Accordion>
            </Box>
          </>
        )}
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
          Transfer
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

const Transfer: FC<{}> = () => {
  /// Ledger
  const account = useAccount();
  const { data: signer } = useSigner();
  const beanstalk = useBeanstalkContract(signer);

  /// Farmer
  const [refetchFarmerField] = useFetchFarmerField();

  /// Form setup
  const middleware = useFormMiddleware();
  const initialValues: TransferFormValues = useMemo(
    () => ({
      plot: {
        index: null,
        start: null,
        end: null,
        amount: null,
      },
      to: null,
      settings: {
        slippage: 0.1, // 0.1%
        showRangeSelect: false,
      },
    }),
    []
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

        if (!account) throw new Error('Connect a wallet first.');
        const {
          to,
          plot: { index, start, end, amount },
        } = values;
        if (!to || !index || !start || !end || !amount)
          throw new Error('Missing data.');

        const call = beanstalk.transferPlot(
          account,
          to.toString(),
          toStringBaseUnitBN(index, PODS.decimals),
          toStringBaseUnitBN(start, PODS.decimals),
          toStringBaseUnitBN(end, PODS.decimals)
        );

        txToast = new TransactionToast({
          loading: `Transferring ${displayFullBN(
            amount.abs(),
            PODS.decimals
          )} Pods to ${trimAddress(to, true)}...`,
          success: 'Plot Transfer successful.',
        });

        const txn = await call;
        txToast.confirming(txn);

        const receipt = await txn.wait();
        await Promise.all([refetchFarmerField()]);

        txToast.success(receipt);
        formActions.resetForm();
      } catch (err) {
        if (txToast) {
          txToast.error(err);
        } else {
          const errorToast = new TransactionToast({});
          errorToast.error(err);
        }
      }
    },
    [account, beanstalk, refetchFarmerField, middleware]
  );

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit}>
      {(formikProps: FormikProps<TransferFormValues>) => (
        <TransferForm {...formikProps} />
      )}
    </Formik>
  );
};

export default Transfer;
