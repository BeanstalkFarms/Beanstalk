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
  FarmFromMode,
  FarmToMode,
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
import { getTokenIndex, normaliseTV, tokenValueToBN } from '~/util';
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
import { AppState } from '~/state';
import ClaimBeanDrawerToggle from '~/components/Common/Form/FormTxn/ClaimBeanDrawerToggle';
import FormWithDrawer from '~/components/Common/Form/FormWithDrawer';
import ClaimBeanDrawerContent from '~/components/Common/Form/FormTxn/ClaimBeanDrawerContent';
import FormTxnProvider from '~/components/Common/Form/FormTxnProvider';
import useFormTxnContext from '~/hooks/sdk/useFormTxnContext';
import { BuyFertilizerFarmStep, ClaimAndDoX } from '~/lib/Txn';
import { useEthPriceFromBeanstalk } from '~/hooks/ledger/useEthPriceFromBeanstalk';

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
    sdk: BeanstalkSDK;
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
  sdk,
}) => {
  const formRef = useRef<HTMLDivElement>(null);
  const getEthPrice = useEthPriceFromBeanstalk();
  const tokenMap = useTokenMap<ERC20Token | NativeToken>(tokenList);
  const [ethPrice, setEthPrice] = useState(TokenValue.ZERO);

  useEffect(() => {
    getEthPrice().then((price) => {
      setEthPrice(price);
    });
  }, [getEthPrice]);

  const combinedTokenState = [...values.tokens, values.claimableBeans];

  const { fert, humidity, actions } = useFertilizerSummary(
    combinedTokenState,
    ethPrice
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
      fromMode: balanceFromToMode(values.balanceFrom),
    };
    return _params;
  }, [values.balanceFrom]);

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
                The amount of Fertilizer received is: <br />
                {values.tokens[0].amount?.toFixed(2)}{' '}
                {values.tokens[0].token.symbol}
                {values.tokens[0].token.symbol !== 'WETH' && (
                  <> → {values.tokens[0].amountOut?.toFixed(2)} WETH </>
                )}{' '}
                * ${ethPrice.toHuman('short')} = {fert.toFixed(0)} Fertilizer
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
      <FormWithDrawer.Drawer title="Use Claimable Beans">
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

const BuyPropProvider: FC<{}> = () => {
  const sdk = useSdk();
  const getEthPrice = useEthPriceFromBeanstalk();

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
  const tokenOut = sdk.tokens.WETH;

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
        slippage: 0.5,
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
      const estimate = await BuyFertilizerFarmStep.getAmountOut(
        sdk,
        tokenList,
        tokenIn,
        tokenIn.amount(_amountIn.toString()),
        _fromMode,
        account
      );

      return tokenValueToBN(estimate.amountOut);
    },
    [account, sdk, tokenList]
  );

  const onSubmit = useCallback(
    async (
      values: BuyFormValues,
      formActions: FormikHelpers<BuyFormValues>
    ) => {
      let txToast;
      try {
        middleware.before();
        const ethPrice = await getEthPrice();
        const { USDC, BEAN, WETH } = sdk.tokens;

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
        const amountOut = WETH.equals(tokenIn)
          ? amountIn
          : normaliseTV(WETH, _amountOut);

        const totalWETHOut = amountOut;

        if (totalWETHOut.lte(0)) throw new Error('Amount required');

        const claimAndDoX = new ClaimAndDoX(
          sdk,
          normaliseTV(BEAN, claimData.maxAmountIn),
          normaliseTV(BEAN, claimData.amount),
          values.farmActions.transferToMode || FarmToMode.INTERNAL
        );

        const buyTxn = new BuyFertilizerFarmStep(sdk, account);
        const estFert = buyTxn.getFertFromWeth(totalWETHOut, ethPrice);

        txToast = new TransactionToast({
          loading: `Buying ${estFert} Fertilizer...`,
          success: 'Purchase successful.',
        });

        buyTxn.build(
          tokenIn,
          amountIn,
          balanceFromToMode(values.balanceFrom),
          claimAndDoX,
          ethPrice,
          slippage
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
      getEthPrice,
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
        <BuyForm
          handleQuote={handleQuote}
          balances={balances}
          tokenOut={tokenOut}
          tokenList={tokenList}
          remainingFertilizer={remaining}
          sdk={sdk}
          {...formikProps}
        />
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
