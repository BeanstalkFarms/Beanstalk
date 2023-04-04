import React, { useCallback, useMemo, useRef } from 'react';
import { Box, Divider, Link, Stack, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Formik, FormikHelpers, FormikProps } from 'formik';
import {
  Token,
  ERC20Token,
  NativeToken,
  StepGenerator,
  FarmWorkflow,
  TokenValue,
} from '@beanstalk/sdk';
import { useSelector } from 'react-redux';

import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import {
  BalanceFromFragment,
  FormStateNew,
  FormTokenStateNew,
  FormTxnsFormState,
} from '~/components/Common/Form';
import TxnPreview from '~/components/Common/Form/TxnPreview';
import TxnAccordion from '~/components/Common/TxnAccordion';
import { BUY_FERTILIZER } from '~/components/Barn/FertilizerItemTooltips';
import SmartSubmitButton from '~/components/Common/Form/SmartSubmitButton';
import TransactionToast from '~/components/Common/TxnToast';
import { IconSize } from '~/components/App/muiTheme';
import TokenIcon from '~/components/Common/TokenIcon';
import useToggle from '~/hooks/display/useToggle';
import useFertilizerSummary from '~/hooks/farmer/useFertilizerSummary';
import useTokenMap from '~/hooks/chain/useTokenMap';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import usePreferredToken, {
  PreferredToken,
} from '~/hooks/farmer/usePreferredToken';
import { FarmFromMode, FarmToMode } from '~/lib/Beanstalk/Farm';
import { displayFullBN, tokenValueToBN } from '~/util';
import { useFetchFarmerAllowances } from '~/state/farmer/allowances/updater';
import { FarmerBalances } from '~/state/farmer/balances';
import FertilizerItem from '../FertilizerItem';
import useAccount from '~/hooks/ledger/useAccount';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import { FC } from '~/types';
import TokenQuoteProviderWithParams from '~/components/Common/Form/TokenQuoteProviderWithParams';
import TokenSelectDialogNew from '~/components/Common/Form/TokenSelectDialogNew';
import useSdk, { getNewToOldToken } from '~/hooks/sdk';
import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';
import {
  BalanceFrom,
  balanceFromToMode,
} from '~/components/Common/Form/BalanceFromRow';
import WarningAlert from '~/components/Common/Alert/WarningAlert';
import useFarmerFormTxnsActions from '~/hooks/farmer/form-txn/useFarmerFormTxnActions';
import AdditionalTxnsAccordion from '~/components/Common/Form/FormTxn/AdditionalTxnsAccordion';
import { FormTxn, FormTxnBuilder } from '~/util/FormTxns';
import useFarmerFormTxns from '~/hooks/farmer/form-txn/useFarmerFormTxns';
import { AppState } from '~/state';
import ClaimBeanDrawerToggle from '~/components/Common/Form/FormTxn/ClaimBeanDrawerToggle';
import FormWithDrawer from '~/components/Common/Form/FormWithDrawer';
import ClaimBeanDrawerContent from '~/components/Common/Form/FormTxn/ClaimBeanDrawerContent';

// ---------------------------------------------------

type BuyFormValues = FormStateNew &
  BalanceFromFragment &
  FormTxnsFormState & {
    settings: {
      slippage: number;
    };
  } & {
    claimableBeans: FormTokenStateNew;
  };

type BuyQuoteHandlerParams = {
  fromMode: FarmFromMode;
};

const defaultFarmActionsFormState = {
  preset: 'claim',
  primary: undefined,
  secondary: undefined,
};

// ---------------------------------------------------

const BuyForm: FC<
  FormikProps<BuyFormValues> & {
    handleQuote: QuoteHandlerWithParams<BuyQuoteHandlerParams>;
    balances: FarmerBalances;
    tokenOut: ERC20Token;
    tokenList: (ERC20Token | NativeToken)[];
    remainingFertilizer: BigNumber;
  }
> = ({
  // Formik
  values,
  setFieldValue,
  isSubmitting,
  // Custom
  handleQuote,
  tokenList,
  balances,
  tokenOut: token,
}) => {
  const sdk = useSdk();
  const formRef = useRef<HTMLDivElement>(null);

  const tokenMap = useTokenMap<ERC20Token | NativeToken>(tokenList);

  const combinedTokenState = [...values.tokens, values.claimableBeans];

  const { usdc, fert, humidity, actions } =
    useFertilizerSummary(combinedTokenState);

  // Extract
  const isValid = fert?.gt(0);

  const formTokenInputState = values.tokens[0];
  const tokenIn = formTokenInputState.token;

  const isTokenInEth = tokenIn.equals(sdk.tokens.ETH);
  const balanceKey = isTokenInEth ? 'eth' : tokenIn.address;
  const tokenBalance = balances[balanceKey] || undefined;

  const formTxnsActions = useFarmerFormTxnsActions({
    showGraphicOnClaim: sdk.tokens.BEAN.equals(tokenIn),
    claimBeansState: values.claimableBeans,
  });

  // Handlers
  const [showTokenSelect, handleOpen, handleClose] = useToggle();

  const handleSelectTokens = useCallback(
    (_tokens: Set<Token>) => {
      setFieldValue(
        'tokens',
        Array.from(_tokens).map((t) => ({ token: t, amount: null }))
      );
      setFieldValue('farmActions', defaultFarmActionsFormState);
      setFieldValue('claimableBeans', { token: sdk.tokens.BEAN, amount: null });
    },
    [sdk.tokens.BEAN, setFieldValue]
  );

  const handleSetBalanceFrom = (balanceFrom: BalanceFrom) => {
    setFieldValue('balanceFrom', balanceFrom);
  };

  // Memoized to prevent infinite re-rendering loop
  const quoteProviderParams = useMemo(() => {
    const _params = {
      fromMode: balanceFromToMode(values.balanceFrom),
    };
    return _params;
  }, [values.balanceFrom]);

  const disabledActions = useMemo(() => {
    const isEth = tokenIn.equals(sdk.tokens.ETH);
    return isEth ? [FormTxn.ENROOT] : undefined;
  }, [tokenIn, sdk.tokens.ETH]);

  return (
    <FormWithDrawer autoComplete="off" noValidate siblingRef={formRef}>
      <Stack gap={1} ref={formRef}>
        {showTokenSelect && (
          <TokenSelectDialogNew
            open={showTokenSelect}
            handleClose={handleClose}
            selected={[values.tokens[0]]}
            handleSubmit={handleSelectTokens}
            balances={balances}
            tokenList={Object.values(tokenMap)}
            mode={TokenSelectMode.SINGLE}
            balanceFrom={values.balanceFrom}
            setBalanceFrom={handleSetBalanceFrom}
          />
        )}
        {/* Form Contents */}
        <TokenQuoteProviderWithParams<BuyQuoteHandlerParams>
          name="tokens.0"
          state={formTokenInputState}
          tokenOut={token}
          balance={tokenBalance}
          showTokenSelect={handleOpen}
          handleQuote={handleQuote}
          balanceFrom={values.balanceFrom}
          params={quoteProviderParams}
        />
        <ClaimBeanDrawerToggle />
        {/* Outputs */}
        {fert?.gt(0) ? (
          <>
            <Stack
              direction="column"
              gap={1}
              alignItems="center"
              justifyContent="center"
            >
              <KeyboardArrowDownIcon color="secondary" />
              <Box sx={{ width: 150, pb: 1 }}>
                <FertilizerItem
                  isNew
                  amount={fert}
                  sprouts={fert.multipliedBy(humidity.plus(1))}
                  humidity={humidity}
                  state="active"
                  tooltip={BUY_FERTILIZER}
                />
              </Box>
              <WarningAlert>
                The amount of Fertilizer received rounds down to the nearest
                USDC. {usdc?.toFixed(2)} USDC = {fert?.toFixed(0)} FERT.
              </WarningAlert>
              <Box width="100%">
                <AdditionalTxnsAccordion filter={disabledActions} />
              </Box>
              <Box sx={{ width: '100%', mt: 0 }}>
                <TxnAccordion defaultExpanded={false}>
                  <TxnPreview actions={actions} {...formTxnsActions} />
                  <Divider sx={{ my: 2, opacity: 0.4 }} />
                  <Box sx={{ pb: 1 }}>
                    <Typography variant="body2">
                      Sprouts become <strong>Rinsable</strong> on a{' '}
                      <Link
                        href="https://docs.bean.money/almanac/protocol/glossary#pari-passu"
                        target="_blank"
                        rel="noreferrer"
                        underline="hover"
                      >
                        pari passu
                      </Link>{' '}
                      basis. Upon <strong>Rinse</strong>, each Sprout is
                      redeemed for{' '}
                      <span>
                        <TokenIcon
                          token={sdk.tokens.BEAN}
                          css={{ height: IconSize.xs, marginTop: 2.6 }}
                        />
                      </span>
                      1.
                    </Typography>
                  </Box>
                </TxnAccordion>
              </Box>
            </Stack>
          </>
        ) : null}
        {/* Submit */}
        <SmartSubmitButton
          mode="auto"
          // Button props
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          loading={isSubmitting}
          disabled={!isValid}
          // Smart props
          contract={sdk.contracts.beanstalk}
          tokens={values.tokens}
        >
          Buy
        </SmartSubmitButton>
      </Stack>
      <FormWithDrawer.Drawer title="Use Claimable Assets">
        <ClaimBeanDrawerContent<BuyQuoteHandlerParams>
          quoteProviderProps={{
            tokenOut: token,
            name: 'claimableBeans',
            state: values.claimableBeans,
            params: quoteProviderParams,
            handleQuote: handleQuote,
          }}
        />
      </FormWithDrawer.Drawer>
    </FormWithDrawer>
  );
};

const Buy: FC<{}> = () => {
  const sdk = useSdk();

  const { remaining } = useSelector<AppState, AppState['_beanstalk']['barn']>(
    (state) => state._beanstalk.barn
  );

  /// Farmer
  const account = useAccount();
  const balances = useFarmerBalances();
  const farmerFormTxns = useFarmerFormTxns();
  const [refetchAllowances] = useFetchFarmerAllowances();

  /// Form
  const middleware = useFormMiddleware();

  const { preferredTokens, tokenList } = useMemo(() => {
    const tokens = sdk.tokens;

    const _preferredTokens: PreferredToken[] = [
      { token: tokens.BEAN, minimum: new BigNumber(1) },
      { token: tokens.USDC, minimum: new BigNumber(1) },
      { token: tokens.ETH, minimum: new BigNumber(0.01) },
    ];

    const _tokenList = _preferredTokens.map(
      (data) => data.token as ERC20Token | NativeToken
    );

    return {
      preferredTokens: _preferredTokens,
      tokenList: _tokenList,
    };
  }, [sdk.tokens]);
  const baseToken = usePreferredToken(preferredTokens, 'use-best');
  const tokenOut = sdk.tokens.USDC;

  const initialValues: BuyFormValues = useMemo(
    () => ({
      tokens: [
        {
          token: baseToken as ERC20Token | NativeToken,
          amount: undefined,
        },
      ],
      balanceFrom: BalanceFrom.TOTAL,
      farmActions: {
        preset: 'claim',
        primary: undefined,
        secondary: undefined,
      },
      claimableBeans: {
        /// claimable BEAN
        token: sdk.tokens.BEAN,
        amount: undefined,
      },
      settings: {
        slippage: 0.1,
      },
    }),
    [baseToken, sdk.tokens.BEAN]
  );

  /// Handlers
  // Doesn't get called if tokenIn === tokenOut
  // aka if the user has selected USDC as input
  const handleQuote = useCallback<
    QuoteHandlerWithParams<BuyQuoteHandlerParams>
  >(
    async (tokenIn, _amountIn, _tokenOut, { fromMode: _fromMode }) => {
      if (!account) {
        throw new Error('No account connected');
      }

      const inTokenList = Boolean(
        tokenList.find((tk) => tokenIn.address === tk.address)
      );
      if (!inTokenList) {
        throw new Error(
          `Buying fertilizer with ${tokenIn.symbol} is not supported.`
        );
      }

      const amountIn = tokenIn.fromHuman(_amountIn.toString());

      const swap = sdk.swap.buildSwap(
        tokenIn,
        _tokenOut,
        account,
        _fromMode,
        FarmToMode.INTERNAL
      );

      const estimate = await swap.estimate(amountIn);

      return {
        amountOut: tokenValueToBN(estimate),
        steps: swap.getFarm().generators as StepGenerator[],
      };
    },
    [account, sdk.swap, tokenList]
  );

  const onSubmit = useCallback(
    async (
      values: BuyFormValues,
      formActions: FormikHelpers<BuyFormValues>
    ) => {
      let txToast;
      try {
        middleware.before();
        const { USDC, BEAN, ETH } = sdk.tokens;

        const { beanstalk, curve, fertilizer } = sdk.contracts;
        if (!sdk.contracts.beanstalk) {
          throw new Error('Unable to access contracts');
        }
        if (!account) {
          throw new Error('Signer Required.');
        }

        const formData = values.tokens[0];
        const farmActions = values.farmActions;
        const claimData = values.claimableBeans;
        const tokenIn = formData.token; // input token
        const amountIn = formData.amount; // input amount in form
        const slippage = values.settings.slippage;
        const amountUsdc = (
          USDC.equals(tokenIn) ? amountIn : formData.amountOut
        )?.dp(0, BigNumber.ROUND_DOWN);
        if (!amountIn || !amountUsdc) throw new Error('An error occured');
        if (!slippage || slippage < 0) {
          throw new Error('Invalid slippage amount');
        }

        const additionalAmount = BEAN.amount(
          claimData.amount?.toString() || '0'
        );
        const totalClaimAmount = BEAN.amount(
          claimData.maxAmountIn?.toString() || '0'
        );
        const transferDestination =
          farmActions.transferToMode || FarmToMode.INTERNAL;

        const beanIn = BEAN.equals(tokenIn);
        const ethIn = tokenIn.equals(ETH);
        const usdcIn = USDC.equals(tokenIn);

        const getBean2usdc = (from: FarmFromMode) =>
          new sdk.farm.actions.ExchangeUnderlying(
            curve.pools.beanCrv3.address,
            BEAN,
            USDC,
            from,
            FarmToMode.INTERNAL
          );

        const buyFert = sdk.farm.create();
        let fromMode = balanceFromToMode(values.balanceFrom);

        if (!beanIn && !ethIn && !usdcIn) {
          throw new Error(
            `Buying fertilizer with ${tokenIn.symbol} is not supported.`
          );
        }

        // If the user is NOT using claimable BEAN to buy fertilizer, we use the steps from the quote
        if (additionalAmount.lte(0)) {
          if (beanIn || ethIn) {
            if (!formData.steps) {
              throw new Error('No quote available');
            }
            buyFert.add([...formData.steps]);
            fromMode = FarmFromMode.INTERNAL_TOLERANT;
          }
        } else if (beanIn || ethIn) {
          /**
           * 1. We swap from ETH -> BEAN
           * 2. we add the additional BEAN amount to the output of ETH -> BEAN
           * 3. swap from BEAN -> USDC
           */
          if (ethIn) {
            const swap = sdk.swap.buildSwap(
              ETH,
              BEAN,
              account,
              fromMode,
              FarmToMode.INTERNAL
            );
            buyFert.add(swap.getFarm());
            fromMode = FarmFromMode.INTERNAL_TOLERANT;
          }
          buyFert.add(
            FormTxnBuilder.getLocalOnlyStep('add-additional-bean', {
              additionalAmount,
            }),
            { onlyLocal: true }
          );
          buyFert.add(getBean2usdc(fromMode));
        } else if (USDC.equals(tokenIn)) {
          /**
           * 1. Inject the additional BEAN amount, overriding the workflow input amount
           * 2. Swap from BEAN -> USDC
           * 3. Inject the updated USDC amount into workflow
           */
          buyFert.add(
            FormTxnBuilder.getLocalOnlyStep('add-additional-bean', {
              overrideAmount: additionalAmount,
            }),
            { onlyLocal: true }
          );
          buyFert.add(getBean2usdc(FarmFromMode.INTERNAL_TOLERANT));
          buyFert.add(
            FormTxnBuilder.getLocalOnlyStep('add-original-USDC-amount', {
              additionalAmount: USDC.amount(amountIn.toString()),
            }),
            { onlyLocal: true }
          );
          fromMode = FarmFromMode.INTERNAL_EXTERNAL;
        }

        const initialAmountIn = tokenIn.amount(amountIn.toString());
        const estimatedUSDC = await buyFert.estimate(initialAmountIn);

        const roundedUSDCOut = tokenValueToBN(
          USDC.fromBlockchain(estimatedUSDC)
        ).dp(0, BigNumber.ROUND_DOWN);

        txToast = new TransactionToast({
          loading: `Buying ${displayFullBN(
            roundedUSDCOut,
            USDC.displayDecimals
          )} Fertilizer...`,
          success: 'Purchase successful.',
        });

        const minLP = await curve.zap.callStatic.calc_token_amount(
          curve.pools.beanCrv3.address,
          [
            // 0.866616 is the ratio to add USDC/Bean at such that post-exploit
            // delta B in the Bean:3Crv pool with A=1 equals the pre-export
            // total delta B times the haircut. Independent of the haircut %.
            USDC.fromHuman(roundedUSDCOut.times(0.866616).toString())
              .blockchainString, // BEAN
            0, // DAI
            USDC.fromHuman(roundedUSDCOut.toString()).blockchainString, // USDC
            0, // USDT
          ],
          true, // _is_deposit
          { gasLimit: 10000000 }
        );

        buyFert.add(async (_amountInStep) => ({
          name: 'mintFertilizer',
          amountOut: _amountInStep,
          prepare: () => ({
            target: beanstalk.address,
            callData: beanstalk.interface.encodeFunctionData('mintFertilizer', [
              TokenValue.fromHuman(roundedUSDCOut.toString(), 0)
                .blockchainString,
              FarmWorkflow.slip(minLP, 0.1),
              fromMode,
            ]),
          }),
          decode: (data: string) =>
            beanstalk.interface.decodeFunctionData('mintFertilizer', data),
          decodeResult: (result: string) =>
            beanstalk.interface.decodeFunctionResult('mintFertilizer', result),
        }));

        /// If the user is claiming beans and isn't using the full amount,
        /// transfer the remaining amount to their external wallet if requested.
        const finalSteps = (() => {
          const transferAmount = totalClaimAmount.sub(additionalAmount);
          const isToExternal = transferDestination === FarmToMode.EXTERNAL;
          const shouldTransfer = isToExternal && transferAmount.gt(0);

          if (!shouldTransfer) return undefined;

          const transferStep = new sdk.farm.actions.TransferToken(
            BEAN.address,
            account,
            FarmFromMode.INTERNAL_TOLERANT,
            FarmToMode.EXTERNAL
          );

          const finalStep = {
            steps: [transferStep],
            overrideAmount: transferAmount,
          };
          return [finalStep];
        })();

        const { execute, performed } = await FormTxnBuilder.compile(
          sdk,
          values.farmActions,
          farmerFormTxns.getGenerators,
          buyFert,
          tokenIn.amount(amountIn.toString()),
          slippage,
          finalSteps
        );

        const txn = await execute();
        txToast.confirming(txn);

        const receipt = await txn.wait();

        await farmerFormTxns.refetch(
          performed,
          {
            farmerBarn: true,
            farmerBalances: true,
            farmerSilo: true,
          },
          [
            () =>
              refetchAllowances(
                account,
                fertilizer.address,
                getNewToOldToken(USDC)
              ),
          ]
        );
        txToast.success(receipt);
        formActions.resetForm();
      } catch (err) {
        // this sucks
        if (txToast) {
          txToast.error(err);
        } else {
          const errorToast = new TransactionToast({});
          errorToast.error(err);
        }
        console.error(err);
      }
    },
    [middleware, sdk, account, farmerFormTxns, refetchAllowances]
  );

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit}>
      {(formikProps) => (
        <BuyForm
          handleQuote={handleQuote}
          balances={balances}
          tokenOut={tokenOut}
          tokenList={tokenList}
          remainingFertilizer={remaining}
          {...formikProps}
        />
      )}
    </Formik>
  );
};

export default Buy;
