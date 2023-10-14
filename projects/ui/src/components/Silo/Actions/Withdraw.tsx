import React, { useCallback, useMemo, useEffect } from 'react';
import { Box, Divider, Stack, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import { useSelector } from 'react-redux';
import {
  Token,
  ERC20Token,
  TokenSiloBalance,
  TokenValue,
  BeanstalkSDK,
  FarmToMode,
  FarmFromMode,
  StepGenerator,
} from '@beanstalk/sdk';
import { SEEDS, STALK } from '~/constants/tokens';
import {
  TxnPreview,
  TokenAdornment,
  TxnSeparator,
  SmartSubmitButton,
  FormStateNew,
  FormTxnsFormState,
  SettingInput,
  TxnSettings,
} from '~/components/Common/Form';
import useSeason from '~/hooks/beanstalk/useSeason';
import { displayFullBN, displayTokenAmount, tokenValueToBN } from '~/util';
import TransactionToast from '~/components/Common/TxnToast';
import { AppState } from '~/state';
import { ActionType } from '~/util/Actions';
import { ZERO_BN } from '~/constants';
import { useFetchBeanstalkSilo } from '~/state/beanstalk/silo/updater';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import useSdk, { getNewToOldToken } from '~/hooks/sdk';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import TxnAccordion from '~/components/Common/TxnAccordion';
import useAccount from '~/hooks/ledger/useAccount';
import AdditionalTxnsAccordion from '~/components/Common/Form/FormTxn/AdditionalTxnsAccordion';
import useFarmerFormTxnsActions from '~/hooks/farmer/form-txn/useFarmerFormTxnActions';
import AddPlantTxnToggle from '~/components/Common/Form/FormTxn/AddPlantTxnToggle';
import FormTxnProvider from '~/components/Common/Form/FormTxnProvider';
import useFormTxnContext from '~/hooks/sdk/useFormTxnContext';
import { FormTxn, PlantAndDoX, WithdrawFarmStep } from '~/lib/Txn';
import FarmModeField from '~/components/Common/Form/FarmModeField';
import useToggle from '~/hooks/display/useToggle';
import PillRow from '~/components/Common/Form/PillRow';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import TokenSelectDialogNew from '~/components/Common/Form/TokenSelectDialogNew';
import TokenIcon from '~/components/Common/TokenIcon';
import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';
import TokenQuoteProviderWithParams from '~/components/Common/Form/TokenQuoteProviderWithParams';
import copy from '~/constants/copy';
import useFarmerSiloBalanceSdk from '~/hooks/farmer/useFarmerSiloBalanceSdk';

// -----------------------------------------------------------------------

/// tokenValueToBN is too long
/// remove me when we migrate everything to TokenValue & DecimalBigNumber
const toBN = tokenValueToBN;

type WithdrawQuoteHandlerParams = {
  destination: FarmToMode | undefined;
};

type WithdrawFormValues = FormStateNew &
  FormTxnsFormState & {
    settings: {
      slippage: number;
    };
    destination: FarmToMode | undefined;
    tokenOut: ERC20Token | undefined;
  };

const WithdrawForm: FC<
  FormikProps<WithdrawFormValues> & {
    token: Token;
    siloBalance: TokenSiloBalance | undefined;
    withdrawSeasons: BigNumber;
    season: BigNumber;
    sdk: BeanstalkSDK;
    plantAndDoX: PlantAndDoX | undefined;
  }
> = ({
  // Formik
  values,
  isSubmitting,
  // Custom
  token: whitelistedToken,
  siloBalance,
  withdrawSeasons,
  season,
  sdk,
  plantAndDoX,
  setFieldValue,
}) => {
  const pool = useMemo(
    () => sdk.pools.getPoolByLPToken(whitelistedToken),
    [sdk.pools, whitelistedToken]
  );

  const claimableTokens = useMemo(
    // FIXME: Temporarily disabled Withdraws of Bean:ETH LP in Bean/WETH, needs routing code
    () => [
      whitelistedToken,
      ...(((whitelistedToken.isLP && whitelistedToken !== sdk.tokens.BEAN_ETH_WELL_LP) && pool?.tokens) || []),
    ],
    [pool, sdk.tokens, whitelistedToken]
  );

  const handleQuote = useCallback<
    QuoteHandlerWithParams<WithdrawQuoteHandlerParams>
  >(
    async (_tokenIn, _amountIn, _tokenOut, { destination }) => {
      const amountIn = _tokenIn.amount(_amountIn.toString());

      const { curve } = sdk.contracts;

      if (!pool || !_tokenIn.isLP || !_tokenOut)
        return {
          amountOut: ZERO_BN,
          steps: [],
        };
      const work = sdk.farm.create();
      work.add(
        new sdk.farm.actions.RemoveLiquidityOneToken(
          pool.address,
          curve.registries.metaFactory.address,
          _tokenOut.address,
          FarmFromMode.INTERNAL,
          destination || FarmToMode.INTERNAL
        )
      );
      const estimate = await work.estimate(amountIn);

      return {
        amountOut: tokenValueToBN(_tokenOut.fromBlockchain(estimate)),
        steps: work.generators as StepGenerator[],
      };
    },
    [pool, sdk.contracts, sdk.farm]
  );

  // Input props
  const InputProps = useMemo(
    () => ({
      endAdornment: <TokenAdornment token={whitelistedToken} />,
    }),
    [whitelistedToken]
  );

  // claim and plant
  const txActions = useFarmerFormTxnsActions();
  const isUsingPlant = Boolean(
    values.farmActions.primary?.includes(FormTxn.PLANT) &&
      sdk.tokens.BEAN.equals(whitelistedToken)
  );
  const { setDestination } = useFormTxnContext();
  useEffect(() => {
    if (values.destination) setDestination(values.destination)
  }, [values.destination, setDestination])

  const [isTokenSelectVisible, showTokenSelect, hideTokenSelect] = useToggle();

  const handleSelectTokens = useCallback(
    (_tokens: Set<Token>) => {
      const _token = Array.from(_tokens)[0];
      setFieldValue('tokenOut', _token);
    },
    [setFieldValue]
  );

  // Results
  const withdrawResult = useMemo(() => {
    const amount = sdk.tokens.BEAN.amount(
      values.tokens[0]?.amount?.toString() || '0'
    );
    const crates = siloBalance?.deposits || [];

    if (!isUsingPlant && (amount.lte(0) || !crates.length)) return null;
    if (isUsingPlant && plantAndDoX?.getAmount().lte(0)) return null;

    return WithdrawFarmStep.calculateWithdraw(
      sdk.silo.siloWithdraw,
      whitelistedToken,
      crates,
      amount,
      season.toNumber(),
      isUsingPlant ? plantAndDoX : undefined
    );
  }, [
    sdk.tokens.BEAN,
    isUsingPlant,
    plantAndDoX,
    sdk.silo.siloWithdraw,
    season,
    siloBalance?.deposits,
    values.tokens,
    whitelistedToken,
  ]);

  /// derived
  const depositedBalance = siloBalance?.amount;

  const isReady =
    withdrawResult && !withdrawResult.amount.lt(0) && values.destination;

  const isLPReady = whitelistedToken.isLP
    ? values.tokenOut !== undefined
    : true;

  const removingLiquidity =
    whitelistedToken.isLP &&
    values.tokenOut &&
    !whitelistedToken.equals(values.tokenOut);

  const disabledActions = useMemo(
    () => (whitelistedToken.isUnripe ? [FormTxn.ENROOT] : undefined),
    [whitelistedToken.isUnripe]
  );

  const quoteHandlerParams = useMemo(
    () => ({
      quoterSettings: {
        ignoreSameToken: true,
        onReset: () => ({ amountOut: ZERO_BN }),
      },
      params: {
        destination: values.destination || FarmToMode.INTERNAL,
      },
    }),
    [values.destination]
  );

  const amountOut = values.tokens[0]?.amountOut;

  return (
    <Form autoComplete="off" noValidate>
      {/* Form Content */}
      <Stack gap={1}>
        {/* Input Field */}
        <TokenQuoteProviderWithParams<WithdrawQuoteHandlerParams>
          name="tokens.0"
          token={whitelistedToken}
          state={values.tokens[0]}
          tokenOut={values.tokenOut || values.tokens[0].token}
          handleQuote={handleQuote}
          balance={toBN(depositedBalance || TokenValue.ZERO) || ZERO_BN}
          balanceLabel="Deposited Balance"
          InputProps={InputProps}
          {...quoteHandlerParams}
        />
        <Stack>
          {/** Setting: Destination  */}
          <FarmModeField name="destination" />
          {/** Token Out (If LP) */}
          <>
            {whitelistedToken.isLP ? (
              <PillRow
                isOpen={isTokenSelectVisible}
                label="Withdraw LP as"
                onClick={showTokenSelect}
              >
                {values.tokenOut && <TokenIcon token={values.tokenOut} />}
                <Typography variant="body1">
                  {values.tokenOut?.symbol || 'Select Output'}
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
        <AddPlantTxnToggle plantAndDoX={plantAndDoX} />
        {isReady ? (
          <Stack direction="column" gap={1}>
            <TxnSeparator />
            <TokenOutput>
              <TokenOutput.Row
                token={sdk.tokens.STALK}
                amount={withdrawResult.stalk.mul(-1)}
                amountTooltip={
                  <>
                    <div>
                      Withdrawing from {withdrawResult.crates.length} Deposit
                      {withdrawResult.crates.length === 1 ? '' : 's'}:
                    </div>
                    <Divider sx={{ opacity: 0.2, my: 1 }} />
                    {withdrawResult.crates.map((_crate, i) => (
                      // FIXME: same as convert
                      <div key={i}>
                        Season {_crate.stem.toString()}:{' '}
                        {displayFullBN(
                          _crate.bdv,
                          whitelistedToken.displayDecimals
                        )}{' '}
                        BDV,{' '}
                        {displayFullBN(
                          _crate.stalk.total,
                          STALK.displayDecimals
                        )}{' '}
                        STALK,{' '}
                        {displayFullBN(_crate.seeds, SEEDS.displayDecimals)}{' '}
                        SEEDS
                      </div>
                    ))}
                  </>
                }
              />
              <TokenOutput.Row
                token={sdk.tokens.SEEDS}
                amount={withdrawResult.seeds.mul(-1)}
              />
            </TokenOutput>
            <AdditionalTxnsAccordion filter={disabledActions} />
            <Box>
              <TxnAccordion>
                <TxnPreview
                  actions={[
                    {
                      type: ActionType.WITHDRAW,
                      amount: toBN(withdrawResult.amount),
                      token: getNewToOldToken(whitelistedToken),
                    },
                    removingLiquidity && amountOut && values.tokenOut
                      ? {
                          type: ActionType.SWAP,
                          amountIn: toBN(withdrawResult.amount),
                          tokenIn: getNewToOldToken(whitelistedToken),
                          amountOut: toBN(amountOut),
                          tokenOut: getNewToOldToken(values.tokenOut),
                        }
                      : undefined,
                    {
                      type: ActionType.UPDATE_SILO_REWARDS,
                      stalk: toBN(withdrawResult.stalk.mul(-1)),
                      seeds: toBN(withdrawResult.seeds.mul(-1)),
                    },
                    {
                      type: ActionType.IN_TRANSIT,
                      amount: toBN(withdrawResult.amount),
                      token: getNewToOldToken(whitelistedToken),
                      destination: values.destination || FarmToMode.EXTERNAL,
                      withdrawSeasons,
                    },
                  ]}
                  {...txActions}
                />
              </TxnAccordion>
            </Box>
          </Stack>
        ) : null}
        <SmartSubmitButton
          loading={isSubmitting}
          disabled={!isReady || !isLPReady || isSubmitting}
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          tokens={[]}
          mode="auto"
        >
          Withdraw
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

// -----------------------------------------------------------------------

const WithdrawPropProvider: FC<{
  token: ERC20Token;
}> = ({ token }) => {
  const sdk = useSdk();
  const { txnBundler, plantAndDoX, refetch } = useFormTxnContext();
  const account = useAccount();

  /// Beanstalk
  const season = useSeason();
  const withdrawSeasons = useSelector<AppState, BigNumber>(
    (state) => state._beanstalk.silo.withdrawSeasons
  );

  /// Farmer
  const [refetchSilo] = useFetchBeanstalkSilo();
  const siloBalance = useFarmerSiloBalanceSdk(token);

  /// Form
  const middleware = useFormMiddleware();
  const initialValues: WithdrawFormValues = useMemo(
    () => ({
      settings: {
        slippage: 0.1,
      },
      tokens: [
        {
          token: token,
          amount: undefined,
          amountOut: undefined,
          quoting: false,
        },
      ],
      destination: undefined,
      tokenOut: undefined,
      farmActions: {
        preset: sdk.tokens.BEAN.equals(token) ? 'plant' : 'noPrimary',
        primary: undefined,
        secondary: undefined,
        implied: [FormTxn.MOW],
      },
    }),
    [sdk.tokens.BEAN, token]
  );

  const onSubmit = useCallback(
    async (
      values: WithdrawFormValues,
      formActions: FormikHelpers<WithdrawFormValues>
    ) => {
      let txToast;
      try {
        middleware.before();
        if (!account) throw new Error('Missing signer');
        if (!siloBalance?.deposits) {
          throw new Error('No balances found');
        }

        const formData = values.tokens[0];
        const primaryActions = values.farmActions.primary;
        const destination = values.destination;
        const tokenIn = formData.token;
        const tokenOut = values.tokenOut;
        const amountOut =
          tokenOut && tokenOut.equals(tokenIn)
            ? formData.amount
            : formData.amountOut;

        const { plantAction } = plantAndDoX;

        const addPlant =
          plantAndDoX &&
          primaryActions?.includes(FormTxn.PLANT) &&
          sdk.tokens.BEAN.equals(tokenIn);

        const baseAmount = tokenIn.amount((formData?.amount || 0).toString());

        const totalAmount =
          addPlant && plantAction
            ? baseAmount.add(plantAction.getAmount())
            : baseAmount;

        if (totalAmount.lte(0)) throw new Error('Invalid amount.');
        if (!destination) {
          throw new Error("Missing 'Destination' setting.");
        }
        if (tokenIn.isLP && !tokenOut) {
          throw new Error('Missing Output Token');
        }

        const withdrawTxn = new WithdrawFarmStep(sdk, token, [
          ...siloBalance.deposits,
        ]);

        withdrawTxn.build(
          baseAmount,
          season.toNumber(),
          destination,
          tokenOut,
          addPlant ? plantAction : undefined
        );

        if (!withdrawTxn.withdrawResult) {
          throw new Error('Nothing to Withdraw.');
        }

        const withdrawAmtStr = displayFullBN(
          withdrawTxn.withdrawResult.amount.abs(),
          token.displayDecimals,
          token.displayDecimals
        );

        const messageAmount =
          values.tokenOut && amountOut
            ? displayTokenAmount(amountOut, values.tokenOut)
            : displayTokenAmount(totalAmount, token);

        txToast = new TransactionToast({
          loading: `Withdrawing ${withdrawAmtStr} ${token.name} from the Silo...`,
          success: `Withdraw successful. Added ${messageAmount} to your ${copy.MODES[destination]}`,
        });

        const actionsPerformed = txnBundler.setFarmSteps(values.farmActions);
        const { execute } = await txnBundler.bundle(
          withdrawTxn,
          totalAmount,
          values.settings.slippage
        );

        const txn = await execute();

        txToast.confirming(txn);
        const receipt = await txn.wait();

        await refetch(
          actionsPerformed,
          { farmerSilo: true, farmerBalances: true },
          [refetchSilo]
        );

        txToast.success(receipt);
        formActions.resetForm();
      } catch (err) {
        if (txToast) {
          txToast.error(err);
        } else {
          const toast = new TransactionToast({});
          toast.error(err);
        }
        formActions.setSubmitting(false);
      }
    },
    [
      sdk,
      token,
      season,
      account,
      middleware,
      txnBundler,
      plantAndDoX,
      siloBalance?.deposits,
      refetch,
      refetchSilo,
    ]
  );

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit}>
      {(formikProps) => (
        <>
          {token.isLP && (
            <TxnSettings placement="form-top-right">
              <SettingInput
                name="settings.slippage"
                label="Slippage Tolerance"
                endAdornment="%"
              />
            </TxnSettings>
          )}
          <WithdrawForm
            token={token}
            withdrawSeasons={withdrawSeasons}
            siloBalance={siloBalance}
            season={season}
            sdk={sdk}
            plantAndDoX={plantAndDoX.plantAction}
            {...formikProps}
          />
        </>
      )}
    </Formik>
  );
};

const Withdraw: React.FC<{
  token: ERC20Token;
}> = (props) => (
  <FormTxnProvider>
    <WithdrawPropProvider {...props} />
  </FormTxnProvider>
);

export default Withdraw;
