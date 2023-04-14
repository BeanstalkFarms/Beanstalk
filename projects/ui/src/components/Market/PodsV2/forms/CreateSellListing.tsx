/* eslint-disable */
import { InputAdornment, Box, Typography, Stack, Alert } from '@mui/material';
import BigNumber from 'bignumber.js';
import { FormikHelpers, Formik, FormikProps, Form } from 'formik';
import React, { useMemo } from 'react';
import { useSigner } from 'wagmi';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  PlotFragment,
  PlotSettingsFragment,
  SmartSubmitButton,
  TokenAdornment,
  TokenInputField,
  TxnPreview,
} from '~/components/Common/Form';
import FarmModeField from '~/components/Common/Form/FarmModeField';
import FieldWrapper from '~/components/Common/Form/FieldWrapper';
import PlotInputField from '~/components/Common/Form/PlotInputField';
import TxnAccordion from '~/components/Common/TxnAccordion';
import { ONE_BN, POD_MARKET_TOOLTIPS, ZERO_BN } from '~/constants';
import { BEAN, PODS } from '~/constants/tokens';
import useHarvestableIndex from '~/hooks/beanstalk/useHarvestableIndex';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
import useFarmerListingsLedger from '~/hooks/farmer/useFarmerListingsLedger';
import useFarmerPlots from '~/hooks/farmer/useFarmerPlots';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import { FarmToMode } from '~/lib/Beanstalk/Farm';
import { useFetchFarmerMarket } from '~/state/farmer/market/updater';
import { FC } from '~/types';
import {
  ActionType,
  displayBN,
  displayFullBN,
  displayTokenAmount,
  PlotMap,
  toStringBaseUnitBN,
} from '~/util';

export type CreateListingFormValues = {
  plot:        PlotFragment
  pricePerPod: BigNumber | null;
  expiresAt:   BigNumber | null;
  destination: FarmToMode | null;
  settings:    PlotSettingsFragment & {};
}

const initValues = {
  plot: {
    index: null,
    amount: null,
    start: null,
    end: null,
  },
  pricePerPod: null,
  expiresAt: null,
  destination: FarmToMode.INTERNAL,
  settings: {
    showRangeSelect: false,
  },
};

// const createSellListingAtom = atom<CreateListingFormValues>(initValues);

// const plotAtom = focusAtom(
//   createSellListingAtom,
//   (optic: OpticFor<CreateListingFormValues>) => optic.prop('plot')
// );
// const plotIndexAtom = focusAtom(plotAtom, (optic: OpticFor<PlotFragment>) =>
//   optic.prop('index')
// );
// const plotAmountAtom = focusAtom(plotAtom, (optic: OpticFor<PlotFragment>) =>
//   optic.prop('amount')
// );
// const plotStartAtom = focusAtom(plotAtom, (optic: OpticFor<PlotFragment>) =>
//   optic.prop('start')
// );
// const plotEndAtom = focusAtom(plotAtom, (optic: OpticFor<PlotFragment>) =>
//   optic.prop('end')
// );

const PricePerPodInputProps = {
  inputProps: { step: '0.01' },
  endAdornment: <TokenAdornment token={BEAN[1]} />,
};
const ExpiresAtInputProps = {
  endAdornment: (
    <InputAdornment position="end">
      <Box sx={{ pr: 1 }}>
        <Typography color="text.primary" sx={{ fontSize: '18px' }}>
          Place in Line
        </Typography>
      </Box>
    </InputAdornment>
  ),
};

const REQUIRED_KEYS = [
  'plotIndex',
  'start',
  'end',
  'pricePerPod',
  'expiresAt',
  'destination',
] as (keyof CreateListingFormValues)[];

const ListForm: FC<
  FormikProps<CreateListingFormValues> & {
    plots: PlotMap<BigNumber>;
    harvestableIndex: BigNumber;
  }
> = ({ values, isSubmitting, plots, harvestableIndex }) => {
  /// Form Data
  const plot = values.plot;

  /// Data
  const existingListings = useFarmerListingsLedger();

  /// Derived
  const placeInLine = useMemo(() => {
    const _placeInLine = plot.index
      ? new BigNumber(plot.index).minus(harvestableIndex)
      : ZERO_BN;
    return _placeInLine;
  }, [harvestableIndex, plot.index]);

  /// Calculations
  const alreadyListed = plot?.index
    ? existingListings[toStringBaseUnitBN(plot.index, BEAN[1].decimals)]
    : false;
  const isSubmittable = !REQUIRED_KEYS.some((k) => values[k] === null);

  return (
    <Form autoComplete="off" noValidate>
      <Stack gap={1}>
        <PlotInputField plots={plots} />
        {plot.index && (
          <>
            {alreadyListed ? (
              <Alert
                variant="standard"
                color="warning"
                icon={<WarningAmberIcon />}
              >
                This Plot is already listed on the Market. Creating a new
                Listing will override the previous one.
              </Alert>
            ) : null}
            <FieldWrapper
              label="Price per Pod"
              tooltip={POD_MARKET_TOOLTIPS.pricePerPodListing}
            >
              <TokenInputField
                name="pricePerPod"
                placeholder="0.0000"
                InputProps={PricePerPodInputProps}
                max={ONE_BN}
              />
            </FieldWrapper>
            <FieldWrapper
              label="Expires in"
              tooltip={POD_MARKET_TOOLTIPS.expiresAt}
            >
              <TokenInputField
                name="expiresAt"
                placeholder="0.0000"
                InputProps={ExpiresAtInputProps}
                max={placeInLine.plus(plot.start || ZERO_BN)}
              />
            </FieldWrapper>
            <FarmModeField
              name="destination"
              circDesc="When Pods are sold, send Beans to your wallet."
              farmDesc="When Pods are sold, send Beans to your internal Beanstalk balance."
              label="Send proceeds to"
            />
            {isSubmittable && (
              <Box>
                <TxnAccordion>
                  <TxnPreview
                    actions={[
                      {
                        type: ActionType.BASE,
                        message: `List ${displayTokenAmount(
                          plot.amount || ZERO_BN,
                          PODS
                        )} at ${displayFullBN(
                          values.pricePerPod || ZERO_BN
                        )} Beans per Pod from your Plot at ${displayBN(
                          placeInLine
                        )} in the Pod Line.`,
                      },
                      {
                        type: ActionType.BASE,
                        message: `If the Pod Line moves forward by ${displayFullBN(
                          values.expiresAt || ZERO_BN
                        )} more Pods, this Listing will automatically expire.`,
                      },
                      {
                        type: ActionType.BASE,
                        message: `Proceeds will be delivered to your ${
                          values.destination === FarmToMode.INTERNAL
                            ? 'Farm balance'
                            : 'Circulating balance'
                        }.`,
                      },
                    ]}
                  />
                </TxnAccordion>
              </Box>
            )}
          </>
        )}
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
          {alreadyListed ? 'Update Listing' : 'List'}
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

const CreateSellListing: React.FC<{}> = () => {
  /// Tokens
  const getChainToken = useGetChainToken();

  /// Ledger
  const { data: signer } = useSigner();
  const beanstalk = useBeanstalkContract(signer);

  /// Beanstalk
  const harvestableIndex = useHarvestableIndex();

  /// Farmer
  const plots = useFarmerPlots();
  const [refetchFarmerMarket] = useFetchFarmerMarket();

  /// Form
  const middleware = useFormMiddleware();
  const initialValues: CreateListingFormValues = useMemo(
    () => ({ ...initValues }),
    []
  );

  const onSubmit = async (
    values: CreateListingFormValues,
    formActions: FormikHelpers<CreateListingFormValues>
  ) => {};

  return (
    <Formik<CreateListingFormValues>
      initialValues={initialValues}
      onSubmit={onSubmit}
    >
      {(formikProps: FormikProps<CreateListingFormValues>) => (
        <ListForm
          plots={plots}
          harvestableIndex={harvestableIndex}
          {...formikProps}
        />
      )}
    </Formik>
  );
};

export default CreateSellListing;
