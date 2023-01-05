import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Accordion, AccordionDetails, Alert, Box, Stack, Typography } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import BigNumber from 'bignumber.js';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import TokenOutputField from '~/components/Common/Form/TokenOutputField';
import StyledAccordionSummary from '~/components/Common/Accordion/AccordionSummary';
import { FormState, SettingInput, SmartSubmitButton, TxnSettings } from '~/components/Common/Form';
import TokenQuoteProvider from '~/components/Common/Form/TokenQuoteProvider';
import TxnPreview from '~/components/Common/Form/TxnPreview';
import Token, { ERC20Token, NativeToken } from '~/classes/Token';
import Pool from '~/classes/Pool';
import TxnSeparator from '~/components/Common/Form/TxnSeparator';
import PillRow from '~/components/Common/Form/PillRow';
import TokenSelectDialog, { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import { BEAN, BEAN_CRV3_LP, SEEDS, STALK, UNRIPE_BEAN, UNRIPE_BEAN_CRV3 } from '~/constants/tokens';
import BeanstalkSDK from '~/lib/Beanstalk';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import { displayFullBN, MaxBN, MinBN, toStringBaseUnitBN } from '~/util/Tokens';
import { Beanstalk } from '~/generated/index';
import { QuoteHandler } from '~/hooks/ledger/useQuote';
import { ZERO_BN } from '~/constants';
import Farm from '~/lib/Beanstalk/Farm';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
import useToggle from '~/hooks/display/useToggle';
import { useSigner } from '~/hooks/ledger/useSigner';
import { useFetchFarmerSilo } from '~/state/farmer/silo/updater';
import { tokenResult, parseError } from '~/util';
import { FarmerSilo } from '~/state/farmer/silo';
import useSeason from '~/hooks/beanstalk/useSeason';
import { convert, Encoder as ConvertEncoder } from '~/lib/Beanstalk/Silo/Convert';
import TransactionToast from '~/components/Common/TxnToast';
import useBDV from '~/hooks/beanstalk/useBDV';
import TokenIcon from '~/components/Common/TokenIcon';
import { useFetchPools } from '~/state/bean/pools/updater';
import { ActionType } from '~/util/Actions';
import { IconSize } from '~/components/App/muiTheme';
import IconWrapper from '~/components/Common/IconWrapper';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';

// -----------------------------------------------------------------------

type ConvertFormValues = FormState & {
  settings: {
    slippage: number;
  };
  maxAmountIn: BigNumber | undefined;
  tokenOut: Token | undefined;
};

// -----------------------------------------------------------------------

const INIT_CONVERSION = {
  amount: ZERO_BN,
  bdv:    ZERO_BN,
  stalk:  ZERO_BN,
  seeds:  ZERO_BN,
  actions: []
};

const ConvertForm : FC<
  FormikProps<ConvertFormValues> & {
    /** List of tokens that can be converted to. */
    tokenList: (ERC20Token | NativeToken)[];
    /** Farmer's silo balances */
    siloBalances: FarmerSilo['balances'];
    beanstalk: Beanstalk;
    handleQuote: QuoteHandler;
    currentSeason: BigNumber;
  }
> = ({
  tokenList,
  siloBalances,
  beanstalk,
  handleQuote,
  currentSeason,
  // Formik
  values,
  isSubmitting,
  setFieldValue,
}) => {
  /// Local state
  const [isTokenSelectVisible, showTokenSelect, hideTokenSelect] = useToggle();
  const getBDV = useBDV();

  /// Extract values from form state
  const tokenIn   = values.tokens[0].token;     // converting from token
  const amountIn  = values.tokens[0].amount;    // amount of from token
  const tokenOut  = values.tokenOut;            // converting to token
  const amountOut = values.tokens[0].amountOut; // amount of to token
  const maxAmountIn     = values.maxAmountIn;
  const canConvert      = maxAmountIn?.gt(0) || false;
  const siloBalance     = siloBalances[tokenIn.address]; // FIXME: this is mistyped, may not exist
  const depositedAmount = siloBalance?.deposited.amount || ZERO_BN;
  const isQuoting = values.tokens[0].quoting || false;

  /// Derived form state
  let isReady        = false;
  let buttonLoading  = false;
  let buttonContent  = 'Convert';
  let bdvOut;     // the BDV received after re-depositing `amountOut` of `tokenOut`.
  let bdvIn;
  let deltaBDV : (BigNumber | undefined); // the change in BDV during the convert. should always be >= 0.
  let deltaStalk; // the change in Stalk during the convert. should always be >= 0.
  let deltaSeedsPerBDV; // change in seeds per BDV for this pathway. ex: bean (2 seeds) -> bean:3crv (4 seeds) = +2 seeds.
  let deltaSeeds; // the change in seeds during the convert.

  ///
  const [conversion, setConversion] = useState(INIT_CONVERSION);
  const runConversion = useCallback((_amountIn: BigNumber) => {
    if (!tokenOut) {
      setConversion(INIT_CONVERSION);
    } else if (tokenOut && !isQuoting) {
      console.debug('[Convert] setting conversion, ', tokenOut, isQuoting);
      setConversion(
        convert(
          tokenIn,   // from
          tokenOut,  // to
          _amountIn, // amount
          siloBalance?.deposited.crates || [], // depositedCrates
          currentSeason,
        )
      );
    }
  }, [currentSeason, isQuoting, siloBalance?.deposited.crates, tokenIn, tokenOut]);

  /// FIXME: is there a better pattern for this?
  /// we want to refresh the conversion info only
  /// when the quoting is complete and amountOut
  /// has been updated respectively. if runConversion
  /// depends on amountIn it will run every time the user
  /// types something into the input.
  useEffect(() => {
    runConversion(amountIn || ZERO_BN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountOut, runConversion]);

  /// Change button state and prepare outputs
  if (depositedAmount.eq(0)) {
    buttonContent = 'Nothing to Convert';
  } else if (values.maxAmountIn === null) {
    if (values.tokenOut) {
      buttonContent = 'Refreshing convert data...';
      buttonLoading = false;
    } else {
      buttonContent = 'No output selected';
      buttonLoading = false;
    }
  } else if (!canConvert) {
    // buttonContent = 'Pathway unavailable';
  } else  {
    buttonContent = 'Convert';
    if (tokenOut && amountOut?.gt(0)) {
      isReady    = true;
      bdvOut     = getBDV(tokenOut).times(amountOut);
      deltaBDV   = MaxBN(
        bdvOut.minus(conversion.bdv.abs()),
        ZERO_BN
      );
      deltaStalk = MaxBN(
        tokenOut.getStalk(deltaBDV),
        ZERO_BN
      );
      deltaSeedsPerBDV = (
        tokenOut.getSeeds()
          .minus(tokenIn.getSeeds())
      );
      deltaSeeds = (
        tokenOut.getSeeds(bdvOut)  // seeds for depositing this token with new BDV
          .minus(conversion.seeds.abs())   // seeds lost when converting
      );
      //
      console.log(`BDV: ${getBDV(tokenOut)}`);
      console.log(`amountOut: ${amountOut}`);
      console.log(`bdvIn: ${conversion.bdv}`);
      console.log(`bdvOut: ${bdvOut}`);
      console.log('Conversion: ', conversion);
    }
  }
  
  /// When a new output token is selected, reset maxAmountIn.
  const handleSelectTokenOut = useCallback(async (_tokens: Set<Token>) => {
    const arr = Array.from(_tokens);
    if (arr.length !== 1) throw new Error();
    const _tokenOut = arr[0];
    /// only reset if the user clicked a different token
    if (tokenOut !== _tokenOut) {
      setFieldValue('tokenOut', _tokenOut);
      setFieldValue('maxAmountIn', null);
    }
  }, [setFieldValue, tokenOut]);

  /// When `tokenIn` or `tokenOut` changes, refresh the
  /// max amount that the user can input of `tokenIn`.
  /// FIXME: flash when clicking convert tab
  useEffect(() => {
    (async () => {
      if (tokenOut) {
        const _maxAmountIn = (
          await beanstalk.getMaxAmountIn(
            tokenIn.address,
            tokenOut.address,
          )
          .then(tokenResult(tokenIn))
          .catch(() => ZERO_BN) // if calculation fails, consider this pathway unavailable
        );
        setFieldValue('maxAmountIn', _maxAmountIn);
      }
    })();
  }, [beanstalk, setFieldValue, tokenIn, tokenOut]);

  const maxAmountUsed = (amountIn && maxAmountIn) ? amountIn.div(maxAmountIn) : null;

  return (
    <Form noValidate autoComplete="off">
      <TokenSelectDialog
        open={isTokenSelectVisible}
        handleClose={hideTokenSelect}
        handleSubmit={handleSelectTokenOut}
        selected={values.tokens}
        tokenList={tokenList}
        mode={TokenSelectMode.SINGLE}
      />
      <Stack gap={1}>
        {/* Input token */}
        <TokenQuoteProvider
          name="tokens.0"
          tokenOut={(tokenOut || tokenIn) as ERC20Token}
          max={MinBN(values.maxAmountIn || ZERO_BN, depositedAmount)}
          balance={depositedAmount}
          balanceLabel="Deposited Balance"
          state={values.tokens[0]}
          handleQuote={handleQuote}
          displayQuote={(_amountOut) => (
            (_amountOut && deltaBDV) && (
              <Typography variant="body1">
                ~{displayFullBN(conversion.bdv.abs(), 2)} BDV
              </Typography>
            )
          )}
          tokenSelectLabel={tokenIn.symbol}
          disabled={(
            !values.maxAmountIn         // still loading `maxAmountIn`
            || values.maxAmountIn.eq(0) // = 0 means we can't make this conversion
          )}
        />
        {/* Output token */}
        {depositedAmount.gt(0) ? (
          <PillRow
            isOpen={isTokenSelectVisible}
            label="Convert to"
            onClick={showTokenSelect}
          >
            {tokenOut ? <TokenIcon token={tokenOut} /> : null}
            <Typography>{tokenOut?.symbol || 'Select token'}</Typography>
          </PillRow>
        ) : null}
        {(!canConvert && tokenOut) ? (
          <Box>
            <Alert
              color="warning"
              icon={(
                <IconWrapper boxSize={IconSize.medium}>
                  <WarningAmberIcon sx={{ fontSize: IconSize.small, alignItems: 'flex-start' }} />
                </IconWrapper>
              )}
            >
              {tokenIn.symbol} can only be Converted to {tokenOut.symbol} when deltaB {tokenIn.isLP || tokenIn.symbol === 'urBEAN3CRV' ? '<' : '>'} 0.<br />
              {/* <Typography sx={{ opacity: 0.7 }} fontSize={FontSize.sm}>Press ⌥ + 1 to see deltaB.</Typography> */}
            </Alert>
          </Box>
        ) : null}
        {(amountIn && tokenOut && maxAmountIn && amountOut?.gt(0)) ? (
          <>
            <TxnSeparator mt={-1} />
            <TokenOutputField
              token={tokenOut}
              amount={amountOut || ZERO_BN}
              amountSecondary={bdvOut ? `~${displayFullBN(bdvOut, 2)} BDV` : undefined}
            />
            <Stack direction={{ xs: 'column', md: 'row' }} gap={1} justifyContent="center">
              <Box sx={{ flex: 1 }}>
                <TokenOutputField
                  token={STALK}
                  amount={deltaStalk || ZERO_BN}
                  amountTooltip={( 
                    deltaBDV?.gt(0) ? (
                      <>
                        Converting will increase the BDV of your Deposit by {displayFullBN(deltaBDV || ZERO_BN, 6)}{deltaBDV?.gt(0) ? ', resulting in a gain of Stalk' : ''}.
                      </>
                    ) : (
                      <>
                        The BDV of your Deposit won&apos;t change with this Convert.
                      </>
                    )
                  )}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <TokenOutputField
                  token={SEEDS}
                  amount={deltaSeeds || ZERO_BN}
                  amountTooltip={(
                    <>
                      Converting from {tokenIn.symbol} to {tokenOut.symbol} results in {(
                        (!deltaSeedsPerBDV || deltaSeedsPerBDV.eq(0)) 
                          ? 'no change in SEEDS per BDV'
                          : `a ${deltaSeedsPerBDV.gt(0) ? 'gain' : 'loss'} of ${deltaSeedsPerBDV.abs().toString()} Seeds per BDV`
                      )}.
                    </>
                  )}
                />
              </Box>
            </Stack>
            {(maxAmountUsed && maxAmountUsed.gt(0.9)) ? (
              <Box>
                <Alert color="warning" icon={<IconWrapper boxSize={IconSize.medium}><WarningAmberIcon color="warning" sx={{ fontSize: IconSize.small }} /></IconWrapper>}>
                  You are converting {displayFullBN(maxAmountUsed.times(100), 4, 0)}% of the way to the peg. 
                  When Converting all the way to the peg, the Convert may fail due to a small amount of slippage in the direction of the peg.
                </Alert>
              </Box>
            ) : null}
            <Box>
              <Accordion variant="outlined">
                <StyledAccordionSummary title="Transaction Details" />
                <AccordionDetails>
                  <TxnPreview
                    actions={[
                      {
                        type: ActionType.BASE,
                        message: `Convert ${displayFullBN(amountIn, tokenIn.displayDecimals)} ${tokenIn.name} to ${displayFullBN(amountOut, tokenIn.displayDecimals)} ${tokenOut.name}.`
                      },
                      {
                        type: ActionType.UPDATE_SILO_REWARDS,
                        stalk: deltaStalk || ZERO_BN,
                        seeds: deltaSeeds || ZERO_BN,
                      }
                    ]}
                  />
                </AccordionDetails>
              </Accordion>
            </Box>
          </>
        ) : null}
        <SmartSubmitButton
          loading={buttonLoading || isQuoting}
          disabled={!isReady || isSubmitting}
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          tokens={[]}
          mode="auto"
        >
          {buttonContent}
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

// -----------------------------------------------------------------------

const Convert : FC<{
  pool: Pool;
  fromToken: ERC20Token | NativeToken;
}> = ({
  pool,
  fromToken
}) => {
  /// Tokens
  const getChainToken = useGetChainToken();
  const Bean          = getChainToken(BEAN);
  const BeanCrv3      = getChainToken(BEAN_CRV3_LP);
  const urBean        = getChainToken(UNRIPE_BEAN);
  const urBeanCrv3    = getChainToken(UNRIPE_BEAN_CRV3);

  /// Ledger
  const { data: signer }  = useSigner();
  const beanstalk         = useBeanstalkContract(signer);
  
  /// Token List
  const [tokenList, initialTokenOut] = useMemo(() => {
    const allTokens = (fromToken === urBean || fromToken === urBeanCrv3)
      ? [
        urBean,
        urBeanCrv3,
      ]
      : [
        Bean,
        BeanCrv3,
      ];
    const _tokenList = allTokens.filter((_token) => _token !== fromToken);
    return [
      _tokenList,     // all available tokens to convert to
      _tokenList[0],  // tokenOut is the first available token that isn't the fromToken
    ];
  }, [urBean, urBeanCrv3, Bean, BeanCrv3, fromToken]);

  /// Beanstalk
  const season = useSeason();

  /// Farmer
  const farmerSilo              = useFarmerSilo();
  const farmerSiloBalances      = farmerSilo.balances;
  const [refetchFarmerSilo]     = useFetchFarmerSilo();
  const [refetchPools]          = useFetchPools();

  /// Form
  const middleware    = useFormMiddleware();
  const initialValues : ConvertFormValues = useMemo(() => ({
    // Settings
    settings: {
      slippage: 0.1,
    },
    // Token Inputs
    tokens: [
      {
        token:      fromToken,
        amount:     undefined,
        quoting:    false,
        amountOut:  undefined,
      },
    ],
    // Convert data
    maxAmountIn:    undefined,
    // Token Outputs
    tokenOut:       initialTokenOut,
  }), [fromToken, initialTokenOut]);

  /// Handlers
  // This handler does not run when _tokenIn = _tokenOut (direct deposit)
  const handleQuote = useCallback<QuoteHandler>(
    async (_tokenIn, _amountIn, _tokenOut) => beanstalk.getAmountOut(
      _tokenIn.address,
      _tokenOut.address,
      toStringBaseUnitBN(_amountIn, _tokenIn.decimals),
    ).then(tokenResult(_tokenOut)),
    [beanstalk]
  );

  const onSubmit = useCallback(async (values: ConvertFormValues, formActions: FormikHelpers<ConvertFormValues>) => {
    let txToast;
    try {
      middleware.before();
      if (!values.settings.slippage) throw new Error('No slippage value set.');
      if (!values.tokenOut) throw new Error('No output token selected');
      if (!values.tokens[0].amount?.gt(0)) throw new Error('No amount input');
      if (!values.tokens[0].amountOut) throw new Error('No quote available.');
      
      const tokenIn   = values.tokens[0].token;     // converting from token
      const amountIn  = values.tokens[0].amount;    // amount of from token
      const tokenOut  = values.tokenOut;            // converting to token
      const amountOut = values.tokens[0].amountOut; // amount of to token
      const amountInStr  = tokenIn.stringify(amountIn);
      const amountOutStr = Farm.slip(
        ethers.BigNumber.from(tokenOut.stringify(amountOut)),
        values.settings.slippage / 100
      ).toString();
      
      const depositedCrates = farmerSiloBalances[tokenIn.address]?.deposited?.crates;
      if (!depositedCrates) throw new Error('No deposited crates available.');

      const conversion = BeanstalkSDK.Silo.Convert.convert(
        tokenIn,  // from
        tokenOut, // to
        amountIn,
        depositedCrates,
        season,
      );

      txToast = new TransactionToast({
        loading: 'Converting...',
        success: 'Convert successful.',
      });

      /// FIXME:
      /// Once the number of pathways increases, use a matrix
      /// to calculate available conversions and the respective
      /// encoding strategy. Just gotta get to Replant...
      let convertData;
      if (tokenIn === urBean && tokenOut === urBeanCrv3) {
        convertData = ConvertEncoder.unripeBeansToLP(
          amountInStr,      // amountBeans
          amountOutStr,     // minLP
        );
      } else if (tokenIn === urBeanCrv3 && tokenOut === urBean) {
        convertData = ConvertEncoder.unripeLPToBeans(
          amountInStr,      // amountLP
          amountOutStr,     // minBeans
        );
      } else if (tokenIn === Bean && tokenOut === BeanCrv3) {
        convertData = ConvertEncoder.beansToCurveLP(
          amountInStr,      // amountBeans
          amountOutStr,     // minLP
          tokenOut.address, // output token address = pool address
        );
      } else if (tokenIn === BeanCrv3 && tokenOut === Bean) {
        convertData = ConvertEncoder.curveLPToBeans(
          amountInStr,      // amountLP
          amountOutStr,     // minBeans
          tokenIn.address,  // output token address = pool address
        );
      } else {
        throw new Error('Unknown conversion pathway');
      }

      const crates  = conversion.deltaCrates.map((crate) => crate.season.toString());
      const amounts = conversion.deltaCrates.map((crate) => tokenIn.stringify(crate.amount.abs()));

      /// HOTFIX:
      /// If farmer has > 0 Earned beans, add a plant() call before
      /// convert. Fixes edge case bug where converting all of your
      /// silo assets causes loss of Earned Beans.
      let call;
      if (farmerSilo.beans.earned.gt(0)) {
        call = beanstalk.farm([
          beanstalk.interface.encodeFunctionData('plant'),
          beanstalk.interface.encodeFunctionData('convert', [
            convertData,
            crates,
            amounts
          ])
        ]);
      } else {
        call = beanstalk.convert(
          convertData,
          crates,
          amounts
        );
      }
      
      console.debug('[Convert] executing', {
        tokenIn,
        amountIn,
        tokenOut,
        amountOut,
        amountInStr,
        amountOutStr,
        depositedCrates,
        conversion,
        convertData,
        crates,
        amounts,
      });

      ///
      const txn = await call;
      txToast.confirming(txn);

      const receipt = await txn.wait();
      await Promise.all([
        refetchFarmerSilo(),  // update farmer silo since we just moved deposits around
        refetchPools(),       // update prices to account for pool conversion
      ]);
      txToast.success(receipt);
      formActions.resetForm({
        values: {
          ...initialValues,
          tokenOut: undefined,
        }
      });
    } catch (err) {
      console.error(err);
      txToast ? txToast.error(err) : toast.error(parseError(err));
      formActions.setSubmitting(false);
    }
  }, [farmerSiloBalances, farmerSilo.beans.earned, season, urBean, urBeanCrv3, Bean, BeanCrv3, beanstalk, refetchFarmerSilo, refetchPools, initialValues, middleware]);

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit}>
      {(formikProps) => (
        <>
          <TxnSettings placement="form-top-right">
            <SettingInput name="settings.slippage" label="Slippage Tolerance" endAdornment="%" />
          </TxnSettings>
          <ConvertForm
            handleQuote={handleQuote}
            tokenList={tokenList as (ERC20Token | NativeToken)[]}
            siloBalances={farmerSiloBalances}
            beanstalk={beanstalk}
            currentSeason={season}
            {...formikProps}
          />
        </>
      )}
    </Formik>
  );
};

export default Convert;
