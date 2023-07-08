import React, { useCallback, useMemo } from 'react';
import { Box, Divider, Stack } from '@mui/material';
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
  // FarmFromMode,
  // StepGenerator,
} from '@beanstalk/sdk';
import { SEEDS, STALK } from '~/constants/tokens';
import {
  TxnPreview,
  TokenAdornment,
  TxnSeparator,
  SmartSubmitButton,
  FormStateNew,
  FormTxnsFormState,
  TokenInputField,
} from '~/components/Common/Form';
import useSeason from '~/hooks/beanstalk/useSeason';
import { displayFullBN, tokenValueToBN } from '~/util';
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
import useFarmerSiloBalancesAsync from '~/hooks/farmer/useFarmerSiloBalancesAsync';
import FormTxnProvider from '~/components/Common/Form/FormTxnProvider';
import useFormTxnContext from '~/hooks/sdk/useFormTxnContext';
import { FormTxn, PlantAndDoX, WithdrawFarmStep } from '~/lib/Txn';
import FarmModeField from '~/components/Common/Form/FarmModeField';
// import useToggle from '~/hooks/display/useToggle';
// import PillRow from '~/components/Common/Form/PillRow';
// import TokenIcon from '~/components/Common/TokenIcon';
// import TokenSelectDialogNew, {
//   TokenSelectMode,
// } from '~/components/Common/Form/TokenSelectDialogNew';
// import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';

// -----------------------------------------------------------------------

/// tokenValueToBN is too long
/// remove me when we migrate everything to TokenValue & DecimalBigNumber
const toBN = tokenValueToBN;

type ClaimQuoteHandlerParams = {
  toMode?: FarmToMode;
};

type WithdrawFormValues = FormStateNew &
  FormTxnsFormState & {
    settings: {
      destination: FarmToMode | undefined;
    };
    tokenOut: ERC20Token | undefined;
  };

// Type 'Element | undefined' is not assignable to type 'ReactElement<any, any> | null'.
// Type 'undefined' is not assignable to type 'ReactElement<any, any> | null'.
// @ts-ignore
const WithdrawForm: FC<
  FormikProps<WithdrawFormValues> & {
    token: Token;
    siloBalance: TokenSiloBalance | undefined;
    withdrawSeasons: BigNumber;
    season: BigNumber;
    sdk: BeanstalkSDK;
    plantAndDoX: PlantAndDoX;
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
  const { BEAN } = sdk.tokens;

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

  // Results
  const withdrawResult = useMemo(() => {
    const amount = BEAN.amount(values.tokens[0].amount?.toString() || '0');
    const crates = siloBalance?.deposits || [];

    if (!isUsingPlant && (amount.lte(0) || !crates.length)) return null;
    if (isUsingPlant && plantAndDoX.getAmount().lte(0)) return null;

    return WithdrawFarmStep.calculateWithdraw(
      sdk.silo.siloWithdraw,
      whitelistedToken,
      crates,
      amount,
      season.toNumber(),
      isUsingPlant ? plantAndDoX : undefined
    );
  }, [
    BEAN,
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
  const tokenOut = values.tokenOut || (whitelistedToken as ERC20Token);

  const isReady =
    withdrawResult &&
    !withdrawResult.amount.lt(0) &&
    values.settings.destination !== undefined;
  // && (whitelistedToken.isLP ? values.tokenOut !== undefined : true);

  const disabledActions = useMemo(
    () => (whitelistedToken.isUnripe ? [FormTxn.ENROOT] : undefined),
    [whitelistedToken.isUnripe]
  );

  //
  // const [isTokenSelectVisible, showTokenSelect, hideTokenSelect] = useToggle();
  // const pool = useMemo(
  //   () => sdk.pools.getPoolByLPToken(whitelistedToken),
  //   [sdk.pools, whitelistedToken]
  // );
  // const claimableTokens = useMemo(
  //   () => [
  //     whitelistedToken,
  //     ...((whitelistedToken.isLP && pool?.tokens) || []),
  //   ],
  //   [pool, whitelistedToken]
  // );

  //
  // const handleSelectTokens = useCallback(
  //   (_tokens: Set<Token>) => {
  //     const _token = Array.from(_tokens)[0];
  //     setFieldValue('tokenOut', _token);
  //   },
  //   [setFieldValue]
  // );

  // const handleQuote = useCallback<
  //   QuoteHandlerWithParams<QuoteHandlerWithParams>
  // >(
  //   async (_tokenIn, _amountIn, _tokenOut, { toMode }) => {
  //     if (_tokenIn === _tokenOut) return { amountOut: _amountIn };
  //     const amountIn = _tokenIn.amount(_amountIn.toString());

  //     const { curve } = sdk.contracts;

  //     // Require pooldata to be loaded first.
  //     if (!pool || !_tokenIn.isLP) return null;

  //     const work = sdk.farm.create();
  //     work.add(
  //       new sdk.farm.actions.RemoveLiquidityOneToken(
  //         pool.address,
  //         curve.registries.metaFactory.address,
  //         _tokenOut.address,
  //         FarmFromMode.INTERNAL,
  //         toMode
  //       )
  //     );
  //     const estimate = await work.estimate(amountIn);

  //     return {
  //       amountOut: tokenValueToBN(_tokenOut.fromBlockchain(estimate)),
  //       steps: work.generators as StepGenerator[],
  //     };
  //   },
  //   [sdk.contracts, sdk.farm, pool]
  // );

  // const claimableBalance = values.tokens[0].amount || ZERO_BN;

  // This should be memoized to prevent an infinite reset loop
  // const quoteHandlerParams = useMemo(
  //   () => ({
  //     quoteSettings: {
  //       ignoreSameToken: false,
  //       onReset: () => ({ amountOut: claimableBalance }),
  //     },
  //     params: {
  //       toMode: values.settings.destination || FarmToMode.INTERNAL,
  //     },
  //   }),
  //   [claimableBalance, values.settings.destination]
  // );

  if (!tokenOut) return;

  return (
    <Form autoComplete="off" noValidate>
      {/* Form Content */}
      <Stack gap={1}>
        {/* <TokenQuoteProviderWithParams<ClaimQuoteHandlerParams>
          name="tokens.0.amount"
          token={whitelistedToken}
          tokenOut={tokenOut}
          state={values.tokens[0]}
          //
          disabled={!depositedBalance || depositedBalance.eq(0)}
          balance={toBN(depositedBalance || TokenValue.ZERO) || ZERO_BN}
          balanceLabel="Deposited Balance"
          // -----
          // FIXME:
          // "disableTokenSelect" applies the disabled prop to
          // the TokenSelect button. However if we don't pass
          // a handler to the button then it's effectively disabled
          // but shows with stronger-colored text. param names are
          // a bit confusing.
          // disableTokenSelect={true}
          // handleQuote={handleQuote}
          displayQuote={false}
          {...quoteHandlerParams}
        /> */}
        {/* Input Field */}
        <TokenInputField
          name="tokens.0.amount"
          token={whitelistedToken}
          disabled={!depositedBalance || depositedBalance.eq(0)}
          balance={toBN(depositedBalance || TokenValue.ZERO) || ZERO_BN}
          balanceLabel="Deposited Balance"
          InputProps={InputProps}
        />
        {/** Setting: Destination  */}
        <FarmModeField name="settings.destination" />
        {/* Setting: Claim LP */}
        {/* <>
          {whitelistedToken.isLP ? (
            <PillRow
              isOpen={isTokenSelectVisible}
              label="Claim LP as"
              onClick={showTokenSelect}
            >
              {values.tokenOut && <TokenIcon token={values.tokenOut} />}
              <Typography variant="body1">
                {values.tokenOut ? values.tokenOut.symbol : <>Select Output</>}
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
        </> */}
        <AddPlantTxnToggle />
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
                    {
                      type: ActionType.UPDATE_SILO_REWARDS,
                      stalk: toBN(withdrawResult.stalk.mul(-1)),
                      seeds: toBN(withdrawResult.seeds.mul(-1)),
                    },
                    {
                      type: ActionType.IN_TRANSIT,
                      amount: toBN(withdrawResult.amount),
                      token: getNewToOldToken(whitelistedToken),
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
          disabled={!isReady || isSubmitting}
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
  // TEMPORARY. will be remove when sdk types are moved to redux
  siloBalance: ReturnType<typeof useFarmerSiloBalancesAsync>;
}> = ({ token, siloBalance }) => {
  const sdk = useSdk();
  const { txnBundler, plantAndDoX, refetch } = useFormTxnContext();
  const account = useAccount();

  /// Beanstalk
  const season = useSeason();
  const withdrawSeasons = useSelector<AppState, BigNumber>(
    (state) => state._beanstalk.silo.withdrawSeasons
  );

  /// Farmer
  const [farmerBalances, fetchFarmerBalances] = siloBalance;
  const [refetchSilo] = useFetchBeanstalkSilo();

  /// Form
  const middleware = useFormMiddleware();
  const initialValues: WithdrawFormValues = useMemo(
    () => ({
      tokens: [
        {
          token: token,
          amount: undefined,
        },
      ],
      farmActions: {
        preset: sdk.tokens.BEAN.equals(token) ? 'plant' : 'noPrimary',
        primary: undefined,
        secondary: undefined,
        implied: [FormTxn.MOW],
      },
      settings: {
        destination: undefined,
      },
      tokenOut: undefined,
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
        if (!farmerBalances?.deposits) {
          throw new Error('No balances found');
        }

        const formData = values.tokens[0];
        const primaryActions = values.farmActions.primary;
        const destination = values.settings.destination;

        const addPlant =
          primaryActions?.includes(FormTxn.PLANT) &&
          sdk.tokens.BEAN.equals(token);

        const baseAmount = token.amount((formData?.amount || 0).toString());

        const totalAmount = addPlant
          ? baseAmount.add(plantAndDoX.getAmount())
          : baseAmount;

        if (totalAmount.lte(0)) throw new Error('Invalid amount.');
        if (!destination) {
          throw new Error("Missing 'Destination' setting.");
        }

        const withdrawTxn = new WithdrawFarmStep(
          sdk,
          token,
          [...farmerBalances.deposits],
          destination
        );

        withdrawTxn.build(
          baseAmount,
          season.toNumber(),
          addPlant ? plantAndDoX : undefined
        );

        if (!withdrawTxn.withdrawResult) {
          throw new Error('Nothing to Withdraw.');
        }

        const withdrawAmtStr = displayFullBN(
          withdrawTxn.withdrawResult.amount.abs(),
          token.displayDecimals,
          token.displayDecimals
        );

        txToast = new TransactionToast({
          loading: `Withdrawing ${withdrawAmtStr} ${token.name} to your ${
            destination === FarmToMode.EXTERNAL ? 'wallet' : 'Farm balance'
          }...`,
          success: `Withdraw successful.`,
        });

        const actionsPerformed = txnBundler.setFarmSteps(values.farmActions);
        const { execute } = await txnBundler.bundle(
          withdrawTxn,
          // we can pass in 0 here b/c WithdrawFarmStep already receives it's input amount in build();
          token.amount(0),
          0.1
        );

        const txn = await execute();

        txToast.confirming(txn);
        const receipt = await txn.wait();

        await refetch(actionsPerformed, { farmerSilo: true }, [
          refetchSilo,
          fetchFarmerBalances,
        ]);

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
      middleware,
      account,
      farmerBalances?.deposits,
      sdk,
      token,
      plantAndDoX,
      season,
      txnBundler,
      refetch,
      refetchSilo,
      fetchFarmerBalances,
    ]
  );

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit}>
      {(formikProps) => (
        <WithdrawForm
          token={token}
          withdrawSeasons={withdrawSeasons}
          siloBalance={farmerBalances}
          season={season}
          sdk={sdk}
          plantAndDoX={plantAndDoX}
          {...formikProps}
        />
      )}
    </Formik>
  );
};

const Withdraw: React.FC<{
  token: ERC20Token;
  // TEMPORARY. will be remove when sdk types are moved to redux
  siloBalance: ReturnType<typeof useFarmerSiloBalancesAsync>;
}> = (props) => (
  <FormTxnProvider>
    <WithdrawPropProvider {...props} />
  </FormTxnProvider>
);

export default Withdraw;
