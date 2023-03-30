import {
  ERC20Token,
  FarmFromMode,
  FarmToMode,
  NativeToken,
  StepGenerator,
  Token,
} from '@beanstalk/sdk';
import { Box, Divider, Link, Stack, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { Formik, FormikHelpers, FormikProps } from 'formik';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { IconSize } from '~/components/App/muiTheme';
import WarningAlert from '~/components/Common/Alert/WarningAlert';
import {
  BalanceFromFragment,
  FormStateNew,
  FormTxnsFormState,
  SettingInput,
  SlippageSettingsFragment,
  SmartSubmitButton,
  TxnPreview,
  TxnSeparator,
  TxnSettings,
} from '~/components/Common/Form';
import {
  BalanceFrom,
  balanceFromToMode,
} from '~/components/Common/Form/BalanceFromRow';
import ClaimBeanDrawerContent from '~/components/Common/Form/FormTxn/ClaimBeanDrawerContent';
import ClaimBeanDrawerToggle from '~/components/Common/Form/FormTxn/ClaimBeanDrawerToggle';
import FormTxnsSecondaryOptions from '~/components/Common/Form/FormTxnsSecondaryOptions';
import FormWithDrawer from '~/components/Common/Form/FormWithDrawer';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import TokenQuoteProviderWithParams from '~/components/Common/Form/TokenQuoteProviderWithParams';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import TokenSelectDialogNew from '~/components/Common/Form/TokenSelectDialogNew';
import TokenIcon from '~/components/Common/TokenIcon';
import TxnAccordion from '~/components/Common/TxnAccordion';
import TransactionToast from '~/components/Common/TxnToast';
import { ZERO_BN } from '~/constants';
import usePrice from '~/hooks/beanstalk/usePrice';
import useTemperature from '~/hooks/beanstalk/useTemperature';
import useTokenMap from '~/hooks/chain/useTokenMap';
import useToggle from '~/hooks/display/useToggle';
import useFarmerFormTxnsActions from '~/hooks/farmer/form-txn/useFarmerFormTxnActions';
import useFarmerFormTxns from '~/hooks/farmer/form-txn/useFarmerFormTxns';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import usePreferredToken, {
  PreferredToken,
} from '~/hooks/farmer/usePreferredToken';
import useResetFormFarmActions from '~/hooks/form/useResetFormFarmActions';
import useAccount from '~/hooks/ledger/useAccount';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';
import useSdk, { getNewToOldToken } from '~/hooks/sdk';
import { AppState } from '~/state';
import { useFetchPools } from '~/state/bean/pools/updater';
import { useFetchBeanstalkField } from '~/state/beanstalk/field/updater';
import { FC } from '~/types';
import { displayBN, displayFullBN, MinBN, tokenValueToBN } from '~/util';
import { ActionType } from '~/util/Actions';
import { FormTxn, FormTxnBuilder } from '~/util/FormTxns';

type SowFormValues = FormStateNew & {
  settings: SlippageSettingsFragment;
  maxAmountIn: BigNumber | undefined;
} & FormTxnsFormState &
  BalanceFromFragment;

type SowFormQuoteParams = {
  fromMode: FarmFromMode;
};

const defaultFarmActionsFormState = {
  preset: 'claim',
  primary: undefined,
  secondary: undefined,
  additionalAmount: undefined,
};

const SowForm: FC<
  FormikProps<SowFormValues> & {
    handleQuote: QuoteHandlerWithParams<SowFormQuoteParams>;
    balances: ReturnType<typeof useFarmerBalances>;
    weather: BigNumber;
    soil: BigNumber;
  }
> = ({
  // Formik
  values,
  setFieldValue,
  //
  balances,
  weather,
  soil,
  handleQuote,
}) => {
  const sdk = useSdk();
  const [isTokenSelectVisible, showTokenSelect, hideTokenSelect] = useToggle();
  const formRef = useRef<HTMLDivElement | null>(null);

  /// Chain
  const Bean = sdk.tokens.BEAN;
  const Eth = sdk.tokens.ETH;
  const Weth = sdk.tokens.WETH;
  const erc20TokenMap = useTokenMap<ERC20Token | NativeToken>([
    Bean,
    Eth,
    Weth,
  ]);

  ///
  const beanPrice = usePrice();
  const beanstalkField = useSelector<AppState, AppState['_beanstalk']['field']>(
    (state) => state._beanstalk.field
  );

  /// Derived
  const tokenIn = values.tokens[0].token; // converting from token
  const amountIn = values.tokens[0].amount; // amount of from token
  const tokenOut = Bean; // converting to token
  const amountOut = values.tokens[0].amountOut; // amount of to token
  const maxAmountIn = values.maxAmountIn;
  const tokenInBalance =
    balances[tokenIn.symbol === 'ETH' ? 'eth' : tokenIn.address];

  /// Calculations
  const hasSoil = soil.gt(0);
  const beans = Bean.equals(tokenIn)
    ? amountIn || ZERO_BN
    : amountOut || ZERO_BN;
  const isSubmittable = hasSoil && beans?.gt(0);
  const numPods = beans.multipliedBy(weather.div(100).plus(1));
  const podLineLength = beanstalkField.podIndex.minus(
    beanstalkField.harvestableIndex
  );
  const maxAmountUsed =
    amountIn && maxAmountIn ? amountIn.div(maxAmountIn) : null;

  const beansUsed = (Bean.equals(tokenIn) ? amountIn : amountOut) || ZERO_BN;

  const txnActions = useFarmerFormTxnsActions({
    showGraphicOnClaim: Bean.equals(tokenIn),
  });

  const handleSetBalanceFrom = useCallback(
    (_balanceFrom: BalanceFrom) => {
      setFieldValue('balanceFrom', _balanceFrom);
    },
    [setFieldValue]
  );

  /// Token select
  const handleSelectTokens = useCallback(
    (_tokens: Set<Token>) => {
      // If the user has typed some existing values in,
      // save them. Add new tokens to the end of the list.
      // FIXME: match sorting of erc20TokenList
      const copy = new Set(_tokens);
      const newValue = values.tokens.filter((x) => {
        copy.delete(x.token);
        return _tokens.has(x.token);
      });
      setFieldValue('tokens', [
        ...newValue,
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
      const { BEAN: bean, ETH: eth, WETH: weth } = sdk.tokens;
      if (hasSoil) {
        if (bean.equals(tokenIn)) {
          /// 1 SOIL is consumed by 1 BEAN
          setFieldValue('maxAmountIn', soil);
        } else if (tokenIn.equals(eth) || weth.equals(tokenIn)) {
          /// Estimate how many ETH it will take to buy `soil` BEAN.
          /// TODO: across different forms of `tokenIn`.
          /// This (obviously) only works for Eth and Weth.
          const work = sdk.farm.create();
          work.add(sdk.farm.presets.weth2bean());

          const estimate = await work
            .estimateReversed(bean.amount(soil.toString()))
            .then((result) => tokenIn.fromBlockchain(result));
          console.debug(
            '[Sow][maxAmountIn]: ',
            estimate.toHuman(),
            tokenIn.symbol
          );
          setFieldValue('maxAmountIn', tokenValueToBN(estimate));
        } else {
          throw new Error(`Unsupported tokenIn: ${tokenIn.symbol}`);
        }
      } else {
        setFieldValue('maxAmountIn', ZERO_BN);
      }
    })();
  }, [hasSoil, soil, tokenIn, tokenOut, sdk.tokens, sdk.farm, setFieldValue]);

  const quotehHandlerParams = useMemo(
    () => ({
      fromMode: balanceFromToMode(values.balanceFrom),
    }),
    [values.balanceFrom]
  );

  // Reset the form farmActions whenever the tokenIn changes
  useResetFormFarmActions(tokenIn, defaultFarmActionsFormState);

  const disabledActions = useMemo(() => {
    const isEth = tokenIn.equals(sdk.tokens.ETH);
    const _disabled = isEth
      ? [
          {
            action: FormTxn.ENROOT,
            reason:
              'Enrooting while using ETH to deposit is currently not supported',
          },
        ]
      : undefined;
    return _disabled;
  }, [tokenIn, sdk.tokens.ETH]);

  return (
    <FormWithDrawer autoComplete="off" siblingRef={formRef}>
      <TokenSelectDialogNew
        open={isTokenSelectVisible}
        handleClose={hideTokenSelect}
        handleSubmit={handleSelectTokens}
        selected={values.tokens}
        balances={balances}
        tokenList={Object.values(erc20TokenMap)}
        mode={TokenSelectMode.SINGLE}
        balanceFrom={values.balanceFrom}
        setBalanceFrom={handleSetBalanceFrom}
      />
      <Stack gap={1} ref={formRef}>
        {/* Input Field */}
        <TokenQuoteProviderWithParams<SowFormQuoteParams>
          key="tokens.0"
          name="tokens.0"
          tokenOut={Bean}
          disabled={!hasSoil || !values.maxAmountIn}
          max={MinBN(
            values.maxAmountIn || ZERO_BN,
            tokenInBalance?.total || ZERO_BN
          )}
          balance={tokenInBalance || undefined}
          state={values.tokens[0]}
          showTokenSelect={showTokenSelect}
          handleQuote={handleQuote}
          params={quotehHandlerParams}
          balanceFrom={values.balanceFrom}
          disableTokenSelect={!hasSoil || !values.maxAmountIn}
        />
        {hasSoil && <ClaimBeanDrawerToggle maxBeans={soil} />}
        {!hasSoil ? (
          <Box>
            <WarningAlert sx={{ color: 'black' }}>
              There is currently no Soil.{' '}
              <Link
                href="https://docs.bean.money/almanac/farm/field#soil"
                target="_blank"
                rel="noreferrer"
              >
                Learn more
              </Link>
            </WarningAlert>
          </Box>
        ) : null}
        {isSubmittable ? (
          <>
            <TxnSeparator />
            <TokenOutput>
              <TokenOutput.Row
                token={sdk.tokens.PODS}
                amount={numPods}
                amountSuffix={` @ ${displayBN(podLineLength)}`}
              />
            </TokenOutput>
            {maxAmountUsed && maxAmountUsed.gt(0.9) ? (
              <WarningAlert>
                If there is less Soil at the time of execution, this transaction
                will Sow Beans into the remaining Soil and send any unused Beans
                to your Farm Balance.
                {/* You are Sowing {displayFullBN(maxAmountUsed.times(100), 4, 0)}% of remaining Soil.  */}
              </WarningAlert>
            ) : null}
            <FormTxnsSecondaryOptions disabledActions={disabledActions} />
            <Box>
              <TxnAccordion defaultExpanded={false}>
                <TxnPreview
                  actions={[
                    {
                      type: ActionType.BUY_BEANS,
                      beanAmount: beans,
                      beanPrice: beanPrice,
                      token: getNewToOldToken(tokenIn),
                      tokenAmount: amountIn || ZERO_BN,
                    },
                    {
                      type: ActionType.BURN_BEANS,
                      amount: beans,
                    },
                    {
                      type: ActionType.RECEIVE_PODS,
                      podAmount: numPods,
                      placeInLine: podLineLength,
                    },
                  ]}
                  {...txnActions}
                />
                <Divider sx={{ my: 2, opacity: 0.4 }} />
                <Box pb={1}>
                  <Typography variant="body2" alignItems="center">
                    Pods become <strong>Harvestable</strong> on a first in,
                    first out{' '}
                    <Link
                      href="https://docs.bean.money/almanac/protocol/glossary#fifo"
                      target="_blank"
                      rel="noreferrer"
                      underline="hover"
                    >
                      (FIFO)
                    </Link>{' '}
                    basis. Upon <strong>Harvest</strong>, each Pod is redeemed
                    for{' '}
                    <span>
                      <TokenIcon
                        token={Bean}
                        css={{ height: IconSize.xs, marginTop: 2.6 }}
                      />
                    </span>
                    1.
                  </Typography>
                </Box>
              </TxnAccordion>
            </Box>
          </>
        ) : null}
        <SmartSubmitButton
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          disabled={!isSubmittable}
          contract={sdk.contracts.beanstalk}
          tokens={values.tokens}
          mode="auto"
        >
          Sow
        </SmartSubmitButton>
      </Stack>
      <FormWithDrawer.Drawer title="Use Claimable Assets">
        <ClaimBeanDrawerContent
          txnName="Sow"
          maxBeans={soil}
          beanAmount={beansUsed}
        />
      </FormWithDrawer.Drawer>
    </FormWithDrawer>
  );
};

// ---------------------------------------------------

const Sow: FC<{}> = () => {
  const sdk = useSdk();
  const account = useAccount();

  /// Beanstalk
  const temperature = useTemperature();
  const soil = useSelector<AppState, AppState['_beanstalk']['field']['soil']>(
    (state) => state._beanstalk.field.soil
  );

  /// Farmer
  const balances = useFarmerBalances();
  const farmerFormTxns = useFarmerFormTxns();

  const [refetchBeanstalkField] = useFetchBeanstalkField();
  const [refetchPools] = useFetchPools();

  /// Form
  const middleware = useFormMiddleware();

  const preferredTokens: PreferredToken[] = useMemo(() => {
    return [
      {
        token: sdk.tokens.BEAN,
        minimum: new BigNumber(1), // $1
      },
      {
        token: sdk.tokens.ETH,
        minimum: new BigNumber(0.001), // ~$2-4
      },
      {
        token: sdk.tokens.ETH,
        minimum: new BigNumber(0.001), // ~$2-4
      },
    ];
  }, [sdk]);

  const baseToken = usePreferredToken(preferredTokens, 'use-best');
  const initialValues: SowFormValues = useMemo(
    () => ({
      settings: {
        slippage: 0.1, // 0.1%
      },
      tokens: [
        {
          token: baseToken as ERC20Token | NativeToken,
          amount: undefined,
        },
      ],
      maxAmountIn: undefined,
      farmActions: {
        ...defaultFarmActionsFormState,
      },
      balanceFrom: BalanceFrom.TOTAL,
    }),
    [baseToken]
  );

  /// Handlers
  // This handler does not run when _tokenIn = _tokenOut
  // _tokenOut === Bean
  const handleQuote = useCallback<QuoteHandlerWithParams<SowFormQuoteParams>>(
    async (_tokenIn, _amountIn, _tokenOut, { fromMode: _fromMode }) => {
      if (!account) {
        throw new Error('Signer required');
      }

      const work = sdk.farm.create();
      const isEth = sdk.tokens.ETH.symbol === _tokenIn.symbol;
      const amountIn = _tokenIn.fromHuman(_amountIn.toString());

      let fromMode = _fromMode;
      if (isEth || sdk.tokens.WETH.equals(_tokenIn)) {
        if (isEth) {
          fromMode = FarmFromMode.INTERNAL_TOLERANT;
          work.add(new sdk.farm.actions.WrapEth(FarmToMode.INTERNAL));
        }
        work.add(sdk.farm.presets.weth2bean(fromMode, FarmToMode.INTERNAL));
      } else if (!sdk.tokens.BEAN.equals(_tokenIn)) {
        throw new Error(
          `Sowing via ${_tokenIn.symbol} is not currently supported`
        );
      }

      const estimate = await work.estimate(amountIn);

      return {
        amountOut: tokenValueToBN(_tokenOut.fromBlockchain(estimate)),
        steps: work.generators as StepGenerator[],
      };
    },
    [sdk.farm, sdk.tokens, account]
  );

  const onSubmit = useCallback(
    async (
      values: SowFormValues,
      formActions: FormikHelpers<SowFormValues>
    ) => {
      let txToast;
      try {
        middleware.before();
        const { BEAN: bean, ETH, WETH, PODS } = sdk.tokens;

        const formData = values.tokens[0];
        const farmActions = values.farmActions;
        const tokenIn = formData.token;
        const amountIn =
          formData.amount && tokenIn.amount(formData.amount.toString());
        const amountBeans = bean.equals(tokenIn)
          ? formData.amount
          : formData.amountOut;
        const additionalAmount = bean.amount(
          farmActions.additionalAmount?.toString() || '0'
        );
        const totalClaimAmount = bean.amount(
          farmActions.surplus?.max?.toString() || '0'
        );
        const transferDestination =
          farmActions.surplus?.destination || FarmToMode.INTERNAL;

        if (values.tokens.length > 1) {
          throw new Error('Only one token supported at this time');
        }
        if (!amountIn || amountIn.lte(0) || !amountBeans || amountBeans.eq(0)) {
          throw new Error('No amount set');
        }
        if (!account) {
          throw new Error('Signer required');
        }

        const totalBeans = amountBeans.times(additionalAmount.toHuman());
        const amountPods = totalBeans.times(temperature.div(100).plus(1));
        const fromMode = bean.equals(tokenIn)
          ? balanceFromToMode(values.balanceFrom)
          : FarmFromMode.INTERNAL_TOLERANT;

        txToast = new TransactionToast({
          loading: `Sowing ${displayFullBN(
            totalBeans,
            bean.decimals
          )} Beans for ${displayFullBN(amountPods, PODS.decimals)} Pods...`,
          success: 'Sow successful.',
        });

        const sow = sdk.farm.create();

        /// Swap to BEAN and Sow
        if (tokenIn.equals(ETH) || WETH.equals(tokenIn)) {
          // Require a quote
          if (!formData.steps || !formData.amountOut) {
            throw new Error(`No quote available for ${formData.token.symbol}`);
          }
          console.debug('[SOW]: adding steps to workflow', formData.steps);
          formData.steps.forEach((step) => {
            sow.add(step);
          });

          // At the end of the Swap step, the assets will be in our INTERNAL balance.
          // The Swap decides where to route them from (see handleQuote).
        } else if (!bean.equals(tokenIn)) {
          throw new Error(
            `Sowing via ${tokenIn.symbol} is not currently supported`
          );
        }

        /// If the user is claiming beans and using claimable beans to sow,
        // add amount of claimable beans to the amount from their farm/circulating balance
        if (additionalAmount.gt(0)) {
          console.debug(
            '[SOW]: adding claimable beans',
            additionalAmount.toHuman()
          );
          /// at this point, we know that the token for amountInStep is BEAN
          sow.add(
            FormTxnBuilder.getLocalOnlyStep('add-additional-amount', {
              additionalAmount,
            }),
            { onlyLocal: true }
          );
        }

        sow.add(async (_amountInStep: ethers.BigNumber, _context: any) => ({
          name: 'sow',
          amountOut: _amountInStep,
          prepare: () => ({
            target: sdk.contracts.beanstalk.address,
            callData: sdk.contracts.beanstalk.interface.encodeFunctionData(
              'sow',
              [_amountInStep, fromMode]
            ),
          }),
          decode: (data: string) =>
            sdk.contracts.beanstalk.interface.decodeFunctionResult('sow', data),
          decodeResult: (result: string) =>
            sdk.contracts.beanstalk.interface.decodeFunctionResult(
              'sow',
              result
            ),
        }));

        /// If the user is claiming beans and isn't using the full amount,
        /// transfer the remaining amount to their external wallet if requested.
        const finalSteps = (() => {
          const transferAmount = totalClaimAmount.sub(additionalAmount);
          const isToExternal = transferDestination === FarmToMode.EXTERNAL;
          const shouldTransfer = isToExternal && transferAmount.gt(0);

          if (!shouldTransfer) return undefined;

          const transferStep = new sdk.farm.actions.TransferToken(
            bean.address,
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
          sow,
          amountIn,
          values.settings.slippage,
          finalSteps
        );

        const txn = await execute();
        txToast.confirming(txn);

        const reciept = await txn.wait();
        await farmerFormTxns.refetch(
          performed,
          {
            farmerField: true,
            farmerBalances: true,
          },
          [refetchBeanstalkField, refetchPools]
        );

        txToast.success(reciept);
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
      sdk,
      middleware,
      temperature,
      farmerFormTxns,
      refetchBeanstalkField,
      refetchPools,
    ]
  );

  return (
    <Formik<SowFormValues> initialValues={initialValues} onSubmit={onSubmit}>
      {(formikProps: FormikProps<SowFormValues>) => (
        <>
          <TxnSettings placement="form-top-right">
            <SettingInput
              name="settings.slippage"
              label="Slippage Tolerance"
              endAdornment="%"
            />
          </TxnSettings>
          <SowForm
            handleQuote={handleQuote}
            balances={balances}
            weather={temperature}
            soil={soil}
            {...formikProps}
          />
        </>
      )}
    </Formik>
  );
};

export default Sow;
