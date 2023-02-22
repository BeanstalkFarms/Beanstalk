import React, { useCallback, useEffect, useMemo } from 'react';
import { Accordion, AccordionDetails, Alert, Box, Divider, Link, Stack, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Token, ERC20Token, NativeToken } from '@beanstalk/sdk';
import TransactionToast from '~/components/Common/TxnToast';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import {
  BalanceFromFragment,
  ClaimAndPlantFormState,
  FormStateNew,
  SettingInput,
  SlippageSettingsFragment,
  SmartSubmitButton,
  TokenOutputField,
  TxnPreview,
  TxnSeparator,
  TxnSettings
} from '~/components/Common/Form';
import useToggle from '~/hooks/display/useToggle';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import usePreferredToken, { PreferredToken } from '~/hooks/farmer/usePreferredToken';
import useTokenMap from '~/hooks/chain/useTokenMap';
import { FarmFromMode, FarmToMode } from '~/lib/Beanstalk/Farm';
import { displayBN, displayFullBN, MinBN, parseError, tokenValueToBN } from '~/util';
import usePrice from '~/hooks/beanstalk/usePrice';
import { useFetchFarmerField } from '~/state/farmer/field/updater';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import { useFetchBeanstalkField } from '~/state/beanstalk/field/updater';
import { useFetchPools } from '~/state/bean/pools/updater';
import { AppState } from '~/state';
import { BEAN, PODS } from '~/constants/tokens';
import { ZERO_BN } from '~/constants';
import StyledAccordionSummary from '~/components/Common/Accordion/AccordionSummary';
import { ActionType } from '~/util/Actions';
import { IconSize } from '~/components/App/muiTheme';
import IconWrapper from '~/components/Common/IconWrapper';
import TokenIcon from '~/components/Common/TokenIcon';
import Row from '~/components/Common/Row';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import ClaimPlant, { ClaimPlantActionMap } from '~/util/ClaimPlant';
import useSdk, { getNewToOldToken } from '~/hooks/sdk';
import useClaimAndPlantActions from '~/hooks/beanstalk/useClaimAndPlantActions';
import TokenSelectDialogNew from '~/components/Common/Form/TokenSelectDialogNew';
import TokenQuoteProviderWithParams from '~/components/Common/Form/TokenQuoteProviderWithParams';
import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';
import { BalanceFrom, balanceFromToMode } from '~/components/Common/Form/BalanceFromRow';
import ClaimAndPlantFarmActions from '~/components/Common/Form/ClaimAndPlantFarmOptions';
import ClaimAndPlantAdditionalOptions from '~/components/Common/Form/ClaimAndPlantAdditionalOptions';
import useFarmerClaimingBalance from '~/hooks/farmer/useFarmerClaimingBalance';

type SowFormValues = FormStateNew & {
  settings: SlippageSettingsFragment;
  maxAmountIn: BigNumber | undefined;
} & ClaimAndPlantFormState & BalanceFromFragment;

type SowFormQuoteParams = {
  fromMode: FarmFromMode;
}

const SowForm : FC<
  FormikProps<SowFormValues>
  & {
    handleQuote: QuoteHandlerWithParams<SowFormQuoteParams>;
    balances: ReturnType<typeof useFarmerBalances>;
    weather: BigNumber;
    soil: BigNumber;
    claimPlantActions: ClaimPlantActionMap;
  }
> = ({
  // Formik
  values,
  setFieldValue,
  //
  balances,
  claimPlantActions,
  weather,
  soil,
  handleQuote,
}) => {
  const sdk = useSdk();
  const claimingBalances = useFarmerClaimingBalance();
  const [isTokenSelectVisible, showTokenSelect, hideTokenSelect] = useToggle();

  /// Chain
  const Bean          = sdk.tokens.BEAN;
  const Eth           = sdk.tokens.ETH;
  const Weth          = sdk.tokens.WETH;
  const erc20TokenMap = useTokenMap<ERC20Token | NativeToken>([Bean, Eth, Weth]);

  ///
  const beanPrice      = usePrice();
  const beanstalkField = useSelector<AppState, AppState['_beanstalk']['field']>((state) => state._beanstalk.field);

  /// Derived
  const tokenIn   = values.tokens[0].token;     // converting from token
  const amountIn  = values.tokens[0].amount;    // amount of from token
  const tokenOut  = Bean;                       // converting to token
  const amountOut = values.tokens[0].amountOut; // amount of to token
  const maxAmountIn    = values.maxAmountIn;
  const tokenInBalance = balances[tokenIn.symbol === 'ETH' ? 'eth' : tokenIn.address];

  /// Calculations
  const hasSoil = soil.gt(0);
  const beans   = Bean.equals(tokenIn)
    ? amountIn  || ZERO_BN
    : amountOut || ZERO_BN;
  const isSubmittable = hasSoil && beans?.gt(0);
  const numPods       = beans.multipliedBy(weather.div(100).plus(1));
  const podLineLength = beanstalkField.podIndex.minus(beanstalkField.harvestableIndex);

  const maxAmountUsed = (amountIn && maxAmountIn) 
    ? amountIn.div(maxAmountIn) 
    : null;

  const handleSetBalanceFrom = useCallback((_balanceFrom: BalanceFrom) => {
    setFieldValue('balanceFrom', _balanceFrom);
  },[setFieldValue]);

  /// Token select
  const handleSelectTokens = useCallback((_tokens: Set<Token>) => {
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
      ...Array.from(copy).map((_token) => ({ token: _token, amount: undefined })),
    ]);
  }, [values.tokens, setFieldValue]);

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
          
          const estimate = await work.estimateReversed(bean.amount(soil.toString()));
          setFieldValue(
            'maxAmountIn',
            tokenValueToBN(bean.fromBlockchain(estimate)),
            );
        } else {
          throw new Error(`Unsupported tokenIn: ${tokenIn.symbol}`);
        }
      } else {
        setFieldValue('maxAmountIn', ZERO_BN);
      }
    })();
  }, [hasSoil, setFieldValue, soil, tokenIn, tokenOut, sdk.tokens, sdk.farm]);

  const quoteProviderParams = useMemo(() => ({ 
    fromMode: balanceFromToMode(values.balanceFrom) 
  }), [values.balanceFrom]);

  return (
    <Form autoComplete="off">
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
        applicableBalances={claimingBalances}
      />
      <Stack gap={1}>
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
          params={quoteProviderParams}
          balanceFrom={values.balanceFrom}
          additionalBalance={claimingBalances[values.tokens[0].token.address]?.applied}
          belowComponent={
            <ClaimAndPlantFarmActions preset="claim" />
          }
        />
        {!hasSoil ? (
          <Box>
            <Alert color="warning" icon={<IconWrapper boxSize={IconSize.medium}><WarningAmberIcon sx={{ fontSize: IconSize.small }} /></IconWrapper>} sx={{ color: 'black' }}>
              There is currently no Soil. <Link href="https://docs.bean.money/almanac/farm/field#soil" target="_blank" rel="noreferrer">Learn more</Link>
            </Alert>
          </Box>
        ) : null}
        {isSubmittable ? (
          <>
            <TxnSeparator />
            <TokenOutputField
              token={PODS}
              amount={numPods}
              override={(
                <Row gap={0.5}>
                  <TokenIcon
                    token={PODS}
                    css={{
                      height: IconSize.small,
                    }}
                  />
                  <Typography variant="bodyMedium">
                    <Typography display={{ xs: 'none', sm: 'inline' }} variant="bodyMedium">{PODS.symbol} </Typography>@ {displayBN(podLineLength)}
                  </Typography>
                </Row>
              )}
            />
            {(maxAmountUsed && maxAmountUsed.gt(0.9)) ? (
              <Box>
                <Alert
                  color="warning"
                  icon={<IconWrapper boxSize={IconSize.medium}><WarningAmberIcon sx={{ fontSize: IconSize.small }} /></IconWrapper>}
                  sx={{ color: 'black' }}
                >
                  If there is less Soil at the time of execution, this transaction will Sow Beans into the remaining Soil and send any unused Beans to your Farm Balance.
                  {/* You are Sowing {displayFullBN(maxAmountUsed.times(100), 4, 0)}% of remaining Soil.  */}
                </Alert>
              </Box>
            ) : null}
            <ClaimAndPlantAdditionalOptions 
              actions={claimPlantActions}
            />
            <Box>
              <Accordion variant="outlined" color="primary">
                <StyledAccordionSummary title="Transaction Details" />
                <AccordionDetails>
                  <TxnPreview
                    actions={[
                      {
                        type: ActionType.BUY_BEANS,
                        beanAmount: beans,
                        beanPrice: beanPrice,
                        token: getNewToOldToken(tokenIn),
                        tokenAmount: amountIn || ZERO_BN
                      },
                      {
                        type: ActionType.BURN_BEANS,
                        amount: beans
                      },
                      {
                        type: ActionType.RECEIVE_PODS,
                        podAmount: numPods,
                        placeInLine: podLineLength
                      }
                    ]}
                  />
                  <Divider sx={{ my: 2, opacity: 0.4 }} />
                  <Box pb={1}>
                    <Typography variant="body2" alignItems="center">
                      Pods become <strong>Harvestable</strong> on a first in, first out <Link href="https://docs.bean.money/almanac/protocol/glossary#fifo" target="_blank" rel="noreferrer" underline="hover">(FIFO)</Link> basis. Upon <strong>Harvest</strong>, each Pod is redeemed for <span><TokenIcon token={BEAN[1]} css={{ height: IconSize.xs, marginTop: 2.6 }} /></span>1.
                    </Typography>
                  </Box>
                </AccordionDetails>
              </Accordion>
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
    </Form>
  );
};

// ---------------------------------------------------

const Sow : FC<{}> = () => {
  const sdk = useSdk();
  const claimPlant = useClaimAndPlantActions();

  /// Beanstalk
  const weather = useSelector<AppState, AppState['_beanstalk']['field']['weather']['yield']>((state) => state._beanstalk.field.weather.yield);
  const soil    = useSelector<AppState, AppState['_beanstalk']['field']['soil']>((state) => state._beanstalk.field.soil);
  
  /// Farmer
  const balances                = useFarmerBalances();
  const [refetchBeanstalkField] = useFetchBeanstalkField();
  const [refetchPools]          = useFetchPools();
  const [refetchFarmerField]    = useFetchFarmerField();
  const [refetchFarmerBalances] = useFetchFarmerBalances();

  /// Form
  const middleware = useFormMiddleware();

  const preferredTokens: PreferredToken[] = useMemo(() => [
    {
      token: sdk.tokens.BEAN,
      minimum: new BigNumber(1),    // $1
    },
    {
      token: sdk.tokens.ETH,
      minimum: new BigNumber(0.001) // ~$2-4
    },
    {
      token: sdk.tokens.ETH,
      minimum: new BigNumber(0.001) // ~$2-4
    }
  ], [sdk.tokens]);

  const baseToken = usePreferredToken(preferredTokens, 'use-best');
  const initialValues : SowFormValues = useMemo(() => ({
    settings: {
      slippage: 0.1, // 0.1%
    },
    tokens: [
      {
        token: baseToken as (ERC20Token | NativeToken),
        amount: undefined,
      },
    ],
    maxAmountIn: undefined,
    farmActions: {
      options: ClaimPlant.presets.claimBeans,
      selected: [],
      additional: {
        selected: [],
      }
    },
    balanceFrom: BalanceFrom.TOTAL
  }), [baseToken]);

  /// Handlers
  // This handler does not run when _tokenIn = _tokenOut
  // _tokenOut === Bean 
  const handleQuote = useCallback<QuoteHandlerWithParams<SowFormQuoteParams>>(
    async (_tokenIn, _amountIn, _tokenOut, { fromMode: _fromMode }) => {
      const work = sdk.farm.create();
      const isEth = sdk.tokens.ETH.symbol === _tokenIn.symbol;
      const amountIn = _tokenIn.fromHuman(_amountIn.toString());

      let value: ethers.BigNumber | undefined;
      let fromMode = _fromMode;

      if (isEth || sdk.tokens.WETH.equals(_tokenIn)) {
        if (isEth) {
          fromMode =  FarmFromMode.INTERNAL_TOLERANT;
          value = ethers.BigNumber.from(amountIn.blockchainString);
          work.add(new sdk.farm.actions.WrapEth(FarmToMode.INTERNAL));
        }
        work.add(sdk.farm.presets.weth2bean(fromMode));
      } else if (!sdk.tokens.BEAN.equals(_tokenIn)) {
        throw new Error(`Sowing via ${_tokenIn.symbol} is not currently supported`);
      }

      const estimate = await work.estimate(amountIn);

      return {
        amountOut: tokenValueToBN(_tokenOut.fromBlockchain(estimate)),
        workflow: work,
        value: value,
      };
    },
    [sdk.farm, sdk.tokens]
  );

  const onSubmit = useCallback(async (values: SowFormValues, formActions: FormikHelpers<SowFormValues>) => {
    let txToast;
    try {
      middleware.before();
      const { BEAN: bean, ETH, WETH } = sdk.tokens;

      const formData = values.tokens[0];
      const tokenIn = formData.token;
      const amountIn = formData.amount && tokenIn.amount(formData.amount.toString());
      const amountBeans = bean.equals(tokenIn) ? formData.amount : formData.amountOut;
      
      if (values.tokens.length > 1) throw new Error('Only one token supported at this time');
      if (!amountIn || amountIn.lte(0) || !amountBeans || amountBeans.eq(0)) throw new Error('No amount set'); 
      
      const amountPods = amountBeans.times(weather.div(100).plus(1));
      const fromMode = bean.equals(tokenIn) ? balanceFromToMode(values.balanceFrom) : FarmFromMode.INTERNAL_TOLERANT;
      
      txToast = new TransactionToast({
        loading: `Sowing ${displayFullBN(amountBeans, bean.decimals)} Beans for ${displayFullBN(amountPods, PODS.decimals)} Pods...`,
        success: 'Sow successful.',
      });
      
      const sow = sdk.farm.create();
 
      /// Swap to BEAN and Sow
      if (tokenIn.equals(ETH) || WETH.equals(tokenIn)) {
        // Require a quote
        if (!formData.workflow || !formData.amountOut) throw new Error(`No quote available for ${formData.token.symbol}`);
        console.debug('[SOW]: adding steps to workflow', formData.workflow.generators);
        formData.workflow.generators.forEach((step) => {
          sow.add(step);
        });
        
        // At the end of the Swap step, the assets will be in our INTERNAL balance.
        // The Swap decides where to route them from (see handleQuote).
      } else if (!bean.equals(tokenIn)) {
        throw new Error(`Sowing via ${tokenIn.symbol} is not currently supported`);
      }
      
      console.debug('[SOW]: adding sow to workflow');
      sow.add(async (_amountInStep: ethers.BigNumber, _context: any) => ({
        name: 'sow',
        amountOut: _amountInStep,
        prepare: () => ({
          target: sdk.contracts.beanstalk.address,
          callData: sdk.contracts.beanstalk.interface.encodeFunctionData('sow', [
            _amountInStep,
            fromMode,
          ]),
        }),
        decode: (data: string) => sdk.contracts.beanstalk.interface.decodeFunctionResult('sow', data),
        decodeResult: (result: string) => sdk.contracts.beanstalk.interface.decodeFunctionResult('sow', result)
      }));

      const overrides = { 
        value: formData.value,
        slippage: values.settings.slippage,
      };
      console.debug('[SOW]: executing ClaimPlant & SOW workflow');
      const { execute, actionsPerformed } = await ClaimPlant.build(
        sdk,
        claimPlant.buildActions(values.farmActions.selected),
        claimPlant.buildActions(values.farmActions.additional.selected),
        sow,
        amountIn,
        overrides,
      );
      const txn = await execute();
      txToast.confirming(txn);
      
      const reciept = await txn.wait();

      await claimPlant.refetch(actionsPerformed, { 
        farmerField: refetchFarmerField,
        farmerBalances: refetchFarmerBalances,
      }, [refetchBeanstalkField, refetchPools]);

      txToast.success(reciept);
      formActions.resetForm();
    } catch (err) {
      console.error(err);
      txToast?.error(err) || toast.error(parseError(err));
    } finally {
      formActions.setSubmitting(false);
    }
  }, [middleware, sdk, weather, claimPlant, refetchFarmerField, refetchFarmerBalances, refetchBeanstalkField, refetchPools]);

  return (
    <Formik<SowFormValues>
      initialValues={initialValues}
      onSubmit={onSubmit}
    >
      {(formikProps: FormikProps<SowFormValues>) => (
        <>
          <TxnSettings placement="form-top-right">
            <SettingInput name="settings.slippage" label="Slippage Tolerance" endAdornment="%" />
          </TxnSettings>
          <SowForm
            handleQuote={handleQuote}
            balances={balances}
            weather={weather}
            soil={soil}
            claimPlantActions={claimPlant.actions}
            {...formikProps}
          />
        </>
      )}
    </Formik>
  );
};

export default Sow;
