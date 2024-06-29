import React, { useCallback, useMemo } from 'react';
import { Accordion, AccordionDetails, Box, Stack } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import BigNumber from 'bignumber.js';
import AddressInputField from '~/components/Common/Form/AddressInputField';
import FieldWrapper from '~/components/Common/Form/FieldWrapper';
import {
  SmartSubmitButton,
  TxnPreview,
  TxnSeparator,
} from '~/components/Common/Form';
import TransactionToast from '~/components/Common/TxnToast';
import useAccount from '~/hooks/ledger/useAccount';
import { ONE_BN } from '~/constants';
import { SPROUTS } from '~/constants/tokens';
import { MinBN } from '~/util';
import { ActionType } from '~/util/Actions';
import StyledAccordionSummary from '~/components/Common/Accordion/AccordionSummary';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import { FC } from '~/types';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import useSdk from '~/hooks/sdk';
import FertilizerSelectButton from '~/components/Common/Form/FertilizerSelectButton';
import { useSelector } from 'react-redux';
import { AppState } from '~/state';
import { useFetchFarmerBarn } from '~/state/farmer/barn/updater';
import { FertilizerBalance } from '~/state/farmer/barn';

export type TransferFormValues = {
  fertilizerIds: number[];
  amounts: number[];
  to: string | null;
  totalSelected: number;
};

export type FullFertilizerBalance = FertilizerBalance & {
  pctRepaid: BigNumber;
  status: string;
  humidity: BigNumber;
  debt: BigNumber;
  sprouts: BigNumber;
  rinsableSprouts: BigNumber;
};

const TransferForm: FC<FormikProps<TransferFormValues>> = ({
  values,
  isValid,
  isSubmitting,
}) => {
  const sdk = useSdk();

  /// Data
  const beanstalkBarn = useSelector<AppState, AppState['_beanstalk']['barn']>(
    (state) => state._beanstalk.barn
  );
  const farmerBarn = useSelector<AppState, AppState['_farmer']['barn']>(
    (state) => state._farmer.barn
  );

  /// Helpers
  const pctRepaid = useCallback(
    (balance: FertilizerBalance) =>
      MinBN(
        beanstalkBarn.currentBpf
          .minus(balance.token.startBpf)
          .div(balance.token.id.minus(balance.token.startBpf)),
        ONE_BN
      ),
    [beanstalkBarn.currentBpf]
  );

  /// Derived
  const isReady =
    values.fertilizerIds && values.to && values.amounts && isValid;
  const totalFertAmount = values.amounts.reduce(
    (total, current) => (current || 0) + total,
    0
  );

  const fertilizers = useMemo(() => {
    const output: FullFertilizerBalance[] = [];
    farmerBarn.balances.forEach((balance) => {
      const pct = pctRepaid(balance);
      const status = pct.eq(1) ? 'used' : 'active';
      const humidity = balance.token.humidity;
      const debt = balance.amount.multipliedBy(humidity.div(100).plus(1));
      const sprouts = debt.multipliedBy(ONE_BN.minus(pct));
      const rinsableSprouts = debt.multipliedBy(pct);

      const fullBalance = {
        ...balance,
        pctRepaid: pct,
        status: status,
        humidity: humidity,
        debt: debt,
        sprouts: sprouts,
        rinsableSprouts: rinsableSprouts,
      };

      output.push(fullBalance);
    });
    return output;
  }, [farmerBarn.balances, pctRepaid]);

  const sproutAmounts = [];
  for (let i = 0; i < fertilizers.length; i += 1) {
    const pctRatio = BigNumber(values.amounts[i] || 0).div(
      fertilizers[i].amount
    );
    const sprouts = fertilizers[i].sprouts.multipliedBy(pctRatio);
    sproutAmounts.push(sprouts);
  }
  const totalSprouts = sproutAmounts.reduce(
    (total: BigNumber, current: BigNumber) => total.plus(current),
    BigNumber(0)
  );

  return (
    <Form autoComplete="off">
      <Stack gap={1}>
        <FertilizerSelectButton fertilizers={fertilizers} />
        {fertilizers.length > 0 && (
          <FieldWrapper label="Transfer to">
            <AddressInputField name="to" />
          </FieldWrapper>
        )}
        {/* Txn info */}
        {values.to &&
          values.amounts.length > 0 &&
          values.fertilizerIds.length > 0 && (
            <>
              <TxnSeparator />
              <TokenOutput>
                <TokenOutput.Row
                  amount={totalSprouts.negated()}
                  token={sdk.tokens.SPROUTS}
                />
              </TokenOutput>
              <Box>
                <Accordion variant="outlined">
                  <StyledAccordionSummary title="Transaction Details" />
                  <AccordionDetails>
                    <TxnPreview
                      actions={
                        values.fertilizerIds !== undefined &&
                        values.fertilizerIds.length > 0 &&
                        values.to
                          ? [
                              {
                                type: ActionType.TRANSFER_FERTILIZER,
                                fertAmount: BigNumber(totalFertAmount),
                                sproutAmount: totalSprouts,
                                to: values.to,
                              },
                              {
                                type: ActionType.END_TOKEN,
                                token: SPROUTS,
                              },
                            ]
                          : []
                      }
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
  const sdk = useSdk();
  const fertilizer = sdk.contracts.fertilizer;

  /// Farmer
  const [refetchFarmerBarn] = useFetchFarmerBarn();

  /// Form setup
  const middleware = useFormMiddleware();
  const initialValues: TransferFormValues = useMemo(
    () => ({
      fertilizerIds: [],
      amounts: [],
      to: null,
      totalSelected: 0,
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

        const to = values.to;
        const fertilizers = [];
        const amounts = [];

        for (let i = 0; i < values.fertilizerIds.length; i += 1) {
          if (values.fertilizerIds[i]) {
            fertilizers.push(values.fertilizerIds[i]);
            amounts.push(values.amounts[i]);
          }
        }

        if (!account) throw new Error('Connect a wallet first.');
        if (!to || !fertilizers || !amounts || fertilizers.length === 0)
          throw new Error('Missing data.');

        txToast = new TransactionToast({
          loading: `Transferring Fertilizers...`,
          success: 'Fertilizer Transfer successful.',
        });

        let call;
        if (fertilizers.length === 1) {
          call = fertilizer.safeTransferFrom(
            account,
            to,
            fertilizers[0],
            amounts[0],
            '0x00'
          );
        } else {
          call = fertilizer.safeBatchTransferFrom(
            account,
            to,
            fertilizers,
            amounts,
            '0x00'
          );
        }

        const txn = await call;
        txToast.confirming(txn);
        const receipt = await txn.wait();

        await Promise.all([refetchFarmerBarn()]);

        txToast.success(receipt);
        formActions.resetForm();
        values.fertilizerIds = [];
        values.amounts = [];
        values.to = null;
      } catch (err) {
        if (txToast) {
          txToast.error(err);
        } else {
          const errorToast = new TransactionToast({});
          errorToast.error(err);
        }
      }
    },
    [account, middleware, fertilizer, refetchFarmerBarn]
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
