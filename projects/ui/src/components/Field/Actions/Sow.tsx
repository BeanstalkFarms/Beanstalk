import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ERC20Token,
  FarmFromMode,
  FarmToMode,
  NativeToken,
  Token,
  TokenValue,
} from '@beanstalk/sdk';
import { Box, Divider, Link, Stack, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import { Formik, FormikHelpers, FormikProps } from 'formik';
import { useSelector } from 'react-redux';
import { IconSize } from '~/components/App/muiTheme';
import WarningAlert from '~/components/Common/Alert/WarningAlert';
import {
  BalanceFromFragment,
  FormStateNew,
  FormTokenStateNew,
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
import ClaimBeanDrawerToggle from '~/components/Common/Form/FormTxn/ClaimBeanDrawerToggle';
import AdditionalTxnsAccordion from '~/components/Common/Form/FormTxn/AdditionalTxnsAccordion';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import TokenQuoteProviderWithParams from '~/components/Common/Form/TokenQuoteProviderWithParams';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import TokenSelectDialogNew from '~/components/Common/Form/TokenSelectDialogNew';
import TokenIcon from '~/components/Common/TokenIcon';
import TxnAccordion from '~/components/Common/TxnAccordion';
import TransactionToast from '~/components/Common/TxnToast';
import { ZERO_BN } from '~/constants';
import usePrice from '~/hooks/beanstalk/usePrice';
import useTokenMap from '~/hooks/chain/useTokenMap';
import useToggle from '~/hooks/display/useToggle';
import useFarmerFormTxnsActions from '~/hooks/farmer/form-txn/useFarmerFormTxnActions';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import usePreferredToken from '~/hooks/farmer/usePreferredToken';
import useAccount from '~/hooks/ledger/useAccount';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';
import useSdk, { getNewToOldToken } from '~/hooks/sdk';
import { AppState } from '~/state';
import { useFetchPools } from '~/state/bean/pools/updater';
import { useFetchBeanstalkField } from '~/state/beanstalk/field/updater';
import { FC } from '~/types';
import {
  MinBN,
  displayBN,
  displayFullBN,
  normaliseTV,
  tokenValueToBN,
} from '~/util';
import { ActionType } from '~/util/Actions';
import FormWithDrawer from '~/components/Common/Form/FormWithDrawer';
import ClaimBeanDrawerContent from '~/components/Common/Form/FormTxn/ClaimBeanDrawerContent';
import FormTxnProvider from '~/components/Common/Form/FormTxnProvider';
import useFormTxnContext from '~/hooks/sdk/useFormTxnContext';
import { ClaimAndDoX, SowFarmStep } from '~/lib/Txn';
import useTemperature from '~/hooks/beanstalk/useTemperature';

type SowFormValues = FormStateNew & {
  settings: SlippageSettingsFragment & {
    minTemperature: BigNumber | undefined;
  };
} & FormTxnsFormState &
  BalanceFromFragment & {
    claimableBeans: FormTokenStateNew;
  };

type SowFormQuoteParams = {
  fromMode: FarmFromMode;
};

const defaultFarmActionsFormState = {
  preset: 'claim',
  primary: undefined,
  secondary: undefined,
};

const SowForm: FC<
  FormikProps<SowFormValues> & {
    handleQuote: QuoteHandlerWithParams<SowFormQuoteParams>;
    balances: ReturnType<typeof useFarmerBalances>;
    temperature: BigNumber;
    soil: BigNumber;
    tokenList: (ERC20Token | NativeToken)[];
    beanstalkField: AppState['_beanstalk']['field'];
    // formRef: React.MutableRefObject<HTMLDivElement | null>;
  }
> = ({
  // Formik
  values,
  isSubmitting,
  setFieldValue,
  //
  beanstalkField,
  balances,
  temperature,
  soil,
  tokenList,
  handleQuote,
}) => {
  const sdk = useSdk();
  const account = useAccount();
  const [isTokenSelectVisible, showTokenSelect, hideTokenSelect] = useToggle();
  const formRef = useRef<HTMLDivElement | null>(null);

  /// Chain
  const Bean = sdk.tokens.BEAN;
  const erc20TokenMap = useTokenMap<ERC20Token | NativeToken>(tokenList);

  ///
  const beanPrice = usePrice();

  /// Derived
  const tokenIn = values.tokens[0].token; // converting from token
  const amountIn = values.tokens[0].amount; // amount of from token
  const amountOut = values.tokens[0].amountOut; // amount of to token
  const maxAmountIn = values.tokens[0].maxAmountIn;
  const tokenInBalance =
    balances[tokenIn.symbol === 'ETH' ? 'eth' : tokenIn.address];
  const claimedBeansUsed = values.claimableBeans.amount;

  /// Calculations
  const hasSoil = soil.gt(0);
  const beans = Bean.equals(tokenIn)
    ? amountIn || ZERO_BN
    : amountOut || ZERO_BN;
  const totalBeansAmount = beans.plus(claimedBeansUsed || ZERO_BN);
  const isSubmittable = hasSoil && totalBeansAmount?.gt(0);
  const numPods = totalBeansAmount.multipliedBy(temperature.div(100).plus(1));
  const podLineLength = beanstalkField.podIndex.minus(
    beanstalkField.harvestableIndex
  );
  const maxAmountUsed = maxAmountIn ? totalBeansAmount.div(maxAmountIn) : null;

  const txnActions = useFarmerFormTxnsActions({
    showGraphicOnClaim: Bean.equals(tokenIn),
    claimBeansState: values.claimableBeans,
  });

  /// Approval Checks
  const shouldApprove =
    values.balanceFrom === BalanceFrom.EXTERNAL ||
    (values.balanceFrom === BalanceFrom.TOTAL &&
      values.tokens[0].amount?.gt(balances[tokenIn.address]?.internal));

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
        ...Array.from(copy).map((_token) => ({
          token: _token,
          amount: undefined,
        })),
        ...newValue,
      ]);
      setFieldValue('farmActions', defaultFarmActionsFormState);
      setFieldValue('claimableBeans', {
        token: Bean,
        amount: null,
      });
    },
    [values.tokens, setFieldValue, Bean]
  );

  /// FIXME: standardized `maxAmountIn` approach?
  /// When `tokenIn` or `tokenOut` changes, refresh the
  /// max amount that the user can input of `tokenIn`.
  useEffect(() => {
    (async () => {
      console.debug('[Sow][finding max for token]...');
      if (!account) {
        console.debug(
          '[Sow][get maxAmountIn]: Execution reverted. Signer required'
        );
        return;
      }
      if (!soil.gt(0)) return;
      const isSupportedToken = Boolean(
        tokenList.find((tk) => tokenIn.address === tk.address)
      );
      if (!isSupportedToken) {
        setFieldValue('tokens.0.maxAmountIn', ZERO_BN);
        throw new Error(`Unsupported tokenIn: ${tokenIn.symbol}`);
      }

      const max = await SowFarmStep.getMaxForToken(
        sdk,
        tokenIn,
        account,
        FarmFromMode.EXTERNAL,
        sdk.tokens.BEAN.amount(soil.toString() || '0')
      );

      setFieldValue('tokens.0.maxAmountIn', tokenValueToBN(max));
    })();
  }, [account, sdk, setFieldValue, soil, tokenIn, tokenList]);

  const quoteHandlerParams = useMemo(
    () => ({
      fromMode: balanceFromToMode(values.balanceFrom),
    }),
    [values.balanceFrom]
  );

  const useClaimedQuoteParams = useMemo(
    () => ({
      fromMode: FarmFromMode.INTERNAL_TOLERANT,
    }),
    []
  );

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
          disabled={!hasSoil || !maxAmountIn}
          max={MinBN(
            maxAmountIn || ZERO_BN,
            tokenInBalance?.[values.balanceFrom] || ZERO_BN
          )}
          balance={tokenInBalance || undefined}
          state={values.tokens[0]}
          showTokenSelect={showTokenSelect}
          handleQuote={handleQuote}
          params={quoteHandlerParams}
          balanceFrom={values.balanceFrom}
          disableTokenSelect={!hasSoil || !maxAmountIn}
        />
        {hasSoil && <ClaimBeanDrawerToggle actionText='Sow'/>}
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
            <AdditionalTxnsAccordion />
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
                      type: ActionType.SOW_BEANS,
                      amount: totalBeansAmount,
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
          disabled={!isSubmittable || isSubmitting}
          contract={sdk.contracts.beanstalk}
          tokens={shouldApprove ? values.tokens : []}
          mode="auto"
        >
          Sow
        </SmartSubmitButton>
      </Stack>
      <FormWithDrawer.Drawer title="Sow Claimable Beans">
        <ClaimBeanDrawerContent
          maxBeans={soil}
          beansUsed={beans}
          quoteProviderProps={{
            tokenOut: Bean,
            name: 'claimableBeans',
            state: values.claimableBeans,
            params: useClaimedQuoteParams,
            handleQuote,
          }}
        />
      </FormWithDrawer.Drawer>
    </FormWithDrawer>
  );
};

// ---------------------------------------------------

const SowFormContainer: FC<{}> = () => {
  const sdk = useSdk();
  const account = useAccount();

  /// Beanstalk
  const beanstalkField = useSelector<AppState, AppState['_beanstalk']['field']>(
    (state) => state._beanstalk.field
  );
  const [{ current: temperature }] = useTemperature();
  // const temperature = beanstalkField.temperature.scaled;
  const soil = beanstalkField.soil;

  /// Farmer
  const balances = useFarmerBalances();

  const [refetchBeanstalkField] = useFetchBeanstalkField();
  const [refetchPools] = useFetchPools();

  /// Form
  const middleware = useFormMiddleware();
  const { txnBundler, refetch } = useFormTxnContext();

  const { preferredTokens, tokenList } = useMemo(() => {
    const tokens = SowFarmStep.getPreferredTokens(sdk.tokens);
    return {
      preferredTokens: tokens.preferred,
      tokenList: tokens.tokenList,
    };
  }, [sdk]);

  const baseToken = usePreferredToken(preferredTokens, 'use-best');
  const initialValues: SowFormValues = useMemo(
    () => ({
      settings: {
        slippage: 0.1, // 0.1%,
        minTemperature: undefined,
      },
      tokens: [
        {
          token: baseToken as ERC20Token | NativeToken,
          amount: undefined,
        },
        {
          // claimable BEANs
          token: sdk.tokens.BEAN,
          amount: undefined,
        },
      ],
      farmActions: {
        ...defaultFarmActionsFormState,
      },
      claimableBeans: {
        token: sdk.tokens.BEAN,
        amount: undefined,
      },
      balanceFrom: BalanceFrom.TOTAL,
    }),
    [baseToken, sdk.tokens.BEAN]
  );

  /// Handlers
  // This handler does not run when _tokenIn = _tokenOut
  // _tokenOut === Bean
  const handleQuote = useCallback<QuoteHandlerWithParams<SowFormQuoteParams>>(
    async (_tokenIn, _amountIn, _tokenOut, { fromMode: _fromMode }) => {
      if (!account) {
        throw new Error('Signer Required');
      }

      const result = await SowFarmStep.getAmountOut(
        sdk,
        _tokenIn,
        normaliseTV(_tokenIn, _amountIn),
        _fromMode,
        account
      );

      return {
        amountOut: tokenValueToBN(result),
      };
    },
    [account, sdk]
  );

  const onSubmit = useCallback(
    async (
      values: SowFormValues,
      formActions: FormikHelpers<SowFormValues>
    ) => {
      let txToast;
      try {
        middleware.before();
        const { BEAN: bean, PODS } = sdk.tokens;

        const formData = values.tokens[0];
        const claimData = values.claimableBeans;
        const tokenIn = formData.token;
        const amountIn = normaliseTV(tokenIn, formData.amount);
        const amountBeans = normaliseTV(
          bean,
          bean.equals(tokenIn) ? formData.amount : formData.amountOut
        );
        const claimedBeansUsed = normaliseTV(bean, claimData.amount);
        const totalBeans = amountBeans.add(claimedBeansUsed);

        if (totalBeans.lte(0)) {
          throw new Error('No amount set');
        }
        if (!account) {
          throw new Error('Signer required');
        }

        if (!values.settings.slippage) {
          throw new Error('Slippage required');
        }

        const scaledTemp = TokenValue.fromHuman(temperature.toString(), 6);

        const _minTemp = TokenValue.fromHuman(
          (values.settings.minTemperature || ZERO_BN).toString(),
          6
        );
        const minTemperature = _minTemp.gt(scaledTemp) ? _minTemp : scaledTemp;
        const minSoil = amountBeans.mul(1 - values.settings.slippage / 100);

        const amountPods = totalBeans.mul(minTemperature.div(100).add(1));

        txToast = new TransactionToast({
          loading: `Sowing ${displayFullBN(
            totalBeans,
            bean.decimals
          )} Beans for ${displayFullBN(amountPods, PODS.decimals)} Pods...`,
          success: 'Sow successful.',
        });

        const sowTxn = new SowFarmStep(sdk, account);
        const claimAndDoX = new ClaimAndDoX(
          sdk,
          normaliseTV(bean, claimData.maxAmountIn),
          normaliseTV(bean, claimData.amount),
          values.farmActions.transferToMode || FarmToMode.INTERNAL
        );

        sowTxn.build(
          tokenIn,
          amountIn,
          minTemperature,
          minSoil,
          balanceFromToMode(values.balanceFrom),
          claimAndDoX
        );

        const performed = txnBundler.setFarmSteps(values.farmActions);

        const { execute } = await txnBundler.bundle(
          sowTxn,
          amountIn,
          values.settings.slippage
        );

        const txn = await execute();
        txToast.confirming(txn);

        const reciept = await txn.wait();
        await refetch(
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
      middleware,
      sdk,
      account,
      temperature,
      txnBundler,
      refetch,
      refetchBeanstalkField,
      refetchPools,
    ]
  );

  return (
    <Formik<SowFormValues> initialValues={initialValues} onSubmit={onSubmit}>
      {(formikProps: FormikProps<SowFormValues>) => (
        <>
          <TxnSettings placement="form-top-right">
            <>
              <SettingInput
                name="settings.slippage"
                label="Slippage Tolerance"
                endAdornment="%"
              />
              <SettingInput
                name="settings.minTemperature"
                label="Min Temperature"
              />
            </>
          </TxnSettings>
          <SowForm
            beanstalkField={beanstalkField}
            handleQuote={handleQuote}
            balances={balances}
            temperature={temperature}
            soil={soil}
            tokenList={tokenList}
            {...formikProps}
          />
        </>
      )}
    </Formik>
  );
};

const Sow: React.FC<{}> = () => (
  <FormTxnProvider>
    <SowFormContainer />
  </FormTxnProvider>
);

export default Sow;
