import { Box, InputAdornment, Stack, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import React, { useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ERC20Token, FarmFromMode, NativeToken, Token } from '@beanstalk/sdk';
import TransactionToast from '~/components/Common/TxnToast';
import TxnAccordion from '~/components/Common/TxnAccordion';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import {
  FormTokenStateNew,
  SettingInput,
  SmartSubmitButton,
  TokenAdornment,
  TokenInputField,
  TxnPreview,
  TxnSeparator,
  TxnSettings,
} from '~/components/Common/Form';
import useChainConstant from '~/hooks/chain/useChainConstant';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import useTokenMap from '~/hooks/chain/useTokenMap';
import useToggle from '~/hooks/display/useToggle';
import { Beanstalk } from '~/generated';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import { useSigner } from '~/hooks/ledger/useSigner';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import { useFetchFarmerMarket } from '~/state/farmer/market/updater';
import { ActionType } from '~/util/Actions';
import { optimizeFromMode } from '~/util/Farm';
import {
  displayFullBN,
  toStringBaseUnitBN,
  displayTokenAmount,
  displayBN,
  bnToTokenValue,
  tokenValueToBN,
} from '~/util';
import { AppState } from '~/state';
import { BEAN, ETH, PODS } from '~/constants/tokens';
import { ONE_BN, ZERO_BN, POD_MARKET_TOOLTIPS } from '~/constants';
import SliderField from '~/components/Common/Form/SliderField';
import FieldWrapper from '~/components/Common/Form/FieldWrapper';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import { FC } from '~/types';
import { useFetchFarmerMarketItems } from '~/hooks/farmer/market/useFarmerMarket2';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import useSdk from '~/hooks/sdk';

import { BuyPlotsFarmStep } from '~/lib/Txn/FarmSteps/market/BuyPlotsFarmStep';
import TokenQuoteProviderWithParams from '~/components/Common/Form/TokenQuoteProviderWithParams';
import TokenSelectDialogNew from '~/components/Common/Form/TokenSelectDialogNew';
import usePreferredToken from '~/hooks/farmer/usePreferredToken';
import useAccount from '~/hooks/ledger/useAccount';
import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';

import FormTxnProvider from '~/components/Common/Form/FormTxnProvider';
import useFormTxnContext from '~/hooks/sdk/useFormTxnContext';
import { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';
import { useGetLegacyToken } from '~/hooks/beanstalk/useTokens';

export type CreateOrderFormValues = {
  placeInLine: BigNumber | null;
  pricePerPod: BigNumber | null;
  tokens: FormTokenStateNew[];
  settings: {
    slippage: number;
  };
};

type PodOrderFormParams = {
  fromMode: FarmFromMode;
};

const PlaceInLineInputProps = {
  startAdornment: (
    <InputAdornment position="start">
      <Stack sx={{ pr: 0 }} alignItems="center">
        <Typography
          color="text.primary"
          sx={{
            opacity: '0.4',
            // HOTFIX: Small forms
            mr: -0.2,
            fontSize: 17.6,
          }}
        >
          0 -
        </Typography>
      </Stack>
    </InputAdornment>
  ),
};
const PricePerPodInputProps = {
  inputProps: { step: '0.01' },
  endAdornment: (
    <TokenAdornment
      token={BEAN[1]}
      // HOTFIX: Small forms
      size="small"
    />
  ),
};

const SLIDER_FIELD_KEYS = ['placeInLine'];

const CreateOrderV2Form: FC<
  FormikProps<CreateOrderFormValues> & {
    podLine: BigNumber;
    handleQuote: QuoteHandlerWithParams<PodOrderFormParams>;
    tokenList: (ERC20Token | NativeToken)[];
    contract: Beanstalk;
  }
> = ({
  values,
  setFieldValue,
  isSubmitting,
  handleQuote,
  podLine,
  tokenList,
  contract,
}) => {
  const sdk = useSdk();
  const Bean = sdk.tokens.BEAN;
  const erc20TokenMap = useTokenMap<ERC20Token | NativeToken>(tokenList);
  const balances = useFarmerBalances();
  const getLegacyToken = useGetLegacyToken();

  const [showTokenSelect, handleOpen, handleClose] = useToggle();
  const handleSelectTokens = useCallback(
    (_tokens: Set<Token>) => {
      // If the user has typed some existing values in,
      // save them. Add new tokens to the end of the list.
      // FIXME: match sorting of erc20TokenList
      const copy = new Set(_tokens);
      const v = values.tokens.filter((x) => {
        copy.delete(x.token);
        return _tokens.has(x.token);
      });
      setFieldValue('tokens', [
        ...v,
        ...Array.from(copy).map((_token) => ({
          token: _token,
          amount: undefined,
        })),
      ]);
    },
    [values.tokens, setFieldValue]
  );

  const quoteHandlerParams = useMemo(
    () => ({
      fromMode: FarmFromMode.EXTERNAL,
    }),
    []
  );

  const tokenIn = values.tokens[0].token;
  const amountIn = values.tokens[0].amount;
  const tokenOut = Bean;
  const amountOut =
    tokenIn === tokenOut // Beans
      ? values.tokens[0].amount
      : values.tokens[0].amountOut;

  const isReady =
    amountIn &&
    values.placeInLine?.gt(0) &&
    values.pricePerPod?.gt(0) &&
    amountOut;
  const amountPods = isReady ? amountOut.div(values.pricePerPod!) : ZERO_BN;

  return (
    <Form autoComplete="off" noValidate>
      <TokenSelectDialogNew
        open={showTokenSelect}
        handleClose={handleClose}
        selected={values.tokens}
        handleSubmit={handleSelectTokens}
        balances={balances}
        balanceFrom={BalanceFrom.TOTAL}
        tokenList={Object.values(erc20TokenMap)}
        mode={TokenSelectMode.SINGLE}
      />
      <Stack gap={1.5}>
        <FieldWrapper
          label="Max Place in Line"
          tooltip="The maximum Place in Line in which you are willing to buy Pods at the following price."
        >
          <Box px={1.7}>
            <SliderField
              min={0}
              fields={SLIDER_FIELD_KEYS}
              max={podLine.toNumber()}
              initialState={0}
            />
          </Box>
          <TokenInputField
            name="placeInLine"
            placeholder={displayFullBN(podLine, 0).toString()}
            max={podLine}
            InputProps={PlaceInLineInputProps}
            size="small"
          />
        </FieldWrapper>
        <FieldWrapper
          label="Price per Pod"
          tooltip={POD_MARKET_TOOLTIPS.pricePerPodOrder}
        >
          <TokenInputField
            name="pricePerPod"
            placeholder="0.0000"
            InputProps={PricePerPodInputProps}
            max={ONE_BN}
            size="small"
          />
        </FieldWrapper>
        <FieldWrapper label="Order using">
          <>
            {values.tokens.map((state, index) => (
              <TokenQuoteProviderWithParams<PodOrderFormParams>
                key={`tokens.${index}`}
                name={`tokens.${index}`}
                tokenOut={Bean}
                balance={
                  state.token.address === ''
                    ? balances.eth
                    : balances[state.token.address] || ZERO_BN
                }
                balanceFrom={BalanceFrom.TOTAL}
                state={state}
                params={quoteHandlerParams}
                showTokenSelect={handleOpen}
                handleQuote={handleQuote}
                size="small"
              />
            ))}
          </>
        </FieldWrapper>
        {isReady ? (
          <>
            <TxnSeparator mt={-1} />
            <TokenOutput size="small">
              <TokenOutput.Row
                token={sdk.tokens.PODS}
                amount={amountPods}
                size="small"
              />
            </TokenOutput>
            {/* <Alert
              color="warning"
              icon={
                <IconWrapper boxSize={IconSize.medium}>
                  <WarningAmberIcon sx={{ fontSize: IconSize.small }} />
                </IconWrapper>
              }
            >
              You will only receive this number of Pods if your Order is
              entirely Filled.
            </Alert> */}
            <Box>
              <TxnAccordion>
                <TxnPreview
                  actions={[
                    tokenIn === tokenOut
                      ? undefined
                      : {
                          type: ActionType.SWAP,
                          tokenIn: getLegacyToken(tokenIn),
                          amountIn: amountIn,
                          tokenOut: getLegacyToken(tokenOut),
                          amountOut: amountOut,
                        },
                    {
                      type: ActionType.CREATE_ORDER,
                      message: `Order ${displayTokenAmount(
                        amountPods,
                        PODS
                      )} at ${displayFullBN(
                        values.pricePerPod!,
                        4
                      )} Beans per Pod. Any Pods before ${displayBN(
                        values.placeInLine!
                      )} in the Pod Line are eligible to Fill this Order.`,
                    },
                    {
                      type: ActionType.BASE,
                      message: `${displayTokenAmount(
                        amountOut,
                        tokenOut
                      )} will be locked in the Pod Order to allow for instant settlement. You can reclaim these Beans by Cancelling the Order.`,
                    },
                  ]}
                />
              </TxnAccordion>
            </Box>
          </>
        ) : null}
        <Box sx={{ position: 'sticky', bottom: 6.5, zIndex: 10 }}>
          <SmartSubmitButton
            loading={isSubmitting}
            disabled={isSubmitting || !isReady}
            type="submit"
            variant="contained"
            color="primary"
            contract={contract}
            tokens={values.tokens}
            mode="auto"
            sx={{ width: '100%', outline: '6.5px solid white' }}
          >
            Order
          </SmartSubmitButton>
        </Box>
      </Stack>
    </Form>
  );
};

// ---------------------------------------------------

const CreateOrderProvider: FC<{}> = () => {
  const sdk = useSdk();

  /// Tokens
  const Eth = useChainConstant(ETH);
  const Bean = sdk.tokens.BEAN;
  const Weth = sdk.tokens.WETH;

  const { preferredTokens, tokenList } = useMemo(() => {
    const tokens = BuyPlotsFarmStep.getPreferredTokens(sdk.tokens);
    return {
      preferredTokens: tokens.preferred,
      tokenList: tokens.tokenList,
    };
  }, [sdk]);

  const tokenMap = useTokenMap<ERC20Token | NativeToken>(tokenList);

  /// Ledger
  const { data: signer } = useSigner();
  const beanstalk = useBeanstalkContract(signer);

  /// Beanstalk
  const beanstalkField = useSelector<AppState, AppState['_beanstalk']['field']>(
    (state) => state._beanstalk.field
  );
  const account = useAccount();

  /// Farmer
  const balances = useFarmerBalances();
  const [refetchFarmerBalances] = useFetchFarmerBalances();
  const [refetchFarmerMarket] = useFetchFarmerMarket();
  // subgraph queries
  const { fetch: fetchFarmerMarketItems } = useFetchFarmerMarketItems();

  /// Form
  const middleware = useFormMiddleware();
  const { txnBundler } = useFormTxnContext();

  const baseToken = usePreferredToken(preferredTokens, 'use-best');
  const initialValues: CreateOrderFormValues = useMemo(
    () => ({
      placeInLine: ZERO_BN,
      pricePerPod: null,
      tokens: [
        {
          token: baseToken as ERC20Token | NativeToken,
          amount: undefined,
        },
      ],
      settings: {
        slippage: 0.1,
      },
    }),
    [baseToken]
  );

  /// Handlers

  const handleQuote = useCallback(
    async (_tokenIn: any, _amountIn: any, _tokenOut: any) => {
      const amountOut = await BuyPlotsFarmStep.getAmountOut(
        sdk,
        _tokenIn,
        _amountIn.toString(),
        FarmFromMode.EXTERNAL,
        account
      );

      return {
        amountOut: tokenValueToBN(amountOut),
        tokenValue: amountOut,
      };
    },
    [account, sdk]
  );

  const onSubmit = useCallback(
    async (
      values: CreateOrderFormValues,
      formActions: FormikHelpers<CreateOrderFormValues>
    ) => {
      let txToast;
      try {
        middleware.before();

        if (!values.settings.slippage) {
          throw new Error('No slippage value set.');
        }
        if (values.tokens.length > 1) {
          throw new Error('Only one token supported at this time');
        }
        const tokenData = values.tokens[0];
        const { pricePerPod, placeInLine } = values;

        if (!tokenData?.amount || tokenData.amount.eq(0)) {
          throw new Error('No amount set');
        }
        if (!pricePerPod || !placeInLine) throw new Error('Missing data');

        ///
        let call;
        let txn;
        const inputToken = tokenData.token;

        ///
        txToast = new TransactionToast({
          loading: 'Ordering Pods...',
          success: 'Order successful.',
        });

        /// Create Pod Order directly
        /// We only need one call to do this, so we skip
        /// the farm() call below to optimize gas.

        if (inputToken === Bean) {
          call = beanstalk.createPodOrder(
            {
              orderer: account || '',
              minFillAmount: PODS.stringify(new BigNumber(1)),
              maxPlaceInLine: toStringBaseUnitBN(placeInLine, Bean.decimals),
              pricePerPod: toStringBaseUnitBN(pricePerPod, Bean.decimals),
              fieldId: '0',
            },
            toStringBaseUnitBN(tokenData.amount, Bean.decimals),
            optimizeFromMode(tokenData.amount, balances[Bean.address])
          );

          txn = await call;
        }

        /// Buy and Create Pod Order
        else {
          /// Require a quote
          if (!tokenData.amountOut) {
            throw new Error(`No quote available for ${tokenData.token.symbol}`);
          }

          const beanAmountOut = await handleQuote(
            tokenData.token,
            tokenData.amount,
            BEAN
          );

          const orderTxn = new BuyPlotsFarmStep(sdk, account!);
          orderTxn.build(
            tokenData.token,
            beanAmountOut.tokenValue,
            pricePerPod,
            placeInLine
          );

          const { execute } = await txnBundler.bundle(
            orderTxn,
            bnToTokenValue(tokenData.token, tokenData.amount),
            values.settings.slippage
          );

          txn = await execute();
        }

        txToast.confirming(txn);

        const receipt = await txn.wait();
        await Promise.all([
          refetchFarmerBalances(),
          refetchFarmerMarket(),
          fetchFarmerMarketItems(),
        ]);
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
      Bean,
      refetchFarmerBalances,
      refetchFarmerMarket,
      fetchFarmerMarketItems,
      beanstalk,
      balances,
      handleQuote,
      sdk,
      account,
      txnBundler,
    ]
  );

  return (
    <Formik<CreateOrderFormValues>
      initialValues={initialValues}
      onSubmit={onSubmit}
      enableReinitialize
    >
      {(formikProps: FormikProps<CreateOrderFormValues>) => (
        <>
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              height: '100%',
              zIndex: 10,
            }}
          >
            <TxnSettings placement="condensed-form-top-right">
              <SettingInput
                name="settings.slippage"
                label="Slippage Tolerance"
                endAdornment="%"
              />
            </TxnSettings>
          </Box>
          <CreateOrderV2Form
            podLine={beanstalkField.podLine}
            handleQuote={handleQuote}
            tokenList={Object.values(tokenMap) as (ERC20Token | NativeToken)[]}
            contract={beanstalk}
            {...formikProps}
          />
        </>
      )}
    </Formik>
  );
};

const CreateOrder: FC<{}> = (props) => (
  <FormTxnProvider>
    <CreateOrderProvider {...props} />
  </FormTxnProvider>
);

export default CreateOrder;
