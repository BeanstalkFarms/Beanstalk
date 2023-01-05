import { Stack } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import React, { useCallback, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import PlotInputField from '~/components/Common/Form/PlotInputField';
import TransactionToast from '~/components/Common/TxnToast';
import {
  PlotFragment,
  PlotSettingsFragment, SmartSubmitButton,
  TokenOutputField,
  TxnSeparator
} from '~/components/Common/Form';
import FarmModeField from '~/components/Common/Form/FarmModeField';
import useFarmerPlots from '~/hooks/farmer/useFarmerPlots';
import useHarvestableIndex from '~/hooks/beanstalk/useHarvestableIndex';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useChainConstant from '~/hooks/chain/useChainConstant';
import { useSigner } from '~/hooks/ledger/useSigner';
import { parseError, PlotMap } from '~/util';
import { FarmToMode } from '~/lib/Beanstalk/Farm';
import { BEAN, PODS } from '~/constants/tokens';
import { ZERO_BN } from '~/constants';
import { useFetchFarmerField } from '~/state/farmer/field/updater';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import { PodOrder } from '~/state/farmer/market';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';

export type FillOrderFormValues = {
  plot: PlotFragment;
  destination: FarmToMode | undefined;
  settings: PlotSettingsFragment & {};
}

const FillOrderV2Form: FC<
  FormikProps<FillOrderFormValues>
  & {
    podOrder: PodOrder;
    plots: PlotMap<BigNumber>;
    harvestableIndex: BigNumber;
  }
> = ({
  values,
  isSubmitting,
  podOrder,
  plots: allPlots,  // rename to prevent collision
  harvestableIndex,
}) => {
  /// Derived
  const plot = values.plot;
  const [eligiblePlots, numEligiblePlots] = useMemo(() =>
    Object.keys(allPlots).reduce<[PlotMap<BigNumber>, number]>(
      (prev, curr) => {
        const indexBN = new BigNumber(curr);
        if (indexBN.minus(harvestableIndex).lt(podOrder.maxPlaceInLine)) {
          prev[0][curr] = allPlots[curr];
          prev[1] += 1;
        }
        return prev;
      },
      [{}, 0]
    ),
    [allPlots, harvestableIndex, podOrder.maxPlaceInLine]
  );

  // const placeInLine   = plot.index ? new BigNumber(plot.index).minus(harvestableIndex) : undefined;
  const beansReceived = plot.amount?.times(podOrder.pricePerPod) || ZERO_BN;
  const isReady = (
    numEligiblePlots > 0
    && plot.index
    && plot.amount?.gt(0)
    && values.destination
  );

  return (
    <Form autoComplete="off" noValidate>
      <Stack gap={1}>
        <PlotInputField
          plots={eligiblePlots}
          max={podOrder.podAmountRemaining}
          disabledAdvanced
          size="small"
        />
        <FarmModeField name="destination" />
        {isReady && (
          <>
            <TxnSeparator mt={0} />
            <TokenOutputField
              token={BEAN[1]}
              amount={beansReceived}
              isLoading={false}
              size="small"
            />
            {/* <Box>
              <Accordion variant="outlined">
                <StyledAccordionSummary title="Transaction Details" />
                <AccordionDetails>
                  <TxnPreview
                    actions={[
                      {
                        type: ActionType.SELL_PODS,
                        podAmount: plot.amount ? plot.amount : ZERO_BN,
                        placeInLine: placeInLine !== undefined ? placeInLine : ZERO_BN
                      },
                      {
                        type: ActionType.RECEIVE_BEANS,
                        amount: beansReceived,
                        destination: values.destination,
                      },
                    ]}
                  />
                </AccordionDetails>
              </Accordion>
            </Box> */}
          </>
        )}
        <SmartSubmitButton
          loading={isSubmitting}
          disabled={!isReady}
          type="submit"
          variant="contained"
          color="primary"
          tokens={[]}
          mode="auto"
        >
          {numEligiblePlots === 0 ? 'No eligible Plots' : 'Fill'}
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

const FillOrderForm: FC<{ podOrder: PodOrder }> = ({ podOrder }) => {
  /// Tokens
  const Bean = useChainConstant(BEAN);

  /// Ledger
  const { data: signer } = useSigner();
  const beanstalk = useBeanstalkContract(signer);

  /// Beanstalk
  const harvestableIndex = useHarvestableIndex();

  /// Farmer
  const allPlots = useFarmerPlots();
  const [refetchFarmerField]    = useFetchFarmerField();
  const [refetchFarmerBalances] = useFetchFarmerBalances();

  /// Form
  const middleware = useFormMiddleware();
  const initialValues: FillOrderFormValues = useMemo(() => ({
    plot: {
      index:  null,
      start:  ZERO_BN,
      end:    null,
      amount: null,
    },
    destination: undefined,
    settings: {
      showRangeSelect: false,
    }
  }), []);

  /// Navigation
  const navigate = useNavigate();

  /// Handlers
  const onSubmit = useCallback(async (values: FillOrderFormValues, formActions: FormikHelpers<FillOrderFormValues>) => {
    let txToast;
    try {
      middleware.before();
      const { index, start, amount } = values.plot;
      if (!index) throw new Error('No plot selected');
      const numPods = allPlots[index];
      if (!numPods) throw new Error('Plot not recognized.');
      if (!start || !amount) throw new Error('Malformatted plot data.');
      if (!values.destination) throw new Error('No destination selected.');
      if (amount.lt(new BigNumber(1))) throw new Error('Amount not greater than minFillAmount.');

      console.debug('[FillOrder]', {
        numPods: numPods.toString(),
        index: index.toString(),
        start: start.toString(),
        amount: amount.toString(),
        sum: start.plus(amount).toString(),
        params: [
          {
            account:        podOrder.account,
            maxPlaceInLine: Bean.stringify(podOrder.maxPlaceInLine),
            pricePerPod:    Bean.stringify(podOrder.pricePerPod),
            minFillAmount:  PODS.stringify(podOrder.minFillAmount || 0), // minFillAmount for Orders is measured in Pods
          },
          Bean.stringify(index),
          Bean.stringify(start),
          Bean.stringify(amount),
          values.destination,
        ]
      });

      txToast = new TransactionToast({
        loading: 'Filling Order...',
        // loading: `Selling ${displayTokenAmount(amount, PODS)} for ${displayTokenAmount(amount.multipliedBy(podOrder.pricePerPod), Bean)}.`,
        success: 'Fill successful.'
      });

      const txn = await beanstalk.fillPodOrder(
        {
          account:        podOrder.account,
          maxPlaceInLine: Bean.stringify(podOrder.maxPlaceInLine),
          pricePerPod:    Bean.stringify(podOrder.pricePerPod),
          minFillAmount:  PODS.stringify(podOrder.minFillAmount || 0), // minFillAmount for Orders is measured in Pods
        },
        Bean.stringify(index),    // index of plot to sell
        Bean.stringify(start),    // start index within plot
        Bean.stringify(amount),   // amount of pods to sell
        values.destination,
      );
      txToast.confirming(txn);

      const receipt = await txn.wait();
      await Promise.all([
        refetchFarmerField(),     // refresh plots; decrement pods
        refetchFarmerBalances(),  // increment balance of BEAN received
        // FIXME: refresh orders
      ]);
      txToast.success(receipt);
      formActions.resetForm();

      // Return to market index, open Your Orders
      navigate('/market/sell');
    } catch (err) {
      txToast?.error(err) || toast.error(parseError(err));
    } finally {
      formActions.setSubmitting(false);
    }
  }, [middleware, allPlots, podOrder.account, podOrder.maxPlaceInLine, podOrder.pricePerPod, podOrder.minFillAmount, Bean, beanstalk, refetchFarmerField, refetchFarmerBalances, navigate]);

  return (
    <Formik<FillOrderFormValues>
      initialValues={initialValues}
      onSubmit={onSubmit}
    >
      {(formikProps: FormikProps<FillOrderFormValues>) => (
        <FillOrderV2Form
          podOrder={podOrder}
          plots={allPlots}
          harvestableIndex={harvestableIndex}
          {...formikProps}
        />
      )}
    </Formik>
  );
};

export default FillOrderForm;
