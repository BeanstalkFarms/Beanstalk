import React, { useCallback, useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import toast from 'react-hot-toast';
import {
  ClaimAndPlantFormState,
  SmartSubmitButton,
  TokenAdornment,
  TokenInputField,
  TokenOutputField,
  TxnSeparator
} from '~/components/Common/Form';
import TxnPreview from '~/components/Common/Form/TxnPreview';
import TxnAccordion from '~/components/Common/TxnAccordion';
import FarmModeField from '~/components/Common/Form/FarmModeField';
import TransactionToast from '~/components/Common/TxnToast';
import useFarmerFertilizer from '~/hooks/farmer/useFarmerFertilizer';
import { FarmToMode } from '~/lib/Beanstalk/Farm';
import { displayFullBN, parseError } from '~/util';
import { ZERO_BN } from '~/constants';
import { BEAN, SPROUTS } from '~/constants/tokens';
import { ActionType } from '~/util/Actions';
import copy from '~/constants/copy';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import Row from '~/components/Common/Row';
import TokenIcon from '~/components/Common/TokenIcon';
import ClaimPlant, { ClaimPlantAction, ClaimPlantActionMap } from '~/util/ClaimPlant';
import useSdk from '~/hooks/sdk';
import useClaimAndPlantActions from '~/hooks/beanstalk/useClaimAndPlantActions';
import ClaimAndPlantAdditionalOptions from '~/components/Common/Form/ClaimAndPlantAdditionalOptions';

// ---------------------------------------------------

type RinseFormValues = {
  destination: FarmToMode | undefined;
  amount: BigNumber;
} & ClaimAndPlantFormState;

// ---------------------------------------------------

const QuickRinseForm: FC<
  FormikProps<RinseFormValues>
> = ({
  values,
  isSubmitting
}) => {
  /// Extract
  const amountSprouts = values.amount;
  const isSubmittable = (
    amountSprouts?.gt(0)
    && values.destination !== undefined
  );

  return (
    <Form autoComplete="off" noValidate>
      <Stack gap={1}>
        <Stack sx={{ px: 0.5 }} spacing={0.5}>
          <Row justifyContent="space-between">
            <Typography color="primary">
              Rinsable Sprouts
            </Typography>
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

const RinseForm : FC<
  FormikProps<RinseFormValues> & {
    claimPlantActions: ClaimPlantActionMap;
  }
> = ({
  values,
  isSubmitting,
  claimPlantActions,
}) => {
  /// Extract
  const amountSprouts = values.amount;
  const isSubmittable = (
    amountSprouts?.gt(0)
    && values.destination !== undefined
  );

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
            endAdornment: (
              <TokenAdornment
                token={SPROUTS}
              />
            )
          }}
        />
        <FarmModeField
          name="destination"
        />
        {/* Outputs */}
        {amountSprouts?.gt(0) ? (
          <>
            <TxnSeparator />
            <TokenOutputField
              token={BEAN[1]}
              amount={amountSprouts}
            />
            <ClaimAndPlantAdditionalOptions 
              actions={claimPlantActions}
            />
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

const Rinse : FC<{ quick?: boolean }> = ({ quick }) => {
  /// Wallet connection
  const sdk = useSdk();
  const claimPlant = useClaimAndPlantActions();
  
  /// Farmer
  const farmerBarn          = useFarmerFertilizer();
  
  /// Form
  const middleware = useFormMiddleware();
  const initialValues : RinseFormValues = useMemo(() => ({
    destination: undefined,
    amount: farmerBarn.fertilizedSprouts,
    farmActions: {
      selected: [],
      options: [],
      additional: {
        selected: [],
        exclude: [ClaimPlantAction.RINSE]
      }
    }
  }), [farmerBarn.fertilizedSprouts]);

  /// Handlers
  const onSubmit = useCallback(async (values: RinseFormValues, formActions: FormikHelpers<RinseFormValues>) => {
    let txToast;
    try {
      middleware.before();
      const account = await sdk.getAccount(); 
      if (!account) throw new Error('Connect a wallet first.');
      if (!farmerBarn.fertilizedSprouts) throw new Error('No Sprouts to Rinse.');
      if (!values.destination) throw new Error('No destination set.');

      txToast = new TransactionToast({
        loading: `Rinsing ${displayFullBN(farmerBarn.fertilizedSprouts, SPROUTS.displayDecimals)} Sprouts...`,
        success: `Rinse successful. Added ${displayFullBN(farmerBarn.fertilizedSprouts, SPROUTS.displayDecimals)} Beans to your ${copy.MODES[values.destination]}.`,
      });

      const { workflow: rinse } = ClaimPlant.getAction(ClaimPlantAction.RINSE)(sdk, { 
        tokenIds: farmerBarn.balances.map((bal) => bal.token.id.toString()), 
        toMode: values.destination 
      });

      const { execute, actionsPerformed } = await ClaimPlant.build(
        sdk, 
        claimPlant.buildActions(values.farmActions.selected),
        claimPlant.buildActions(values.farmActions.additional.selected),
        rinse,
        sdk.tokens.BEAN.amount(0), // Rinse doesn't need any input so we can just use 0,
        { slippage: 0.1 }
      );

      const txn = await execute();
      txToast.confirming(txn);

      const receipt = await txn.wait();

      await claimPlant.refetch(actionsPerformed);

      txToast.success(receipt);
      formActions.resetForm({
        values: {
          destination: FarmToMode.INTERNAL,
          amount: ZERO_BN,
          farmActions: {
            selected: [],
            options: [],
            additional: {
              selected: [],
              exclude: [ClaimPlantAction.RINSE]
            }
          }
        }
      });
    } catch (err) {
      txToast ? txToast.error(err) : toast.error(parseError(err));
    }
  }, [middleware, sdk, farmerBarn.fertilizedSprouts, farmerBarn.balances, claimPlant]);

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit} enableReinitialize>
      {(formikProps) => 
        (quick 
          ? <QuickRinseForm {...formikProps} /> 
          : <RinseForm {...formikProps} claimPlantActions={claimPlant.actions} />
        )
      }
    </Formik>
  );
};

export default Rinse;
