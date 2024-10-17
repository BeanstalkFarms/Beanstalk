import { Stack } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import React, { useCallback, useEffect, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import {
  BeanstalkSDK,
  FarmFromMode,
  FarmToMode,
  ERC20Token,
  NativeToken,
} from '@beanstalk/sdk';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import TransactionToast from '~/components/Common/TxnToast';
import {
  FormStateNew,
  SettingInput,
  SlippageSettingsFragment,
  SmartSubmitButton,
  TokenSelectDialog,
  TxnSeparator,
  TxnSettings,
} from '~/components/Common/Form';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import useTokenMap from '~/hooks/chain/useTokenMap';
import useToggle from '~/hooks/display/useToggle';
import { useSigner } from '~/hooks/ledger/useSigner';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import { Beanstalk } from '~/generated';
import usePreferredToken from '~/hooks/farmer/usePreferredToken';
import { useFetchFarmerField } from '~/state/farmer/field/updater';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import {
  displayBN,
  displayTokenAmount,
  getTokenIndex,
  MinBN,
  tokenIshEqual,
  toTokenUnitsBN,
  transform,
} from '~/util';
import { ZERO_BN } from '~/constants';
import { PodListing } from '~/state/farmer/market';
import { optimizeFromMode } from '~/util/Farm';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import useSdk from '~/hooks/sdk';
import useAccount from '~/hooks/ledger/useAccount';
import { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';
import {
  TokenInstance,
  useBalanceTokens,
  useBeanstalkTokens,
} from '~/hooks/beanstalk/useTokens';
import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';
import { useAppSelector } from '~/state';
import { useMinTokensIn } from '~/hooks/beanstalk/useMinTokensIn';
import TokenQuoteProviderWithParams from '~/components/Common/Form/TokenQuoteProviderWithParams';
import { getBeanSwapOperationWithQuote } from '~/lib/Beanstalk/swap';

export type FillListingFormValues = FormStateNew & {
  settings: SlippageSettingsFragment;
  maxAmountIn: BigNumber | undefined;
};

type QuoterHandlerParams = {
  slippage: number;
};

type FillListingQuoter = QuoteHandlerWithParams<QuoterHandlerParams>;

const FillListingV2Form: FC<
  FormikProps<FillListingFormValues> & {
    podListing: PodListing;
    contract: Beanstalk;
    handleQuote: FillListingQuoter;
    account?: string;
    sdk: BeanstalkSDK;
  }
> = ({
  // Formik
  values,
  setFieldValue,
  //
  podListing,
  contract,
  handleQuote,
  account,
  sdk,
}) => {
  /// State
  const [isTokenSelectVisible, handleOpen, hideTokenSelect] = useToggle();

  // tokens
  const { BEAN, ETH, WETH } = useBalanceTokens();
  const { PODS } = useBeanstalkTokens();

  const tokenList = useMemo(() => [BEAN, ETH, WETH], [BEAN, ETH, WETH]);
  const erc20TokenMap = useTokenMap<ERC20Token | NativeToken>(tokenList);

  /// Farmer
  const balances = useFarmerBalances();

  /// Beanstalk
  const beanstalkField = useAppSelector((s) => s._beanstalk.field);

  /// Derived
  const tokenIn = values.tokens[0].token;
  const amountIn = values.tokens[0].amount;
  const tokenOut = BEAN;
  const amountOut =
    tokenIn === tokenOut // Beans
      ? values.tokens[0].amount
      : values.tokens[0].amountOut;
  const tokenInBalance = balances[getTokenIndex(tokenIn)];
  const slippage = values.settings.slippage;

  const isReady = amountIn?.gt(0) && amountOut?.gt(0);
  const isSubmittable = isReady;
  const podsPurchased = amountOut?.div(podListing.pricePerPod) || ZERO_BN;
  const placeInLine = podListing.index.minus(beanstalkField.harvestableIndex);

  const minAmounIn = useMinTokensIn(tokenIn, tokenOut);

  const quoterParams = useMemo(() => ({ slippage }), [slippage]);

  /// Token select
  const handleSelectTokens = useCallback(
    (_tokens: Set<TokenInstance>) => {
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

  /// FIXME: standardized `maxAmountIn` approach?
  /// When `tokenIn` or `tokenOut` changes, refresh the
  /// max amount that the user can input of `tokenIn`.
  useEffect(() => {
    (async () => {
      if (!account) return;

      const _pricePerPod = toTokenUnitsBN(podListing.pricePerPod, 0);
      const _remaining = toTokenUnitsBN(podListing.remainingAmount, 0);
      // Maximum BEAN precision is 6 decimals. remainingAmount * pricePerPod may
      // have more decimals, so we truncate at 6.

      let maxBeans = _remaining.times(_pricePerPod).dp(6, BigNumber.ROUND_UP);
      const diff = maxBeans
        .div(podListing.pricePerPod)
        .dp(6, BigNumber.ROUND_DOWN)
        .minus(podListing.remainingAmount);

      let loop = 0;
      let found = false;

      do {
        let adjustedMaxBeans;
        if (diff.isPositive()) {
          adjustedMaxBeans = maxBeans.minus(new BigNumber(loop * 0.0000001));
        } else {
          adjustedMaxBeans = maxBeans.plus(new BigNumber(loop * 0.0000001));
        }
        const adjustedPodAmount = adjustedMaxBeans
          .div(podListing.pricePerPod)
          .dp(6, BigNumber.ROUND_DOWN);
        if (adjustedPodAmount.eq(podListing.remainingAmount)) {
          maxBeans = adjustedMaxBeans;
          found = true;
        } else {
          loop += 1;
        }
      } while (found === false && loop < 50);

      if (maxBeans.gt(0)) {
        if (tokenIshEqual(tokenIn, BEAN)) {
          /// 1 POD is consumed by 1 BEAN
          setFieldValue('maxAmountIn', maxBeans);
        } else if (!tokenIshEqual(tokenIn, BEAN)) {
          /// Estimate how many ETH it will take to buy `maxBeans` BEAN.
          /// TODO: across different forms of `tokenIn`.
          /// This (obviously) only works for Eth and Weth.
          const estimate = await sdk.beanSwap.quoter.route(
            sdk.tokens.BEAN,
            tokenIn,
            transform(maxBeans, 'tokenValue', sdk.tokens.BEAN),
            slippage
          );

          setFieldValue(
            'maxAmountIn',
            transform(estimate.minBuyAmount, 'bnjs', tokenIn)
          );
        } else {
          throw new Error(`Unsupported tokenIn: ${tokenIn.symbol}`);
        }
      } else {
        setFieldValue('maxAmountIn', ZERO_BN);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    BEAN,
    account,
    podListing.pricePerPod,
    podListing.remainingAmount,
    tokenIn,
    sdk,
    slippage,
  ]);

  return (
    <Form autoComplete="off">
      <TokenSelectDialog
        open={isTokenSelectVisible}
        handleClose={hideTokenSelect}
        handleSubmit={handleSelectTokens}
        selected={values.tokens}
        balances={balances}
        tokenList={Object.values(erc20TokenMap)}
        mode={TokenSelectMode.SINGLE}
        balanceFrom={BalanceFrom.TOTAL}
      />
      <Stack gap={1}>
        <TokenQuoteProviderWithParams<{ slippage: number }>
          key="tokens.0"
          name="tokens.0"
          tokenOut={BEAN}
          disabled={!values.maxAmountIn}
          min={minAmounIn}
          max={MinBN(
            values.maxAmountIn || ZERO_BN,
            tokenInBalance?.total || ZERO_BN
          )}
          params={quoterParams}
          balance={tokenInBalance || undefined}
          state={values.tokens[0]}
          showTokenSelect={handleOpen}
          handleQuote={handleQuote}
          balanceFrom={BalanceFrom.TOTAL}
          size="small"
        />
        {isReady ? (
          <>
            <TxnSeparator mt={0} />
            {/* Pods Output */}
            <TokenOutput size="small">
              <TokenOutput.Row
                token={sdk.tokens.PODS}
                amount={podsPurchased}
                amountTooltip={
                  <>
                    {displayTokenAmount(amountOut!, BEAN)} /{' '}
                    {displayBN(podListing.pricePerPod)} Beans per Pod
                    <br />= {displayTokenAmount(podsPurchased, PODS)}
                  </>
                }
                amountSuffix={` @ ${displayBN(placeInLine)}`}
                size="small"
              />
            </TokenOutput>
            {/* <Box>
              <Accordion variant="outlined">
                <StyledAccordionSummary title="Transaction Details" />
                <AccordionDetails>
                  <TxnPreview
                    actions={[
                      tokenIn === Bean ? undefined : {
                        type: ActionType.SWAP,
                        tokenIn,
                        tokenOut,
                        /// FIXME: these are asserted by !!isReady
                        amountIn:   amountIn!,
                        amountOut:  amountOut!,
                      },
                      {
                        type: ActionType.BUY_PODS,
                        podAmount: podsPurchased,
                        pricePerPod: podListing.pricePerPod,
                        placeInLine: placeInLine
                      },
                    ]}
                  />
                </AccordionDetails>
              </Accordion>
            </Box> */}
          </>
        ) : null}
        <SmartSubmitButton
          type="submit"
          variant="contained"
          color="primary"
          disabled={!isSubmittable}
          contract={contract}
          tokens={values.tokens}
          mode="auto"
        >
          Fill
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

// ---------------------------------------------------

const useFillListingPreferredTokens = () => {
  const { BEAN, ETH, WETH } = useBalanceTokens();

  return useMemo(
    () => [
      {
        token: BEAN,
        minimum: new BigNumber(1), // $1
      },
      {
        token: ETH,
        minimum: new BigNumber(0.001), // ~$2-4
      },
      {
        token: WETH,
        minimum: new BigNumber(0.001), // ~$2-4
      },
    ],
    [BEAN, ETH, WETH]
  );
};

const FillListingForm: FC<{
  podListing: PodListing;
}> = ({ podListing }) => {
  /// Tokens
  const preferredTokens = useFillListingPreferredTokens();

  /// Ledger
  const { data: signer } = useSigner();
  const beanstalk = useBeanstalkContract(signer);
  const sdk = useSdk();

  const Bean = sdk.tokens.BEAN;

  /// Farmer
  const account = useAccount();
  const balances = useFarmerBalances();
  const [refetchFarmerField] = useFetchFarmerField();
  const [refetchFarmerBalances] = useFetchFarmerBalances();

  /// Form
  const middleware = useFormMiddleware();
  const baseToken = usePreferredToken(preferredTokens, 'use-best');
  const initialValues: FillListingFormValues = useMemo(
    () => ({
      settings: {
        slippage: 0.1,
      },
      tokens: [
        {
          token: baseToken as ERC20Token | NativeToken,
          amount: undefined,
        },
      ],
      maxAmountIn: undefined,
    }),
    [baseToken]
  );

  /// Handlers
  /// Does not execute for _tokenIn === BEAN
  const handleQuote: FillListingQuoter = useCallback(
    async (_tokenIn, _amountIn, _tokenOut, { slippage }) => {
      if (!account) {
        throw new Error('Signer required');
      }

      const amountIn = transform(_amountIn, 'tokenValue', _tokenIn);

      const quote = await sdk.beanSwap.quoter.route(
        _tokenIn,
        _tokenOut,
        amountIn,
        slippage
      );

      return {
        amountOut: transform(quote.buyAmount, 'bnjs', _tokenOut),
        beanSwapQuote: quote,
      };
    },
    [sdk, account]
  );

  const onSubmit = useCallback(
    async (
      values: FillListingFormValues,
      formActions: FormikHelpers<FillListingFormValues>
    ) => {
      let txToast;
      try {
        middleware.before();
        const formData = values.tokens[0];
        const tokenIn = formData.token;
        const amountIn = formData.amount;
        const amountBeans =
          tokenIn === Bean ? formData.amount : formData.amountOut;

        // Checks
        if (!podListing) throw new Error('No Pod Listing found');
        if (!signer || !account) throw new Error('Connect a wallet');
        if (values.tokens.length > 1)
          throw new Error('Only one input token supported');
        if (
          !formData.amount ||
          !amountBeans ||
          amountBeans.eq(0) ||
          !amountIn ||
          amountIn.eq(0)
        )
          throw new Error('No amount set');
        if (amountBeans.lt(podListing.minFillAmount))
          throw new Error(
            `This Listing requires a minimum fill amount of ${displayTokenAmount(
              podListing.minFillAmount,
              sdk.tokens.PODS
            )}`
          );

        const data: string[] = [];
        const amountPods = amountBeans.div(podListing.pricePerPod);

        let farm;
        let finalFromMode: FarmFromMode;

        txToast = new TransactionToast({
          loading: `Buying ${displayTokenAmount(
            amountPods,
            sdk.tokens.PODS
          )} for ${displayTokenAmount(amountBeans, Bean)}...`,
          success: 'Fill successful.',
        });

        /// Fill Listing directly from BEAN
        if (tokenIshEqual(tokenIn, Bean)) {
          // No swap occurs, so we know exactly how many beans are going in.
          // We can select from INTERNAL, EXTERNAL, INTERNAL_EXTERNAL.
          finalFromMode = optimizeFromMode(
            amountBeans,
            balances[getTokenIndex(Bean)]
          );
          farm = sdk.farm.create();
          // tokenInNew = sdk.tokens.BEAN; // FIXME
        } else {
          farm = sdk.farm.createAdvancedFarm();
          /// Swap to BEAN and buy
          // Require a quote
          if (!formData.amountOut)
            throw new Error(`No quote available for ${formData.token.symbol}`);

          const swapFromMode = optimizeFromMode(
            amountIn,
            balances[getTokenIndex(tokenIn)]
          );
          console.log('swapFromMode', swapFromMode);

          const swap = getBeanSwapOperationWithQuote(
            formData.beanSwapQuote,
            tokenIn,
            sdk.tokens.BEAN,
            amountIn,
            amountBeans,
            values.settings.slippage,
            account,
            swapFromMode,
            FarmToMode.INTERNAL
          );

          if (!swap) {
            throw new Error('No swap found');
          }

          farm.add([...swap.getFarm().generators]);

          // At the end of the Swap step, the assets will be in our INTERNAL balance.
          // The Swap decides where to route them from (see handleQuote).
          finalFromMode = FarmFromMode.INTERNAL_TOLERANT;
        }

        console.debug(
          `[FillListing] using FarmFromMode = ${finalFromMode}`,
          podListing
        );

        const to6DecimalStr = (amount: BigNumber | number) => {
          const amountStr = amount.toString();
          return Bean.fromHuman(amountStr).toBlockchain();
        };

        farm.add((amountInStep) =>
          beanstalk.interface.encodeFunctionData('fillPodListing', [
            {
              lister: podListing.account,
              fieldId: '0',
              index: to6DecimalStr(podListing.index),
              start: to6DecimalStr(podListing.start),
              podAmount: to6DecimalStr(podListing.amount),
              pricePerPod: to6DecimalStr(podListing.pricePerPod),
              maxHarvestableIndex: to6DecimalStr(
                podListing.maxHarvestableIndex
              ),
              minFillAmount: to6DecimalStr(podListing.minFillAmount || 0), // minFillAmount for listings is measured in Beans
              mode: podListing.mode,
            },
            amountInStep, // FIXME: number type?
            finalFromMode,
          ])
        );

        console.debug('[FillListing] ', {
          length: data.length,
          data,
        });

        const amountInTV = transform(amountIn, 'tokenValue', tokenIn);
        const txn = await farm.execute(amountInTV, {
          slippage: values.settings.slippage,
        });

        txToast.confirming(txn);
        const receipt = await txn.wait();

        await Promise.all([
          refetchFarmerField(), // refresh plots; increment pods
          refetchFarmerBalances(), // decrement balance of tokenIn
        ]);
        txToast.success(receipt);
        formActions.resetForm();
      } catch (err) {
        console.error(err);
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
      Bean,
      podListing,
      signer,
      refetchFarmerField,
      refetchFarmerBalances,
      balances,
      sdk,
      beanstalk.interface,
      account,
    ]
  );

  return (
    <Formik<FillListingFormValues>
      enableReinitialize
      initialValues={initialValues}
      onSubmit={onSubmit}
    >
      {(formikProps: FormikProps<FillListingFormValues>) => (
        <>
          <TxnSettings placement="condensed-form-top-right">
            <SettingInput
              name="settings.slippage"
              label="Slippage Tolerance"
              endAdornment="%"
            />
          </TxnSettings>
          <FillListingV2Form
            podListing={podListing}
            handleQuote={handleQuote}
            contract={beanstalk}
            account={account}
            sdk={sdk}
            {...formikProps}
          />
        </>
      )}
    </Formik>
  );
};

export default FillListingForm;
