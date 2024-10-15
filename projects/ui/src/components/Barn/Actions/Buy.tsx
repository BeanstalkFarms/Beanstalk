import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Box, Divider, Link, Stack, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Formik, FormikHelpers, FormikProps } from 'formik';
import {
  Token,
  ERC20Token,
  NativeToken,
  BeanstalkSDK,
  FarmToMode,
  TokenValue,
  BeanSwapNodeQuote,
  BeanSwapOperation,
} from '@beanstalk/sdk';
import { useSelector } from 'react-redux';

import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import {
  BalanceFromFragment,
  FormApprovingStateNew,
  FormTokenStateNew,
  FormTxnsFormState,
  SettingInput,
  TxnSettings,
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
import {
  displayTokenAmount,
  getTokenIndex,
  normaliseTV,
  tokenValueToBN,
} from '~/util';
import { useFetchFarmerAllowances } from '~/state/farmer/allowances/updater';
import { FarmerBalances } from '~/state/farmer/balances';
import useAccount from '~/hooks/ledger/useAccount';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import { FC } from '~/types';
import TokenQuoteProviderWithParams from '~/components/Common/Form/TokenQuoteProviderWithParams';
import TokenSelectDialogNew from '~/components/Common/Form/TokenSelectDialogNew';
import useSdk from '~/hooks/sdk';
import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';
import {
  BalanceFrom,
  balanceFromToMode,
} from '~/components/Common/Form/BalanceFromRow';
import WarningAlert from '~/components/Common/Alert/WarningAlert';
import useFarmerFormTxnsActions from '~/hooks/farmer/form-txn/useFarmerFormTxnActions';
import AdditionalTxnsAccordion from '~/components/Common/Form/FormTxn/AdditionalTxnsAccordion';
import { AppState } from '~/state';
import ClaimBeanDrawerToggle from '~/components/Common/Form/FormTxn/ClaimBeanDrawerToggle';
import FormWithDrawer from '~/components/Common/Form/FormWithDrawer';
import ClaimBeanDrawerContent from '~/components/Common/Form/FormTxn/ClaimBeanDrawerContent';
import FormTxnProvider from '~/components/Common/Form/FormTxnProvider';
import useFormTxnContext from '~/hooks/sdk/useFormTxnContext';
import { BuyFertilizerFarmStep, ClaimAndDoX } from '~/lib/Txn';
import { useWstETHPriceFromBeanstalk } from '~/hooks/ledger/useWstEthPriceFromBeanstalk';
import FertilizerItem from '../FertilizerItem';

// ---------------------------------------------------

interface IBeanSwapQuote {
  beanSwapQuote: BeanSwapNodeQuote | undefined;
}

type FormTokenStateWithQuote = FormTokenStateNew & IBeanSwapQuote;

interface FormState {
  tokens: FormTokenStateWithQuote[];
  approving?: FormApprovingStateNew;
}

type BuyFormValues = FormState &
  BalanceFromFragment &
  FormTxnsFormState & {
    settings: {
      slippage: number;
    };
  } & {
    claimableBeans: FormTokenStateWithQuote;
  };

type BuyQuoteHandlerParams = {
  // fromMode: FarmFromMode;
  slippage: number;
};

const defaultFarmActionsFormState = {
  preset: 'claim',
  primary: undefined,
  secondary: undefined,
};

// ---------------------------------------------------

const BuyForm: FC<
  FormikProps<BuyFormValues> & {
    balances: FarmerBalances;
    tokenOut: ERC20Token;
    tokenList: (ERC20Token | NativeToken)[];
    remainingFertilizer: BigNumber;
    sdk: BeanstalkSDK;
  }
> = ({
  // Formik
  values,
  setFieldValue,
  isSubmitting,
  // Custom
  tokenList,
  balances,
  tokenOut: token,
  sdk,
}) => {
  const account = useAccount();
  const formRef = useRef<HTMLDivElement>(null);
  const getWstETHPrice = useWstETHPriceFromBeanstalk();
  const tokenMap = useTokenMap<ERC20Token | NativeToken>(tokenList);
  const [wstETHPrice, setWstETHPrice] = useState(TokenValue.ZERO);

  useEffect(() => {
    getWstETHPrice()
      .then((price) => {
        setWstETHPrice(price);
      })
      .catch((e) => {
        console.log('Error getting wstETH price: ', e);
      });
  }, [getWstETHPrice]);

  // Doesn't get called if tokenIn === tokenOut
  // aka if the user has selected wstETH as input
  const handleQuote = useCallback<
    QuoteHandlerWithParams<BuyQuoteHandlerParams>
  >(
    async (tokenIn, _amountIn, _tokenOut, { slippage }) => {
      if (!account) {
        throw new Error('No account connected');
      }
      const quote = await BuyFertilizerFarmStep.getAmountOut(
        sdk,
        tokenList,
        tokenIn,
        tokenIn.amount(_amountIn.toString()),
        slippage
      );

      setFieldValue('tokens.0.beanSwapQuote', quote.beanSwapQuote);

      return tokenValueToBN(quote.amountOut);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [account, sdk, tokenList, setFieldValue]
  );

  const handleQuoteClaim = useCallback<
    QuoteHandlerWithParams<BuyQuoteHandlerParams>
  >(
    async (tokenIn, _amountIn, _tokenOut, { slippage }) => {
      if (!account) {
        throw new Error('No account connected');
      }

      const quote = await BuyFertilizerFarmStep.getAmountOut(
        sdk,
        tokenList,
        tokenIn,
        tokenIn.amount(_amountIn.toString()),
        slippage
      );

      setFieldValue('claimableBeans.beanSwapQuote', quote.beanSwapQuote);

      return tokenValueToBN(quote.amountOut);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [account, sdk, tokenList, setFieldValue]
  );

  const combinedTokenState = [...values.tokens, values.claimableBeans];

  const { fert, humidity, actions } = useFertilizerSummary(
    combinedTokenState,
    wstETHPrice
  );

  // Extract
  const isValid = fert?.gt(0);

  const formTokenInputState = values.tokens[0];
  const tokenIn = formTokenInputState.token;

  const tokenBalance = balances[getTokenIndex(tokenIn)] || undefined;

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
      slippage: values.settings.slippage,
    };
    return _params;
  }, [values.settings.slippage]);

  /// Approval Checks
  const shouldApprove =
    values.balanceFrom === BalanceFrom.EXTERNAL ||
    (values.balanceFrom === BalanceFrom.TOTAL &&
      values.tokens[0].amount?.gt(balances[tokenIn.address]?.internal));

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
        {false && <ClaimBeanDrawerToggle actionText="Buy Fert with" />}
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
                The amount of Fertilizer received is: <br />
                {values.tokens[0].amount?.gt(0) && (
                  <>
                    {displayTokenAmount(
                      values.tokens[0].amount || BigNumber(0),
                      values.tokens[0].token,
                      { showName: false, showSymbol: true }
                    )}
                  </>
                )}{' '}
                {values.claimableBeans.amount?.gt(0) && (
                  <>
                    {values.tokens[0].amount?.gt(0) && <>+ </>}
                    {displayTokenAmount(
                      values.claimableBeans.amount,
                      sdk.tokens.BEAN,
                      { showName: false, showSymbol: true }
                    )}
                  </>
                )}{' '}
                {values.tokens[0].token.symbol !== 'wstETH' && (
                  <>
                    →{' '}
                    {displayTokenAmount(
                      values.tokens[0].amountOut?.plus(
                        values.claimableBeans.amountOut || BigNumber(0)
                      ) || BigNumber(0),
                      sdk.tokens.WSTETH,
                      { showName: false, showSymbol: true }
                    )}
                  </>
                )}{' '}
                * ${wstETHPrice.toHuman('short')} = {fert.toFixed(0)} Fertilizer
              </WarningAlert>
              <Box width="100%">
                <AdditionalTxnsAccordion />
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
          tokens={shouldApprove ? values.tokens : []}
        >
          Buy
        </SmartSubmitButton>
      </Stack>
      <FormWithDrawer.Drawer title="Buy Fert with Claimable Beans">
        <ClaimBeanDrawerContent<BuyQuoteHandlerParams>
          quoteProviderProps={{
            tokenOut: token,
            name: 'claimableBeans',
            state: values.claimableBeans,
            params: quoteProviderParams,
            handleQuote: handleQuoteClaim,
          }}
        />
      </FormWithDrawer.Drawer>
    </FormWithDrawer>
  );
};

const BuyPropProvider: FC<{}> = () => {
  const sdk = useSdk();
  const getWstETHPrice = useWstETHPriceFromBeanstalk();

  const { remaining } = useSelector<AppState, AppState['_beanstalk']['barn']>(
    (state) => state._beanstalk.barn
  );

  /// Farmer
  const account = useAccount();
  const balances = useFarmerBalances();
  const [refetchAllowances] = useFetchFarmerAllowances();

  /// Form
  const middleware = useFormMiddleware();
  const { txnBundler, refetch } = useFormTxnContext();

  const { preferredTokens, tokenList } = useMemo(() => {
    const _preferredTokens: PreferredToken[] =
      BuyFertilizerFarmStep.getPreferredTokens(sdk.tokens);
    const _tokenList = BuyFertilizerFarmStep.getTokenList(sdk.tokens);
    return {
      preferredTokens: _preferredTokens,
      tokenList: _tokenList,
    };
  }, [sdk.tokens]);
  const baseToken = usePreferredToken(preferredTokens, 'use-best');
  const tokenOut = sdk.tokens.WSTETH;

  const initialValues: BuyFormValues = useMemo(
    () => ({
      tokens: [
        {
          token: baseToken as ERC20Token | NativeToken,
          amount: undefined,
          beanSwapQuote: undefined,
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
        beanSwapQuote: undefined,
      },
      settings: {
        slippage: 0.1,
      },
    }),
    [baseToken, sdk.tokens.BEAN]
  );

  /// Handlers

  const onSubmit = useCallback(
    async (
      values: BuyFormValues,
      formActions: FormikHelpers<BuyFormValues>
    ) => {
      let txToast;
      try {
        middleware.before();
        const wstETHPrice = await getWstETHPrice();
        const { USDC, BEAN, WSTETH } = sdk.tokens;

        const { fertilizer } = sdk.contracts;
        if (!sdk.contracts.beanstalk) {
          throw new Error('Unable to access contracts');
        }
        if (!account) {
          throw new Error('Signer Required.');
        }

        const formData = values.tokens[0];
        const claimData = values.claimableBeans;
        const tokenIn = formData.token; // input token
        const _amountIn = formData.amount; // input amount in form
        const _amountOut = formData.amountOut; // output amount in form
        const slippage = values.settings.slippage;

        if (!slippage || slippage < 0) {
          throw new Error('Invalid slippage amount');
        }

        const amountIn = normaliseTV(tokenIn, _amountIn);
        const totalWstETHOut = WSTETH.equals(tokenIn)
          ? amountIn
          : normaliseTV(WSTETH, _amountOut).add(
              claimData.amountOut?.toNumber() ?? 0
            );

        if (totalWstETHOut.lte(0)) throw new Error('Amount required');

        const claimAndDoX = new ClaimAndDoX(
          sdk,
          normaliseTV(BEAN, claimData.maxAmountIn),
          normaliseTV(BEAN, claimData.amount),
          values.farmActions.transferToMode || FarmToMode.INTERNAL
        );

        const buyTxn = new BuyFertilizerFarmStep(sdk, account);
        const estFert = buyTxn.getFertFromWstETH(totalWstETHOut, wstETHPrice);

        txToast = new TransactionToast({
          loading: `Buying ${estFert} Fertilizer...`,
          success: 'Purchase successful.',
        });

        const { operation, postClaimOperation } = getSwapOperation(
          sdk,
          values,
          account
        );

        buyTxn.build(
          tokenIn,
          amountIn,
          balanceFromToMode(values.balanceFrom),
          claimAndDoX,
          wstETHPrice,
          slippage,
          operation,
          postClaimOperation
        );

        const performed = txnBundler.setFarmSteps(values.farmActions);
        const { execute, farm } = await txnBundler.bundle(
          buyTxn,
          amountIn,
          slippage
        );
        try {
          // smoke test, if this fails, slippage is too low
          await farm.estimateGas(amountIn, { slippage: 1 });
        } catch (err) {
          console.log('Failed to estimate gas. May need to increase slippage.');
          txToast.error(
            new Error('Failed to estimate gas. May need to increase slippage.')
          );
          return;
        }

        const txn = await execute();
        txToast.confirming(txn);

        const receipt = await txn.wait();

        await refetch(
          performed,
          {
            farmerBarn: true,
            farmerBalances: true,
            farmerSilo: true,
          },
          [() => refetchAllowances(account, fertilizer.address, USDC)]
        );
        txToast.success(receipt);
        formActions.resetForm();
      } catch (err) {
        if (txToast) {
          txToast.error(err);
        } else {
          const errorToast = new TransactionToast({});
          errorToast.error(err);
        }
        console.error(err);
      }
    },
    [
      middleware,
      getWstETHPrice,
      sdk,
      account,
      txnBundler,
      refetch,
      refetchAllowances,
    ]
  );

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit}>
      {(formikProps) => (
        <>
          <TxnSettings placement="form-top-right">
            <SettingInput
              name="settings.slippage"
              label="Slippage Tolerance"
              endAdornment="%"
            />
          </TxnSettings>
          <BuyForm
            balances={balances}
            tokenOut={tokenOut}
            tokenList={tokenList}
            remainingFertilizer={remaining}
            sdk={sdk}
            {...formikProps}
          />
        </>
      )}
    </Formik>
  );
};

const Buy: React.FC<{}> = () => (
  <FormTxnProvider>
    <BuyPropProvider />
  </FormTxnProvider>
);

export default Buy;

function getSwapOperation(
  sdk: BeanstalkSDK,
  values: BuyFormValues,
  account: string | undefined
) {
  if (!account) {
    throw new Error('Signer required');
  }
  const state = values.tokens[0];
  const sellToken = state?.token;
  const buyToken = sdk.tokens.WSTETH;
  const quoteData = state?.beanSwapQuote;
  const amountIn = state?.amount;
  const amountOut = state?.amountOut;
  const claim = values.claimableBeans;
  const claimQuote = claim?.beanSwapQuote;

  const operation = quoteData
    ? BeanSwapOperation.buildWithQuote(
        quoteData,
        account,
        account,
        balanceFromToMode(values.balanceFrom),
        FarmToMode.INTERNAL
      )
    : undefined;

  const postClaimOperation = claimQuote
    ? BeanSwapOperation.buildWithQuote(
        claimQuote,
        account,
        account,
        balanceFromToMode(values.balanceFrom),
        FarmToMode.INTERNAL
      )
    : undefined;

  if (!sellToken) {
    throw new Error('No token selected');
  }
  if (!amountIn) {
    throw new Error('No amounts detected');
  }

  if (buyToken.equals(sellToken)) {
    return { operation, postClaimOperation };
  }
  if (!amountIn || !amountOut) {
    throw new Error('No amounts detected');
  }

  if (!quoteData) {
    throw new Error('No quote data');
  }
  const firstNode = quoteData.nodes[0];
  const lastNode = quoteData.nodes[quoteData.nodes.length - 1];

  if (!firstNode.sellToken.equals(sellToken)) {
    throw new Error(
      `Token input mismatch. Expected: ${sellToken} Got: ${firstNode.sellToken}`
    );
  }
  if (!lastNode.buyToken.equals(buyToken)) {
    throw new Error(
      `Target token mismatch. Expected: ${buyToken} Got: ${lastNode.buyToken}`
    );
  }
  if (!quoteData.sellAmount.eq(sellToken.fromHuman(amountIn.toString()))) {
    throw new Error(
      `Sell amount mismatch. Expected: ${amountIn} Got: ${quoteData.sellAmount}`
    );
  }
  if (!quoteData.buyAmount.eq(buyToken.fromHuman(amountOut.toString()))) {
    throw new Error(
      `Buy amount mismatch. Expected: ${amountOut} Got: ${quoteData.buyAmount}`
    );
  }

  return { operation, postClaimOperation };
}
