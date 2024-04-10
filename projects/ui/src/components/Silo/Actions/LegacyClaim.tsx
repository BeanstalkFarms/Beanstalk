import React, { useCallback, useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import BigNumber from 'bignumber.js';
import {
  BeanstalkSDK,
  ERC20Token,
  StepGenerator,
  Token,
  FarmFromMode,
  FarmToMode,
} from '@beanstalk/sdk';
import { ActionType } from '~/util/Actions';
import {
  TxnPreview,
  TxnSeparator,
  TxnSettings,
  SettingInput,
  SmartSubmitButton,
  FormTokenStateNew,
  FormTxnsFormState,
} from '~/components/Common/Form';

import { ZERO_BN } from '~/constants';
import { displayTokenAmount, tokenValueToBN } from '~/util';
import FarmModeField from '~/components/Common/Form/FarmModeField';
import TokenIcon from '~/components/Common/TokenIcon';
import useToggle from '~/hooks/display/useToggle';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import PillRow from '~/components/Common/Form/PillRow';
import TransactionToast from '~/components/Common/TxnToast';
import copy from '~/constants/copy';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import TokenQuoteProviderWithParams from '~/components/Common/Form/TokenQuoteProviderWithParams';
import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';
import TokenSelectDialogNew from '~/components/Common/Form/TokenSelectDialogNew';
import useSdk, { getNewToOldToken } from '~/hooks/sdk';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import TxnAccordion from '~/components/Common/TxnAccordion';
import useFarmerFormTxnsActions from '~/hooks/farmer/form-txn/useFarmerFormTxnActions';
import AdditionalTxnsAccordion from '~/components/Common/Form/FormTxn/AdditionalTxnsAccordion';
import FormTxnProvider from '~/components/Common/Form/FormTxnProvider';
import useFormTxnContext from '~/hooks/sdk/useFormTxnContext';
import { ClaimFarmStep, FormTxn } from '~/lib/Txn';

// -----------------------------------------------------------------------

type ClaimFormValues = {
  /**
   * When claiming, there is only one input token
   * (the claimable LP token). the amount of this
   * token is always the full claimable balance.
   *
   * In this case, token.amountOut is the amount received
   * for converting LP into `tokenOut`.
   */
  token: FormTokenStateNew;
  destination: FarmToMode | undefined;
  tokenOut: ERC20Token | undefined;
} & {
  settings: {
    slippage: number;
  };
} & FormTxnsFormState;

type ClaimQuoteHandlerParams = {
  toMode?: FarmToMode;
};

const ClaimForm: FC<
  FormikProps<ClaimFormValues> & {
    token: ERC20Token;
    claimableBalance: BigNumber;
    sdk: BeanstalkSDK;
  }
> = ({
  // Custom
  sdk,
  token,
  claimableBalance,
  // Formik
  values,
  isSubmitting,
  setFieldValue,
}) => {
  //
  const pool = useMemo(
    () => sdk.pools.getPoolByLPToken(token),
    [sdk.pools, token]
  );
  const claimableTokens = useMemo(
    () => [token, ...((token.isLP && pool?.tokens) || [])],
    [pool, token]
  );

  //
  const amount = claimableBalance;
  const isSubmittable =
    amount &&
    amount.gt(0) &&
    values.destination !== undefined &&
    (token.isLP ? values.tokenOut !== undefined : true);
  const tokenOut = values.tokenOut || (token as ERC20Token);

  //
  const handleQuote = useCallback<
    QuoteHandlerWithParams<ClaimQuoteHandlerParams>
  >(
    async (_tokenIn, _amountIn, _tokenOut, { toMode }) => {
      if (_tokenIn === _tokenOut) return { amountOut: _amountIn };
      const amountIn = _tokenIn.amount(_amountIn.toString());

      const { curve } = sdk.contracts;

      // Require pooldata to be loaded first.
      if (!pool || !_tokenIn.isLP) return null;

      const work = sdk.farm.create();
      work.add(
        new sdk.farm.actions.RemoveLiquidityOneToken(
          pool.address,
          curve.registries.metaFactory.address,
          _tokenOut.address,
          FarmFromMode.INTERNAL,
          toMode
        )
      );
      const estimate = await work.estimate(amountIn);

      return {
        amountOut: tokenValueToBN(_tokenOut.fromBlockchain(estimate)),
        steps: work.generators as StepGenerator[],
      };
    },
    [sdk.contracts, sdk.farm, pool]
  );

  // Selected FormTxn Actions
  const formTxnActions = useFarmerFormTxnsActions();

  //
  const [isTokenSelectVisible, showTokenSelect, hideTokenSelect] = useToggle();

  //
  const handleSelectTokens = useCallback(
    (_tokens: Set<Token>) => {
      const _token = Array.from(_tokens)[0];
      setFieldValue('tokenOut', _token);
    },
    [setFieldValue]
  );

  // This should be memoized to prevent an infinite reset loop
  const quoteHandlerParams = useMemo(
    () => ({
      quoteSettings: {
        ignoreSameToken: false,
        onReset: () => ({ amountOut: claimableBalance }),
      },
      params: {
        toMode: values.destination || FarmToMode.INTERNAL,
      },
    }),
    [claimableBalance, values.destination]
  );

  return (
    <Form autoComplete="off" noValidate>
      <Stack gap={1}>
        <TokenQuoteProviderWithParams<ClaimQuoteHandlerParams>
          name="token"
          tokenOut={tokenOut}
          state={values.token}
          // This input is always disabled but we use
          // the underlying handleQuote functionality
          // for consistency with other forms.
          disabled
          //
          balance={amount || ZERO_BN}
          balanceLabel="Claimable Balance"
          // -----
          // FIXME:
          // "disableTokenSelect" applies the disabled prop to
          // the TokenSelect button. However if we don't pass
          // a handler to the button then it's effectively disabled
          // but shows with stronger-colored text. param names are
          // a bit confusing.
          // disableTokenSelect={true}
          handleQuote={handleQuote}
          displayQuote={false}
          {...quoteHandlerParams}
        />
        <Stack gap={0}>
          {/* Setting: Destination */}
          <FarmModeField name="destination" />
          {/* Setting: Claim LP */}
          <>
            {token.isLP ? (
              <PillRow
                isOpen={isTokenSelectVisible}
                label="Claim LP as"
                onClick={showTokenSelect}
              >
                {values.tokenOut && <TokenIcon token={values.tokenOut} />}
                <Typography variant="body1">
                  {values.tokenOut ? (
                    values.tokenOut.symbol
                  ) : (
                    <>Select Output</>
                  )}
                </Typography>
              </PillRow>
            ) : null}
            <TokenSelectDialogNew
              open={isTokenSelectVisible}
              handleClose={hideTokenSelect}
              handleSubmit={handleSelectTokens}
              selected={values.tokenOut ? [values.tokenOut] : []}
              balances={undefined} // hide balances from right side of selector
              tokenList={claimableTokens as Token[]}
              mode={TokenSelectMode.SINGLE}
            />
          </>
        </Stack>
        {isSubmittable ? (
          <>
            <TxnSeparator />
            <TokenOutput>
              <TokenOutput.Row
                token={tokenOut}
                amount={values.token.amountOut || ZERO_BN}
              />
            </TokenOutput>
            <AdditionalTxnsAccordion />
            <Box>
              <TxnAccordion defaultExpanded={false}>
                <TxnPreview
                  actions={[
                    {
                      type: ActionType.CLAIM_WITHDRAWAL,
                      amount: amount,
                      token: getNewToOldToken(token),
                      // message: `Claim ${displayTokenAmount(amount, token)}.`
                    },
                    token.equals(sdk.tokens.BEAN_CRV3_LP) &&
                    values.tokenOut !== token
                      ? {
                          type: ActionType.BASE,
                          message: `Unpack ${displayTokenAmount(
                            amount,
                            token
                          )} into ${displayTokenAmount(
                            values.token.amountOut || ZERO_BN,
                            tokenOut
                          )}.`,
                        }
                      : undefined,
                    {
                      type: ActionType.RECEIVE_TOKEN,
                      token: getNewToOldToken(tokenOut),
                      amount: values.token.amountOut || ZERO_BN,
                      destination: values.destination,
                    },
                  ]}
                  {...formTxnActions}
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
          Claim
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

// -----------------------------------------------------------------------

export type LegacyWithdrawalSubgraph = { season: BigNumber; amount: BigNumber };

const ClaimPropProvider: FC<{
  token: ERC20Token;
  legacyWithdrawals: LegacyWithdrawalSubgraph[];
}> = ({ token, legacyWithdrawals }) => {
  const sdk = useSdk();

  /// Middleware
  const middleware = useFormMiddleware();
  const { txnBundler, refetch } = useFormTxnContext();

  /// Data
  const claimableBalance = useMemo(
    () =>
      legacyWithdrawals.reduce((acc, { amount }) => acc.plus(amount), ZERO_BN),
    [legacyWithdrawals]
  );
  const isBean = sdk.tokens.BEAN.equals(token);

  // Form
  const initialValues: ClaimFormValues = useMemo(
    () => ({
      // Input token values
      token: {
        token: token,
        amount: claimableBalance,
        amountOut: claimableBalance,
      },
      destination: undefined,
      tokenOut: undefined,
      settings: {
        slippage: 0.1,
      },
      farmActions: {
        preset: 'noPrimary',
        primary: undefined,
        secondary: undefined,
        exclude: isBean ? [FormTxn.CLAIM] : undefined,
      },
    }),
    [token, claimableBalance, isBean]
  );

  const onSubmit = useCallback(
    async (
      values: ClaimFormValues,
      formActions: FormikHelpers<ClaimFormValues>
    ) => {
      let txToast;
      try {
        middleware.before();
        const crates = legacyWithdrawals;
        const amountIn = values.token.token.fromHuman(
          values.token.amount?.toString() || '0'
        );

        if (!crates || crates.length === 0 || amountIn.lte(0)) {
          throw new Error('Nothing to claim');
        }
        if (!values.destination) {
          throw new Error('Select a balance to claim to');
        }

        const tokenIn = values.token.token as ERC20Token;
        const tokenOut = (values.tokenOut || tokenIn) as ERC20Token; // FIXME: `token` will always be set

        if (!tokenOut) throw new Error('Select an output token');

        const seasons = crates.map((crate) => crate.season.toString());

        const claimTxn = new ClaimFarmStep(sdk, tokenIn, seasons);
        claimTxn.build(tokenOut, values.destination);

        txToast = new TransactionToast({
          loading: `Claiming ${displayTokenAmount(
            claimableBalance,
            token
          )} from the Silo...`,
          success: `Claim successful. Added ${displayTokenAmount(
            values.token.amountOut || ZERO_BN,
            tokenOut
          )} to your ${copy.MODES[values.destination]}.`,
        });

        const actionsPerformed = txnBundler.setFarmSteps(values.farmActions);
        const { execute } = await txnBundler.bundle(claimTxn, amountIn, 0.1, 1.2);

        const txn = await execute();
        txToast.confirming(txn);
        const receipt = await txn.wait();

        await refetch(actionsPerformed, {
          farmerSilo: true,
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
      legacyWithdrawals,
      sdk,
      claimableBalance,
      token,
      txnBundler,
      refetch,
    ]
  );

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={onSubmit}
      enableReinitialize
    >
      {(formikProps) => (
        <>
          <TxnSettings placement="form-top-right">
            <SettingInput
              name="settings.slippage"
              label="Slippage Tolerance"
              endAdornment="%"
            />
          </TxnSettings>
          <Stack spacing={1}>
            <ClaimForm
              sdk={sdk}
              token={token}
              claimableBalance={claimableBalance}
              {...formikProps}
            />
          </Stack>
        </>
      )}
    </Formik>
  );
};

const LegacyClaim: FC<{
  token: ERC20Token;
  legacyWithdrawals: LegacyWithdrawalSubgraph[];
}> = (props) => (
  <FormTxnProvider>
    <ClaimPropProvider {...props} />
  </FormTxnProvider>
);

export default LegacyClaim;
