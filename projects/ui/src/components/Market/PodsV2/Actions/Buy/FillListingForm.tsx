import { Stack } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import BigNumber from 'bignumber.js';
import { BeanstalkSDK, FarmFromMode, FarmToMode } from '@beanstalk/sdk';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import TransactionToast from '~/components/Common/TxnToast';
import {
  FormState,
  SettingInput,
  SlippageSettingsFragment,
  SmartSubmitButton,
  TokenQuoteProvider,
  TokenSelectDialog,
  TxnSeparator,
  TxnSettings,
} from '~/components/Common/Form';
import Token, { ERC20Token, NativeToken } from '~/classes/Token';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import { QuoteHandler } from '~/hooks/ledger/useQuote';
import useTokenMap from '~/hooks/chain/useTokenMap';
import useToggle from '~/hooks/display/useToggle';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
import { useSigner } from '~/hooks/ledger/useSigner';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import { Beanstalk } from '~/generated';
import usePreferredToken, {
  PreferredToken,
} from '~/hooks/farmer/usePreferredToken';
import { useFetchFarmerField } from '~/state/farmer/field/updater';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import {
  displayBN,
  displayTokenAmount,
  MinBN,
  toTokenUnitsBN,
  transform,
} from '~/util';
import { AppState } from '~/state';
import { BEAN, ETH, PODS, WETH } from '~/constants/tokens';
import { ZERO_BN } from '~/constants';
import { PodListing } from '~/state/farmer/market';
import { optimizeFromMode } from '~/util/Farm';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import useSdk from '~/hooks/sdk';
import useAccount from '~/hooks/ledger/useAccount';

export type FillListingFormValues = FormState & {
  settings: SlippageSettingsFragment;
  maxAmountIn: BigNumber | undefined;
};

const FillListingV2Form: FC<
  FormikProps<FillListingFormValues> & {
    podListing: PodListing;
    contract: Beanstalk;
    handleQuote: QuoteHandler;
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

  /// Chain
  const getChainToken = useGetChainToken();
  const Bean = getChainToken(BEAN);
  const Eth = getChainToken<NativeToken>(ETH);
  const Weth = getChainToken<ERC20Token>(WETH);
  const erc20TokenMap = useTokenMap<ERC20Token | NativeToken>([
    BEAN,
    ETH,
    WETH,
  ]);

  /// Farmer
  const balances = useFarmerBalances();

  /// Beanstalk
  const beanstalkField = useSelector<AppState, AppState['_beanstalk']['field']>(
    (state) => state._beanstalk.field
  );

  /// Derived
  const tokenIn = values.tokens[0].token;
  const amountIn = values.tokens[0].amount;
  const tokenOut = Bean;
  const amountOut =
    tokenIn === tokenOut // Beans
      ? values.tokens[0].amount
      : values.tokens[0].amountOut;
  const tokenInBalance = balances[tokenIn.address];

  const isReady = amountIn?.gt(0) && amountOut?.gt(0);
  const isSubmittable = isReady;
  const podsPurchased = amountOut?.div(podListing.pricePerPod) || ZERO_BN;
  const placeInLine = podListing.index.minus(beanstalkField.harvestableIndex);

  /// Token select
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

  /// FIXME: standardized `maxAmountIn` approach?
  /// When `tokenIn` or `tokenOut` changes, refresh the
  /// max amount that the user can input of `tokenIn`.
  useEffect(() => {
    (async () => {
      if (!account) return;

      // Maximum BEAN precision is 6 decimals. remainingAmount * pricePerPod may
      // have more decimals, so we truncate at 6.
      const maxBeans = podListing.remainingAmount
        .times(podListing.pricePerPod)
        .dp(BEAN[1].decimals, BigNumber.ROUND_DOWN);

      if (maxBeans.gt(0)) {
        if (tokenIn === Bean) {
          /// 1 POD is consumed by 1 BEAN
          setFieldValue('maxAmountIn', maxBeans);
        } else if (tokenIn === Eth || tokenIn === Weth) {
          /// Estimate how many ETH it will take to buy `maxBeans` BEAN.
          /// TODO: across different forms of `tokenIn`.
          /// This (obviously) only works for Eth and Weth.
          const estimate = await sdk.swap
            .buildSwap(
              tokenIn === Eth ? sdk.tokens.ETH : sdk.tokens.WETH,
              sdk.tokens.BEAN,
              account!,
              FarmFromMode.EXTERNAL,
              FarmToMode.EXTERNAL
            )
            .estimateReversed(
              transform(maxBeans, 'tokenValue', sdk.tokens.BEAN)
            );

          setFieldValue(
            'maxAmountIn',
            toTokenUnitsBN(estimate.toBlockchain(), tokenIn.decimals)
          );
        } else {
          throw new Error(`Unsupported tokenIn: ${tokenIn.symbol}`);
        }
      } else {
        setFieldValue('maxAmountIn', ZERO_BN);
      }
    })();
  }, [
    Bean,
    Eth,
    Weth,
    account,
    podListing.pricePerPod,
    podListing.remainingAmount,
    setFieldValue,
    tokenIn,
    sdk,
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
      />
      <Stack gap={1}>
        <TokenQuoteProvider
          key="tokens.0"
          name="tokens.0"
          tokenOut={Bean}
          disabled={!values.maxAmountIn}
          max={MinBN(
            values.maxAmountIn || ZERO_BN,
            tokenInBalance?.total || ZERO_BN
          )}
          balance={tokenInBalance || undefined}
          state={values.tokens[0]}
          showTokenSelect={handleOpen}
          handleQuote={handleQuote}
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
                    {displayTokenAmount(amountOut!, Bean)} /{' '}
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

const PREFERRED_TOKENS: PreferredToken[] = [
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
];

const FillListingForm: FC<{
  podListing: PodListing;
}> = ({ podListing }) => {
  /// Tokens
  const getChainToken = useGetChainToken();
  const Bean = getChainToken(BEAN);
  const Eth = getChainToken(ETH);
  const Weth = getChainToken(WETH);

  /// Ledger
  const { data: signer } = useSigner();
  const beanstalk = useBeanstalkContract(signer);
  const sdk = useSdk();

  /// Farmer
  const account = useAccount();
  const balances = useFarmerBalances();
  const [refetchFarmerField] = useFetchFarmerField();
  const [refetchFarmerBalances] = useFetchFarmerBalances();

  /// Form
  const middleware = useFormMiddleware();
  const baseToken = usePreferredToken(PREFERRED_TOKENS, 'use-best');
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
  const handleQuote = useCallback<QuoteHandler>(
    async (_tokenIn, _amountIn, _tokenOut) => {
      const tokenIn = _tokenIn === Eth ? sdk.tokens.ETH : sdk.tokens.WETH;
      const from =
        _tokenIn === Weth
          ? optimizeFromMode(_amountIn, balances[Weth.address])
          : FarmFromMode.EXTERNAL;
      const amountIn = transform(_amountIn, 'tokenValue', tokenIn);

      const swap = sdk.swap.buildSwap(tokenIn, sdk.tokens.BEAN, from);

      const estimate = await swap.estimate(amountIn);

      return {
        amountOut: toTokenUnitsBN(estimate.toBlockchain(), _tokenOut.decimals),
        value: transform(estimate, 'ethers'),
      };
    },
    [Eth, Weth, balances, sdk]
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
        if (!signer) throw new Error('Connect a wallet');
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
              PODS
            )}`
          );

        const data: string[] = [];
        const amountPods = amountBeans.div(podListing.pricePerPod);

        let farm;
        let tokenInNew;
        let finalFromMode: FarmFromMode;

        txToast = new TransactionToast({
          loading: `Buying ${displayTokenAmount(
            amountPods,
            PODS
          )} for ${displayTokenAmount(amountBeans, Bean)}...`,
          success: 'Fill successful.',
        });

        /// Fill Listing directly from BEAN
        if (tokenIn === Bean) {
          // No swap occurs, so we know exactly how many beans are going in.
          // We can select from INTERNAL, EXTERNAL, INTERNAL_EXTERNAL.
          finalFromMode = optimizeFromMode(amountBeans, balances[Bean.address]);
          farm = sdk.farm.create();
          tokenInNew = sdk.tokens.BEAN; // FIXME
        } else { /// Swap to BEAN and buy
          // Require a quote
          if (!formData.amountOut)
            throw new Error(`No quote available for ${formData.token.symbol}`);

          tokenInNew = tokenIn === Eth ? sdk.tokens.ETH : sdk.tokens.WETH;

          const swap = sdk.swap.buildSwap(
            tokenInNew,
            sdk.tokens.BEAN,
            optimizeFromMode(formData.amount, balances[tokenIn.address])
          );

          // At the end of the Swap step, the assets will be in our INTERNAL balance.
          // The Swap decides where to route them from (see handleQuote).
          finalFromMode = FarmFromMode.INTERNAL_TOLERANT;
          farm = swap.getFarm();
        }

        console.debug(
          `[FillListing] using FarmFromMode = ${finalFromMode}`,
          podListing
        );

        // If not using Bean, add Bean approval step after conversion
        if (tokenIn !== Bean) {
          farm.add((amountInStep) => 
            beanstalk.interface.encodeFunctionData('approveToken', [
              beanstalk.address,
              Bean.address,
              amountInStep
            ])
          );
        }

        farm.add((amountInStep) =>
          beanstalk.interface.encodeFunctionData('fillPodListing', [
            {
              account: podListing.account,
              index: Bean.stringify(podListing.index),
              start: Bean.stringify(podListing.start),
              amount: Bean.stringify(podListing.amount),
              pricePerPod: Bean.stringify(podListing.pricePerPod),
              maxHarvestableIndex: Bean.stringify(
                podListing.maxHarvestableIndex
              ),
              minFillAmount: Bean.stringify(podListing.minFillAmount || 0), // minFillAmount for listings is measured in Beans
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

        const amountInTV = transform(amountIn, 'tokenValue', tokenInNew);
        const txn = await farm.execute(amountInTV, { slippage: 0.1 });

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
      Eth,
      refetchFarmerField,
      refetchFarmerBalances,
      balances,
      sdk,
      beanstalk.interface,
      beanstalk.address
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
