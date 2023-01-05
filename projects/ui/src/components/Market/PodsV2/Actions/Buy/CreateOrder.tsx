import { Box, InputAdornment, Stack, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import React, { useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ethers } from 'ethers';
import { useProvider } from 'wagmi';
import toast from 'react-hot-toast';
import TransactionToast from '~/components/Common/TxnToast';
import TxnAccordion from '~/components/Common/TxnAccordion';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import {
  FormTokenState,
  SettingInput,
  SmartSubmitButton,
  TokenAdornment,
  TokenInputField,
  TokenOutputField,
  TokenQuoteProvider,
  TokenSelectDialog,
  TxnPreview,
  TxnSeparator,
  TxnSettings,
} from '~/components/Common/Form';
import Token, { ERC20Token, NativeToken } from '~/classes/Token';
import useChainConstant from '~/hooks/chain/useChainConstant';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import { QuoteHandler } from '~/hooks/ledger/useQuote';
import useTokenMap from '~/hooks/chain/useTokenMap';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
import useToggle from '~/hooks/display/useToggle';
import { Beanstalk } from '~/generated';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import { useSigner } from '~/hooks/ledger/useSigner';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import { useFetchFarmerMarket } from '~/state/farmer/market/updater';
import { ActionType } from '~/util/Actions';
import Farm, { FarmFromMode, FarmToMode } from '~/lib/Beanstalk/Farm';
import { optimizeFromMode } from '~/util/Farm';
import {
  displayFullBN,
  toStringBaseUnitBN,
  toTokenUnitsBN,
  parseError,
  displayTokenAmount,
  displayBN,
} from '~/util';
import { AppState } from '~/state';
import { BEAN, ETH, PODS, WETH } from '~/constants/tokens';
import { ONE_BN, ZERO_BN, POD_MARKET_TOOLTIPS } from '~/constants';
import SliderField from '~/components/Common/Form/SliderField';
import FieldWrapper from '~/components/Common/Form/FieldWrapper';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';

import { FC } from '~/types';
import { useFetchFarmerMarketItems } from '~/hooks/farmer/market/useFarmerMarket2';

export type CreateOrderFormValues = {
  placeInLine: BigNumber | null;
  pricePerPod: BigNumber | null;
  tokens: FormTokenState[];
  settings: {
    slippage: number;
  };
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
            mt: 0.2,
            mr: -0.2,
            fontSize: 17.6,
          }}>
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
  )
};

const SLIDER_FIELD_KEYS = ['placeInLine'];

const CreateOrderV2Form: FC<
  FormikProps<CreateOrderFormValues> & {
    podLine: BigNumber;
    handleQuote: QuoteHandler;
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
  const getChainToken = useGetChainToken();
  const balances = useFarmerBalances();

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

  const tokenIn = values.tokens[0].token;
  const amountIn = values.tokens[0].amount;
  const tokenOut = getChainToken(BEAN);
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
      <TokenSelectDialog
        open={showTokenSelect}
        handleClose={handleClose}
        selected={values.tokens}
        handleSubmit={handleSelectTokens}
        balances={balances}
        tokenList={tokenList}
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
              <TokenQuoteProvider
                key={`tokens.${index}`}
                name={`tokens.${index}`}
                tokenOut={getChainToken(BEAN)}
                balance={balances[state.token.address] || ZERO_BN}
                state={state}
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
            <TokenOutputField
              token={PODS}
              amount={amountPods}
              size="small"
            />
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
                          tokenIn,
                          amountIn,
                          tokenOut,
                          amountOut,
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
        <SmartSubmitButton
          loading={isSubmitting}
          disabled={isSubmitting || !isReady}
          type="submit"
          variant="contained"
          color="primary"
          contract={contract}
          tokens={values.tokens}
          mode="auto"
        >
          Order
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

// ---------------------------------------------------

const CreateOrder: FC<{}> = () => {
  /// Tokens
  const getChainToken = useGetChainToken();
  const Eth = useChainConstant(ETH);
  const Bean = getChainToken(BEAN);
  const Weth = getChainToken(WETH);
  const tokenMap = useTokenMap<ERC20Token | NativeToken>([BEAN, ETH]);

  /// Ledger
  const { data: signer } = useSigner();
  const provider = useProvider();
  const beanstalk = useBeanstalkContract(signer);

  /// Farm
  const farm = useMemo(() => new Farm(provider), [provider]);

  /// Beanstalk
  const beanstalkField = useSelector<AppState, AppState['_beanstalk']['field']>(
    (state) => state._beanstalk.field
  );

  /// Farmer
  const balances = useFarmerBalances();
  const [refetchFarmerBalances] = useFetchFarmerBalances();
  const [refetchFarmerMarket] = useFetchFarmerMarket();
    // subgraph queries
    const { fetch: fetchFarmerMarketItems } = useFetchFarmerMarketItems();

  /// Form
  const middleware = useFormMiddleware();
  const initialValues: CreateOrderFormValues = useMemo(
    () => ({
      placeInLine: ZERO_BN,
      pricePerPod: null,
      tokens: [
        {
          token: Eth,
          amount: undefined,
        },
      ],
      settings: {
        slippage: 0.1,
      },
    }),
    [Eth]
  );

  /// Handlers

  const handleQuote = useCallback<QuoteHandler>(
    async (_tokenIn, _amountIn, _tokenOut) => {
      // tokenOut is fixed to BEAN.
      const tokenIn: ERC20Token =
        _tokenIn instanceof NativeToken ? Weth : _tokenIn;
      const tokenOut: ERC20Token =
        _tokenOut instanceof NativeToken ? Weth : _tokenOut;
      const amountIn = ethers.BigNumber.from(
        toStringBaseUnitBN(_amountIn, tokenIn.decimals)
      );
      let estimate;

      // Depositing BEAN
      if (tokenIn === Weth) {
        estimate = await Farm.estimate(
          farm.buyBeans(), // this assumes we're coming from WETH
          [amountIn]
        );
      }

      if (!estimate) throw new Error();
      console.debug('[chain] estimate = ', estimate);

      return {
        amountOut: toTokenUnitsBN(
          estimate.amountOut.toString(),
          tokenOut.decimals
        ),
        steps: estimate.steps,
      };
    },
    [Weth, farm]
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
        let value = ZERO_BN;
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
            Bean.stringify(tokenData.amount),
            Bean.stringify(pricePerPod),
            Bean.stringify(placeInLine),
            PODS.stringify(new BigNumber(1)), // minFillAmount is measured in Pods
            optimizeFromMode(tokenData.amount, balances[Bean.address])
          );
        }

        /// Buy and Create Pod Order
        else {
          /// Require a quote
          if (!tokenData.steps || !tokenData.amountOut) {
            throw new Error(`No quote available for ${tokenData.token.symbol}`);
          }
          const data: string[] = [];

          /// Wrap ETH to WETH
          if (inputToken === Eth) {
            value = value.plus(tokenData.amount);
            data.push(
              beanstalk.interface.encodeFunctionData('wrapEth', [
                toStringBaseUnitBN(value, Eth.decimals),
                FarmToMode.INTERNAL, // to
              ])
            );
          }

          /// Execute steps
          /// (right now: Sell WETH -> BEAN)
          const encoded = Farm.encodeStepsWithSlippage(
            tokenData.steps,
            values.settings.slippage / 100
          );
          data.push(...encoded);
          data.push(
            beanstalk.interface.encodeFunctionData('createPodOrder', [
              Bean.stringify(tokenData.amountOut),
              Bean.stringify(pricePerPod),
              Bean.stringify(placeInLine),
              toStringBaseUnitBN(new BigNumber(1), PODS.decimals),
              FarmFromMode.INTERNAL_TOLERANT,
            ])
          );

          console.log('tokenoutamount: ', Bean.stringify(tokenData.amountOut));
          console.log('pricePerPod: ',  Bean.stringify(pricePerPod));
          console.log('placeInLine: ', Bean.stringify(placeInLine));
          console.log('minfillaount: ', toStringBaseUnitBN(new BigNumber(1), PODS.decimals));

          call = beanstalk.farm(data, { value: Eth.stringify(value) });
        }

        const txn = await call;
        txToast.confirming(txn);

        const receipt = await txn.wait();
        await Promise.all([refetchFarmerBalances(), refetchFarmerMarket(), fetchFarmerMarketItems()]);
        txToast.success(receipt);
        formActions.resetForm();
      } catch (err) {
        txToast?.error(err) || toast.error(parseError(err));
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
      Eth
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
          <TxnSettings placement="condensed-form-top-right">
            <SettingInput
              name="settings.slippage"
              label="Slippage Tolerance"
              endAdornment="%"
            />
          </TxnSettings>
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

export default CreateOrder;
