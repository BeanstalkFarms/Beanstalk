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
import useFarmerFormTxnBalances from '~/hooks/farmer/form-txn/useFarmerFormTxnBalances';
import FormTxnsSecondaryOptions from '~/components/Common/Form/FormTxnsSecondaryOptions';
import { FormTxn, FormTxnBuilder } from '~/util/FormTxns';
import useFarmerFormTxns from '~/hooks/farmer/form-txn/useFarmerFormTxns';
import { AppState } from '~/state';
import useResetFormFarmActions from '~/hooks/form/useResetFormFarmActions';
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
  };

type BuyQuoteHandlerParams = {
  fromMode: FarmFromMode;
};

const defaultFarmActionsFormState = {
  preset: 'claim',
  primary: undefined,
  secondary: undefined,
  additionalAmount: undefined,
};

const disableEnrootWhenEth = {
  action: FormTxn.ENROOT,
  reason:
    'Enrooting while using ETH to Buy Fertilizer is currently not supported',
};

// ---------------------------------------------------

const BuyForm: FC<
  FormikProps<BuyFormValues> & {
    handleQuote: QuoteHandlerWithParams<BuyQuoteHandlerParams>;
    balances: FarmerBalances;
    tokenOut: ERC20Token;
    remainingFertilizer: BigNumber;
  }
> = ({
  // Formik
  values,
  setFieldValue,
  isSubmitting,
  // Custom
  handleQuote,
  balances,
  tokenOut: token,
}) => {
  const sdk = useSdk();
  const additionalBalances = useFarmerFormTxnBalances();

  const formRef = useRef<HTMLDivElement>(null);

  const tokenMap = useTokenMap<ERC20Token | NativeToken>([
    sdk.tokens.BEAN,
    sdk.tokens.USDC,
    sdk.tokens.ETH,
  ]);
  const { usdc, fert, humidity, actions } = useFertilizerSummary(values.tokens);

  // Extract
  const isValid = fert?.gt(0);

  const tokenIn = values.tokens[0].token;

  // Reset the form farmActions whenever the tokenIn changes
  useResetFormFarmActions(tokenIn, defaultFarmActionsFormState);

  const formTxnsActions = useFarmerFormTxnsActions({
    showGraphicOnClaim: sdk.tokens.BEAN.equals(tokenIn),
  });

  // Handlers
  const [showTokenSelect, handleOpen, handleClose] = useToggle();
  const handleSelectTokens = useCallback(
    (_tokens: Set<Token>) => {
      setFieldValue(
        'tokens',
        Array.from(_tokens).map((t) => ({ token: t, amount: null }))
      );
    },
    [setFieldValue]
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
    return isEth ? [disableEnrootWhenEth] : undefined;
  }, [tokenIn, sdk.tokens.ETH]);

  return (
    <FormWithDrawer autoComplete="off" noValidate siblingRef={formRef}>
      <Stack gap={1} ref={formRef}>
        {showTokenSelect && (
          <TokenSelectDialogNew
            open={showTokenSelect}
            handleClose={handleClose}
            selected={values.tokens}
            handleSubmit={handleSelectTokens}
            balances={balances}
            tokenList={Object.values(tokenMap)}
            mode={TokenSelectMode.SINGLE}
            balanceFrom={values.balanceFrom}
            setBalanceFrom={handleSetBalanceFrom}
            applicableBalances={additionalBalances.balances}
          />
        )}

        {/* Form Contents */}
        {values.tokens.map((state, index) => {
          const isETH = state.token.symbol === 'ETH';
          const balanceKey = isETH ? 'eth' : state.token.address;

          return (
            <TokenQuoteProviderWithParams<BuyQuoteHandlerParams>
              key={state.token.address}
              name={`tokens.${index}`}
              state={state}
              tokenOut={token}
              balance={balances[balanceKey] || undefined}
              showTokenSelect={handleOpen}
              handleQuote={handleQuote}
              balanceFrom={values.balanceFrom}
              params={quoteProviderParams}
            />
          );
        })}
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
                <FormTxnsSecondaryOptions disabledActions={disabledActions} />
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
        <ClaimBeanDrawerContent txnName="Buy Fertilizer" />
      </FormWithDrawer.Drawer>
    </FormWithDrawer>
  );
};

const Buy: FC<{}> = () => {
  ///
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
  const preferredTokens: PreferredToken[] = useMemo(() => {
    const tokens = sdk.tokens;

    return [
      { token: tokens.BEAN, minimum: new BigNumber(1) },
      { token: tokens.USDC, minimum: new BigNumber(1) },
      { token: tokens.ETH, minimum: new BigNumber(0.01) },
    ];
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
      settings: {
        slippage: 0.1,
      },
    }),
    [baseToken]
  );

  /// Handlers
  // Doesn't get called if tokenIn === tokenOut
  // aka if the user has selected USDC as input
  const handleQuote = useCallback<
    QuoteHandlerWithParams<BuyQuoteHandlerParams>
  >(
    async (tokenIn, _amountIn, _tokenOut, { fromMode: _fromMode }) => {
      if (!account) throw new Error('No account connected');
      const { ETH, WETH, BEAN, USDC } = sdk.tokens;
      const isEth = tokenIn.symbol === ETH.symbol;
      const isWeth = WETH.equals(tokenIn);

      if (!isEth && !isWeth && !BEAN.equals(tokenIn) && !USDC.equals(tokenIn)) {
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
    [account, sdk]
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

        // console.log(values);

        const formData = values.tokens[0];
        const farmActions = values.farmActions;
        const tokenIn = formData.token; // input token
        const amountIn = formData.amount; // input amount in form
        const amountUsdc = (
          USDC.equals(tokenIn) ? amountIn : formData.amountOut
        )?.dp(0, BigNumber.ROUND_DOWN);
        if (!amountIn || !amountUsdc) throw new Error('An error occured');
        // const slippage = values.settings.slippage;

        const additionalAmount = BEAN.amount(
          farmActions.additionalAmount?.toString() || '0'
        );
        const totalClaimAmount = BEAN.amount(
          farmActions.surplus?.max?.toString() || '0'
        );
        const transferDestination =
          farmActions.surplus?.destination || FarmToMode.INTERNAL;

        // console.log('additionalAmount: ', additionalAmount.toHuman());

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
          console.log('additional + using bean or eth');
          if (ethIn) {
            const swap = sdk.swap.buildSwap(
              ETH,
              BEAN,
              account,
              fromMode,
              FarmToMode.INTERNAL
            );
            buyFert.add([...swap.getFarm().generators]);
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
          console.log('additional + using USDC');
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
          0.1,
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
          remainingFertilizer={remaining}
          {...formikProps}
        />
      )}
    </Formik>
  );
};

export default Buy;

/*

beanMinLP:  961417
usdcMinLP:  1109393
minLP:  500097636695493844
strBN:  1
withSlipMinLP:  499597539058798350


beanMinLP:  866616
BuyOld.tsx:379 usdcMinLP:  1000000
BuyOld.tsx:380 minLP:  450785088202864313
BuyOld.tsx:381 strBN:  1
BuyOld.tsx:382 withSlipMinLP:  450334303114661448



        const _usdcOut = await buyFert.estimate(
          tokenIn.amount(amountIn.toString())
        );

        const usdcOut = tokenValueToBN(USDC.fromBlockchain(_usdcOut)).dp(
          0,
          BigNumber.ROUND_DOWN
        );

        // console.log('usdcOut: ', USDC.fromBlockchain(usdcOut).toHuman());
        // console.log('to string units bn: ', toStringBaseUnitBN(amountUsdc, 0));

        const beanOutBN = USDC.fromHuman(
          usdcOut.times(0.866616).toString()
        ).blockchainString;
        const usdcOutBN = USDC.fromHuman(usdcOut.toString()).blockchainString;

        const _minLP = await curve.zap.callStatic.calc_token_amount(
          curve.pools.beanCrv3.address,
          [
            // 0.866616 is the ratio to add USDC/Bean at such that post-exploit
            // delta B in the Bean:3Crv pool with A=1 equals the pre-export
            // total delta B times the haircut. Independent of the haircut %.
            beanOutBN, // BEAN
            0, // DAI
            // amountInUSDC.blockchainString, // USDC
            usdcOutBN, // USDC
            0, // USDT
          ],
          true, // _is_deposit
          { gasLimit: 10000000 }
        );

        const amountInUSDC = USDC.fromHuman(amountUsdc.toString());
        const floored = toStringBaseUnitBN(tokenValueToBN(amountInUSDC), 0);

        // console.log("amountInUSDC: ", amountInUSDC.toHuman());
        console.log('amountInUSDC: ', amountUsdc.toString());

        console.log('beanMinLP: ', beanOutBN);
        console.log('usdcMinLP: ', usdcOutBN);
        console.log('minLP: ', minLP.toString());
        console.log('strBN: ', floored);
        console.log(
          'withSlipMinLP: ',
          FarmWorkflow.slip(minLP, 0.1).toString()
        );






 */
