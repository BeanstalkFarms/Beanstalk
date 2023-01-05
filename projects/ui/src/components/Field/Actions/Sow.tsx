import { Accordion, AccordionDetails, Alert, Box, Divider, Link, Stack, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useProvider } from 'wagmi';
import toast from 'react-hot-toast';
import TransactionToast from '~/components/Common/TxnToast';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import {
  FormState,
  SettingInput,
  SlippageSettingsFragment,
  SmartSubmitButton,
  TokenOutputField,
  TokenQuoteProvider,
  TokenSelectDialog,
  TxnPreview,
  TxnSeparator,
  TxnSettings
} from '~/components/Common/Form';
import Token, { ERC20Token, NativeToken } from '~/classes/Token';
import { Beanstalk } from '~/generated/index';
import useToggle from '~/hooks/display/useToggle';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
import usePreferredToken, { PreferredToken } from '~/hooks/farmer/usePreferredToken';
import { QuoteHandler } from '~/hooks/ledger/useQuote';
import useTokenMap from '~/hooks/chain/useTokenMap';
import Farm, { ChainableFunction, FarmFromMode, FarmToMode } from '~/lib/Beanstalk/Farm';
import { displayBN, displayFullBN, MinBN, parseError, toStringBaseUnitBN, toTokenUnitsBN } from '~/util';
import { useSigner } from '~/hooks/ledger/useSigner';
import usePrice from '~/hooks/beanstalk/usePrice';
import { optimizeFromMode } from '~/util/Farm';
import { useFetchFarmerField } from '~/state/farmer/field/updater';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import { useFetchBeanstalkField } from '~/state/beanstalk/field/updater';
import { useFetchPools } from '~/state/bean/pools/updater';
import { AppState } from '~/state';
import { BEAN, ETH, PODS, WETH } from '~/constants/tokens';
import { ZERO_BN } from '~/constants';
import StyledAccordionSummary from '~/components/Common/Accordion/AccordionSummary';
import { ActionType } from '~/util/Actions';
import { IconSize } from '~/components/App/muiTheme';
import IconWrapper from '~/components/Common/IconWrapper';
import TokenIcon from '~/components/Common/TokenIcon';
import Row from '~/components/Common/Row';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';

type SowFormValues = FormState & {
  settings: SlippageSettingsFragment;
  maxAmountIn: BigNumber | undefined;
};

const SowForm : FC<
  FormikProps<SowFormValues>
  & {
    handleQuote: QuoteHandler;
    balances: ReturnType<typeof useFarmerBalances>;
    beanstalk: Beanstalk;
    weather: BigNumber;
    soil: BigNumber;
    farm: Farm;
  }
> = ({
  // Formik
  values,
  setFieldValue,
  //
  balances,
  beanstalk,
  weather,
  soil,
  farm,
  handleQuote,
}) => {
  const [isTokenSelectVisible, showTokenSelect, hideTokenSelect] = useToggle();

  /// Chain
  const getChainToken = useGetChainToken();
  const Bean          = getChainToken(BEAN);
  const Eth           = getChainToken<NativeToken>(ETH);
  const Weth          = getChainToken<ERC20Token>(WETH);
  const erc20TokenMap = useTokenMap<ERC20Token | NativeToken>([BEAN, ETH, WETH]);

  ///
  const beanPrice      = usePrice();
  const beanstalkField = useSelector<AppState, AppState['_beanstalk']['field']>((state) => state._beanstalk.field);

  /// Derived
  const tokenIn   = values.tokens[0].token;     // converting from token
  const amountIn  = values.tokens[0].amount;    // amount of from token
  const tokenOut  = Bean;                       // converting to token
  const amountOut = values.tokens[0].amountOut; // amount of to token
  const maxAmountIn    = values.maxAmountIn;
  const tokenInBalance = balances[tokenIn.address];

  /// Calculations
  const hasSoil = soil.gt(0);
  const beans   = (tokenIn === Bean)
    ? amountIn  || ZERO_BN
    : amountOut || ZERO_BN;
  const isSubmittable = hasSoil && beans?.gt(0);
  const numPods       = beans.multipliedBy(weather.div(100).plus(1));
  const podLineLength = beanstalkField.podIndex.minus(beanstalkField.harvestableIndex);

  const maxAmountUsed = (amountIn && maxAmountIn) 
    ? amountIn.div(maxAmountIn) 
    : null;

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
      if (hasSoil) {
        if (tokenIn === Bean) {
          /// 1 SOIL is consumed by 1 BEAN
          setFieldValue('maxAmountIn', soil);
        } else if (tokenIn === Eth || tokenIn === Weth) {
          /// Estimate how many ETH it will take to buy `soil` BEAN.
          /// TODO: across different forms of `tokenIn`.
          /// This (obviously) only works for Eth and Weth.
          const estimate = await Farm.estimate(
            farm.buyBeans(),
            [ethers.BigNumber.from(Bean.stringify(soil))],
            false, // forward = false -> run the calc backwards
          );
          setFieldValue(
            'maxAmountIn',
            toTokenUnitsBN(
              estimate.amountOut.toString(),
              tokenIn.decimals
            ),
          );
        } else {
          throw new Error(`Unsupported tokenIn: ${tokenIn.symbol}`);
        }
      } else {
        setFieldValue('maxAmountIn', ZERO_BN);
      }
    })();
  }, [Bean, Eth, Weth, beanstalk, hasSoil, farm, setFieldValue, soil, tokenIn, tokenOut]);

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
          disabled={!hasSoil || !values.maxAmountIn}
          max={MinBN(
            values.maxAmountIn || ZERO_BN,
            tokenInBalance?.total || ZERO_BN
          )}
          balance={tokenInBalance || undefined}
          state={values.tokens[0]}
          showTokenSelect={showTokenSelect}
          handleQuote={handleQuote}
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
                        token: tokenIn,
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
          contract={beanstalk}
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

const PREFERRED_TOKENS : PreferredToken[] = [
  {
    token: BEAN,
    minimum: new BigNumber(1),    // $1
  },
  {
    token: ETH,
    minimum: new BigNumber(0.001) // ~$2-4
  },
  {
    token: WETH,
    minimum: new BigNumber(0.001) // ~$2-4
  }
];

const Sow : FC<{}> = () => {
  /// Tokens
  const getChainToken = useGetChainToken();
  const Bean          = getChainToken(BEAN);
  const Eth           = getChainToken(ETH);
  const Weth          = getChainToken(WETH);

  /// Ledger
  const { data: signer } = useSigner();
  const provider  = useProvider();
  const beanstalk = useBeanstalkContract(signer);

  /// Farm
  const farm      = useMemo(() => new Farm(provider), [provider]);

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
  const baseToken = usePreferredToken(PREFERRED_TOKENS, 'use-best');
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
  }), [baseToken]);

  /// Handlers
  // This handler does not run when _tokenIn = _tokenOut
  // _tokenOut === Bean 
  const handleQuote = useCallback<QuoteHandler>(
    async (_tokenIn, _amountIn, _tokenOut) => {
      const steps : ChainableFunction[] = [];

      if (_tokenIn === Eth) {
        steps.push(...[
          farm.wrapEth(FarmToMode.INTERNAL),       // wrap ETH to WETH (internal)
          ...farm.buyBeans(FarmFromMode.INTERNAL)  // buy Beans using internal WETH
        ]);
      } else if (_tokenIn === Weth) {
        steps.push(
          ...farm.buyBeans(
            optimizeFromMode(_amountIn, balances[Weth.address]),
          )
        );
      } else {
        throw new Error(`Sowing via ${_tokenIn.symbol} is not currently supported`);
      }

      const amountIn = ethers.BigNumber.from(toStringBaseUnitBN(_amountIn, _tokenIn.decimals));
      const estimate = await Farm.estimate(
        steps,
        [amountIn]
      );
      
      return {
        amountOut: toTokenUnitsBN(estimate.amountOut.toString(), _tokenOut.decimals),
        value: estimate.value,
        steps: estimate.steps,
      };
    },
    [Weth, Eth, farm, balances]
  );

  const onSubmit = useCallback(async (values: SowFormValues, formActions: FormikHelpers<SowFormValues>) => {
    let txToast;
    try {
      middleware.before();

      const formData = values.tokens[0];
      const tokenIn = formData.token;
      const amountBeans = tokenIn === Bean ? formData.amount : formData.amountOut;
      if (values.tokens.length > 1) throw new Error('Only one token supported at this time');
      if (!amountBeans || amountBeans.eq(0)) throw new Error('No amount set');
      
      const data : string[] = [];
      const amountPods = amountBeans.times(weather.div(100).plus(1));
      let finalFromMode : FarmFromMode;
      
      txToast = new TransactionToast({
        loading: `Sowing ${displayFullBN(amountBeans, Bean.decimals)} Beans for ${displayFullBN(amountPods, PODS.decimals)} Pods...`,
        success: 'Sow successful.',
      });
      
      /// Sow directly from BEAN
      if (tokenIn === Bean) {
        // No swap occurs, so we know exactly how many beans are going in.
        // We can select from INTERNAL, EXTERNAL, INTERNAL_EXTERNAL.
        finalFromMode = optimizeFromMode(amountBeans, balances[Bean.address]);
      }
      
      /// Swap to BEAN and Sow
      else if (tokenIn === Eth || tokenIn === Weth) {
        // Require a quote
        if (!formData.steps || !formData.amountOut) throw new Error(`No quote available for ${formData.token.symbol}`);

        const encoded = Farm.encodeStepsWithSlippage(
          formData.steps,
          values.settings.slippage / 100,
        ); // 
        data.push(...encoded);

        // At the end of the Swap step, the assets will be in our INTERNAL balance.
        // The Swap decides where to route them from (see handleQuote).
        finalFromMode = FarmFromMode.INTERNAL_TOLERANT;
      } else {
        throw new Error(`Sowing via ${tokenIn.symbol} is not currently supported`);
      }
      
      data.push(
        beanstalk.interface.encodeFunctionData('sow', [
          toStringBaseUnitBN(amountBeans, Bean.decimals),
          finalFromMode,
        ])
      );
 
      const overrides = { value: formData.value };
      const txn = await beanstalk.farm(data, overrides);
      txToast.confirming(txn);
      
      const receipt = await txn.wait();
      await Promise.all([
        refetchFarmerField(),     // get farmer's plots
        refetchFarmerBalances(),  // get farmer's token balances
        refetchBeanstalkField(),  // get beanstalk field data (ex. amount of Soil left)
        refetchPools(),           // get price data [TODO: optimize if we bought beans]
      ]);  
      txToast.success(receipt);
      formActions.resetForm();
    } catch (err) {
      console.error(err);
      txToast?.error(err) || toast.error(parseError(err));
    } finally {
      formActions.setSubmitting(false);
    }
  }, [
    beanstalk,
    weather,
    Bean,
    Eth,
    Weth,
    balances,
    refetchFarmerField,
    refetchFarmerBalances,
    refetchBeanstalkField,
    refetchPools,
    middleware,
  ]);

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
            beanstalk={beanstalk}
            weather={weather}
            soil={soil}
            farm={farm}
            {...formikProps}
          />
        </>
      )}
    </Formik>
  );
};

export default Sow;
