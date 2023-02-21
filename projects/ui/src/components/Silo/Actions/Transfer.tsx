import { Accordion, AccordionDetails, Alert, Box, Divider, Stack } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import React, { useCallback, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import toast from 'react-hot-toast';
import { ERC20Token, Token } from '@beanstalk/sdk';
import FieldWrapper from '~/components/Common/Form/FieldWrapper';
import AddressInputField from '~/components/Common/Form/AddressInputField';
import {
  ClaimAndPlantFormState,
  FormStateNew,
  SmartSubmitButton,
  TokenAdornment,
  TokenInputField,
  TxnPreview
} from '~/components/Common/Form';
import { ZERO_BN } from '~/constants';
import { FarmerSilo } from '~/state/farmer/silo';
import useFarmerSiloBalances from '~/hooks/farmer/useFarmerSiloBalances';
import { useFetchFarmerSilo } from '~/state/farmer/silo/updater';
import { useFetchBeanstalkSilo } from '~/state/beanstalk/silo/updater';
import BeanstalkSDK from '~/lib/Beanstalk';
import useSeason from '~/hooks/beanstalk/useSeason';
import TxnSeparator from '~/components/Common/Form/TxnSeparator';
import { displayFullBN, displayTokenAmount, parseError, toStringBaseUnitBN, trimAddress } from '~/util';
import IconWrapper from '~/components/Common/IconWrapper';
import { FontSize, IconSize } from '~/components/App/muiTheme';
import StyledAccordionSummary from '~/components/Common/Accordion/AccordionSummary';
import { ActionType } from '~/util/Actions';
import TransactionToast from '~/components/Common/TxnToast';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import useFarmerClaimAndPlantActions, { ClaimPlantAction,  ClaimPlantActionMap } from '~/hooks/beanstalk/useClaimAndPlantActions';
import ClaimAndPlantFarmActions from '~/components/Common/Form/ClaimAndPlantFarmOptions';
import useSdk, { getNewToOldToken } from '~/hooks/sdk';
import ClaimAndPlantAdditionalOptions from '~/components/Common/Form/ClaimAndPlantAdditionalOptions';
import TxnOutputField, { TxnOutputFieldProps } from '~/components/Common/Form/TxnOutputField';

export type TransferFormValues = FormStateNew & 
  ClaimAndPlantFormState
& {
  to: string;
}

const TransferForm: FC<FormikProps<TransferFormValues> & {
  token: Token;
  siloBalances: FarmerSilo['balances'];
  depositedBalance: BigNumber;
  season: BigNumber;
  actionsMap: ClaimPlantActionMap;
}> = ({
  // Formik
  values,
  isSubmitting,
  submitForm,
  // Custom
  token: whitelistedToken,
  siloBalances,
  depositedBalance,
  season,
  actionsMap,
}) => {
  const sdk = useSdk();
  // Input props
  const InputProps = useMemo(() => ({
    endAdornment: (
      <TokenAdornment token={whitelistedToken} />
    )
  }), [whitelistedToken]);

  // Results
  const withdrawResult = BeanstalkSDK.Silo.Withdraw.withdraw(
    whitelistedToken,
    values.tokens,
    siloBalances[whitelistedToken.address]?.deposited.crates || [], // fallback
    season,
  );

  const isReady = (withdrawResult && withdrawResult.amount.lt(0));

  const txnOutputData: TxnOutputFieldProps['items'] | undefined = useMemo(() => {
    if (!isReady) return undefined;
    if (!withdrawResult.amount || !withdrawResult.seeds || !withdrawResult.stalk) return undefined;
    const { STALK, SEEDS } = sdk.tokens;
    return [
      {
        primary: {
          title: `Withdrawn ${whitelistedToken.symbol}`,
          amount: withdrawResult.amount || ZERO_BN,
          token: whitelistedToken,
        },
      },
      {
        primary: {
          title: 'STALK',
          amount: withdrawResult.stalk || ZERO_BN,
          token: STALK,
          amountTooltip: (
            <>
              <div>Withdrawing
                from {withdrawResult.deltaCrates.length} Deposit{withdrawResult.deltaCrates.length === 1 ? '' : 's'}:
              </div>
              <Divider sx={{ opacity: 0.2, my: 1 }} />
              {withdrawResult.deltaCrates.map((_crate, i) => (
                <div key={i}>
                  Season {_crate.season.toString()}: {displayFullBN(_crate.bdv, whitelistedToken.displayDecimals)} BDV, {displayFullBN(_crate.stalk, STALK.displayDecimals)} STALK, {displayFullBN(_crate.seeds, SEEDS.displayDecimals)} SEEDS
                </div>
                ))}
            </>
          )
        },
      },
      {
        primary: {
          title: 'SEEDS',
          amount: withdrawResult.seeds || ZERO_BN,
          token: SEEDS,
        }
      }
    ];
  }, [isReady, sdk.tokens, whitelistedToken, withdrawResult]);

  return (
    <Form autoComplete="off">
      {/* <pre>{JSON.stringify(values, null, 2)}</pre> */}
      <Stack gap={1}>
        <TokenInputField
          name="tokens.0.amount"
          token={whitelistedToken}
          disabled={!depositedBalance || depositedBalance.eq(0)}
          balance={depositedBalance || ZERO_BN}
          balanceLabel="Deposited Balance"
          InputProps={InputProps}
          belowComponent={
            <ClaimAndPlantFarmActions preset="plant" />
          }
        />
        {depositedBalance?.gt(0) && (
          <>
            <FieldWrapper label="Transfer to">
              <AddressInputField name="to" />
            </FieldWrapper>
            {values.to !== '' && withdrawResult?.amount.abs().gt(0) && (
              <>
                <TxnSeparator />
                {txnOutputData ? <TxnOutputField items={txnOutputData} /> : null}
                <Alert
                  color="warning"
                  icon={<IconWrapper boxSize={IconSize.medium}><WarningAmberIcon sx={{ fontSize: IconSize.small }} /></IconWrapper>}
                >
                  More recent Deposits are Transferred first.
                </Alert>
                <ClaimAndPlantAdditionalOptions
                  actions={actionsMap}
                />
                <Box>
                  <Accordion defaultExpanded variant="outlined">
                    <StyledAccordionSummary title="Transaction Details" />
                    <AccordionDetails>
                      <TxnPreview
                        actions={[
                          {
                            type: ActionType.TRANSFER,
                            amount: withdrawResult ? withdrawResult.amount.abs() : ZERO_BN,
                            // FIX ME
                            token: getNewToOldToken(whitelistedToken),
                            stalk: withdrawResult ? withdrawResult.stalk.abs() : ZERO_BN,
                            seeds: withdrawResult ? withdrawResult?.seeds.abs() : ZERO_BN,
                            to: values.to
                          },
                          {
                            type: ActionType.BASE,
                            message: (
                              <>
                                The following Deposits will be used:<br />
                                <ul css={{ paddingLeft: '25px', marginTop: '10px', marginBottom: 0, fontSize: FontSize.sm }}>
                                  {withdrawResult.deltaCrates.map((crate, index) => (
                                    <li key={index}>{displayTokenAmount(crate.amount, whitelistedToken)} from Deposits in Season {crate.season.toString()}</li>
                                  ))}
                                </ul>
                              </>
                            )
                          },
                          {
                            type: ActionType.END_TOKEN,
                            // FIX ME
                            token: getNewToOldToken(whitelistedToken)
                          }
                        ]}
                      />
                    </AccordionDetails>
                  </Accordion>
                </Box>
              </>
            )}
          </>
        )}
        <SmartSubmitButton
          loading={isSubmitting}
          disabled={!isReady || !depositedBalance || depositedBalance.eq(0) || isSubmitting || values.to === ''}
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          tokens={[]}
          mode="auto"
        >
          {!depositedBalance || depositedBalance.eq(0) ? 'Nothing to Transfer' : 'Transfer'}
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

const Transfer: FC<{ token: ERC20Token; }> = ({ token }) => {
  const sdk = useSdk();
  const claimPlant = useFarmerClaimAndPlantActions(sdk);

  /// Beanstalk
  const season = useSeason();

  /// Farmer
  const siloBalances = useFarmerSiloBalances();
  const [refetchFarmerSilo] = useFetchFarmerSilo();
  const [refetchSilo] = useFetchBeanstalkSilo();

  /// Form
  const middleware = useFormMiddleware();
  const depositedBalance = siloBalances[token.address]?.deposited.amount;
  const initialValues: TransferFormValues = useMemo(() => ({
    tokens: [
      {
        token: token,
        amount: undefined,
      },
    ],
    to: '',
    farmActions: {
      options: [
        ClaimPlantAction.PLANT,
      ],
      selected: [],
      additional: {
        selected: [],
        required: [ClaimPlantAction.MOW],
      }
    },
  }), [token]);

  /// Handlers
  const onSubmit = useCallback(async (values: TransferFormValues, formActions: FormikHelpers<TransferFormValues>) => {
    let txToast;
    try {
      middleware.before();
      const withdrawResult = BeanstalkSDK.Silo.Withdraw.withdraw(
        token,
        values.tokens,
        siloBalances[token.address]?.deposited.crates,
        season,
      );
      const account = await sdk.getAccount();
        
      if (!account) throw new Error('Missing signer');
      if (!withdrawResult) throw new Error('Nothing to Transfer.');
      if (!values.to) throw new Error('Please enter a valid recipient address.');

      const seasons = withdrawResult.deltaCrates.map((crate) => crate.season.toString());
      const amounts = withdrawResult.deltaCrates.map((crate) => toStringBaseUnitBN(crate.amount.abs(), token.decimals));

      console.debug('[silo/transfer] transferring: ', {
        withdrawResult,
        calldata: {
          seasons,
          amounts,
        },
      });
      
      const transfer = sdk.farm.create();

      if (seasons.length === 0) {
        throw new Error('Malformatted crates.');
      } else if (seasons.length === 1) {
        transfer.add(new sdk.farm.actions.TransferDeposit(
          account,
          values.to,
          token.address,
          seasons[0],
          amounts[0],
        ));
      } else {
        transfer.add(new sdk.farm.actions.TransferDeposits(
          account,
          values.to,
          token.address,
          seasons,
          amounts,
        ));
      }

      txToast = new TransactionToast({
        loading: `Transferring ${displayFullBN(withdrawResult.amount.abs(), token.displayDecimals, token.displayDecimals)} ${token.name} to ${trimAddress(values.to, true)}.`,
        success: 'Transfer successful.',
      });

      const { execute, actionsPerformed } = await claimPlant.buildWorkflow(
        sdk,
        claimPlant.buildActions(values.farmActions.selected),
        claimPlant.buildActions(values.farmActions.additional.selected),
        transfer,
        token.amount(0),
        { slippage: 0.1 }
      );

      const txn = await execute();
      txToast.confirming(txn);

      const receipt = await txn.wait();
      await claimPlant.refetch(actionsPerformed, { farmerSilo: refetchFarmerSilo }, [refetchSilo]);
  
      txToast.success(receipt);
      formActions.resetForm();
    } catch (err) {
      txToast ? txToast.error(err) : toast.error(parseError(err));
      formActions.setSubmitting(false);
    }
  }, [middleware, token, siloBalances, season, sdk, claimPlant, refetchFarmerSilo, refetchSilo]);

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={onSubmit}>
      {(formikProps: FormikProps<TransferFormValues>) => (
        <TransferForm
          token={token}
          siloBalances={siloBalances}
          depositedBalance={depositedBalance}
          season={season}
          actionsMap={claimPlant.actions}
          {...formikProps}
        />
      )}
    </Formik>
  );
};

export default Transfer;
