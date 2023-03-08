import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import BigNumber from 'bignumber.js';
import { Token, ERC20Token, NativeToken, DataSource } from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { ClaimAndPlantFormState, FormStateNew, SettingInput, SmartSubmitButton, TxnSettings } from '~/components/Common/Form';
import TxnPreview from '~/components/Common/Form/TxnPreview';
import TxnSeparator from '~/components/Common/Form/TxnSeparator';
import PillRow from '~/components/Common/Form/PillRow';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import { displayFullBN, MaxBN, MinBN } from '~/util/Tokens';
import { ZERO_BN } from '~/constants';
import useToggle from '~/hooks/display/useToggle';
import { tokenValueToBN, bnToTokenValue } from '~/util';
import { FarmerSilo } from '~/state/farmer/silo';
import useSeason from '~/hooks/beanstalk/useSeason';
import { convert } from '~/lib/Beanstalk/Silo/Convert';
import TransactionToast from '~/components/Common/TxnToast';
import useBDV from '~/hooks/beanstalk/useBDV';
import TokenIcon from '~/components/Common/TokenIcon';
import { useFetchPools } from '~/state/bean/pools/updater';
import { ActionType } from '~/util/Actions';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import TokenSelectDialogNew from '~/components/Common/Form/TokenSelectDialogNew';
import TokenQuoteProviderWithParams from '~/components/Common/Form/TokenQuoteProviderWithParams';
import useSdk, { getNewToOldToken } from '~/hooks/sdk';
import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';
import ClaimAndPlantFarmActions from '~/components/Common/Form/ClaimAndPlantFarmOptions';
import ClaimAndPlantAdditionalOptions from '~/components/Common/Form/ClaimAndPlantAdditionalOptions';
import ClaimPlant from '~/util/ClaimPlant';
import useAccount from '~/hooks/ledger/useAccount';
import WarningAlert from '~/components/Common/Alert/WarningAlert';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import useFarmerClaimAndPlantOptions from '~/hooks/farmer/claim-plant/useFarmerClaimPlantOptions';
import TxnAccordion from '~/components/Common/TxnAccordion';
import useFarmerClaimPlant from '~/hooks/farmer/claim-plant/useFarmerClaimAndPlant';
import useFarmerClaimAndPlantRefetch from '~/hooks/farmer/claim-plant/useFarmerClaimAndPlantRefetch';

// -----------------------------------------------------------------------

type ConvertFormValues = FormStateNew & {
  settings: {
    slippage: number;
  };
  maxAmountIn: BigNumber | undefined;
  tokenOut: Token | undefined;
} & ClaimAndPlantFormState;

type ConvertQuoteHandlerParams = {
  slippage: number; 
}

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
    handleQuote: QuoteHandlerWithParams<ConvertQuoteHandlerParams>;
    currentSeason: BigNumber;
  }
> = ({
  tokenList,
  siloBalances,
  handleQuote,
  currentSeason,
  // Formik
  values,
  isSubmitting,
  setFieldValue,
}) => {
  const sdk = useSdk();
  const claimPlantOptions = useFarmerClaimAndPlantOptions();
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
          getNewToOldToken(tokenIn),   // from
          getNewToOldToken(tokenOut),  // to
          _amountIn, // amount
          siloBalance?.deposited.crates || [], // depositedCrates
          currentSeason,
        )
      );
    }
  }, [currentSeason, isQuoting, siloBalance?.deposited.crates, tokenIn, tokenOut]);

  const claimPlantTxnActions = useMemo(() => {
    const { selected, additional } = values.farmActions;
    return claimPlantOptions.getTxnActions(
      selected,
      additional
    );
  }, [claimPlantOptions, values.farmActions]);

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
        tokenValueToBN(tokenOut.getStalk(bnToTokenValue(tokenOut, deltaBDV))),
        ZERO_BN
      );
      deltaSeedsPerBDV = (
        tokenOut.getSeeds().sub(tokenValueToBN(tokenIn.getSeeds()).toNumber())
      );
      deltaSeeds = (
        tokenValueToBN(tokenOut.getSeeds(bnToTokenValue(tokenOut, bdvOut))  // seeds for depositing this token with new BDV
          .sub(bnToTokenValue(tokenOut, conversion.seeds.abs())))   // seeds lost when converting
      );
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
          await sdk.contracts.beanstalk.getMaxAmountIn(
            tokenIn.address,
            tokenOut.address,
          )
          .then((amt) => tokenValueToBN(tokenIn.amount(amt.toString())))
          .catch(() => ZERO_BN) // if calculation fails, consider this pathway unavailable
        );
        setFieldValue('maxAmountIn', _maxAmountIn);
      }
    })();
  }, [sdk.contracts.beanstalk, setFieldValue, tokenIn, tokenOut]);

  const maxAmountUsed = (amountIn && maxAmountIn) ? amountIn.div(maxAmountIn) : null;

  return (
    <Form noValidate autoComplete="off">
      <TokenSelectDialogNew
        open={isTokenSelectVisible}
        handleClose={hideTokenSelect}
        handleSubmit={handleSelectTokenOut}
        selected={values.tokens}
        tokenList={tokenList}
        mode={TokenSelectMode.SINGLE}
      />
      <Stack gap={1}>
        {/* Input token */}
        <TokenQuoteProviderWithParams<ConvertQuoteHandlerParams>
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
          params={{
            slippage: values.settings.slippage
          }}
          belowComponent={
            <ClaimAndPlantFarmActions />
          }
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
        {/* Warning Alert */}
        {(!canConvert && tokenOut) ? (
          <Box>
            <WarningAlert iconSx={{ alignItems: 'flex-start' }}>
              {tokenIn.symbol} can only be Converted to {tokenOut?.symbol} when deltaB {tokenIn.isLP || tokenIn.symbol === 'urBEAN3CRV' ? '<' : '>'} 0.<br />
              {/* <Typography sx={{ opacity: 0.7 }} fontSize={FontSize.sm}>Press ⌥ + 1 to see deltaB.</Typography> */}
            </WarningAlert>
          </Box>
        ) : null}
        {(amountIn && tokenOut && maxAmountIn && amountOut?.gt(0)) ? (
          <>
            <TxnSeparator mt={-1} />
            <TokenOutput>
              <TokenOutput.Row 
                token={tokenOut}
                amount={amountOut || ZERO_BN}
                delta={bdvOut ? `~${displayFullBN(bdvOut, 2)} BDV` : undefined}
              />
              <TokenOutput.Row 
                token={sdk.tokens.STALK}
                amount={deltaStalk || ZERO_BN}
                amountTooltip={
                  deltaBDV?.gt(0) ? (
                    <>
                      Converting will increase the BDV of your Deposit by {displayFullBN(deltaBDV || ZERO_BN, 6)}{deltaBDV?.gt(0) ? ', resulting in a gain of Stalk' : ''}.
                    </>
                  ) : (
                    <>
                      The BDV of your Deposit won&apos;t change with this Convert.
                    </>
                  )
                }
              />
              <TokenOutput.Row 
                token={sdk.tokens.SEEDS}
                amount={deltaSeeds || ZERO_BN}
                amountTooltip={
                  <>
                    Converting from {tokenIn.symbol} to {tokenOut.symbol} results in {(
                      (!deltaSeedsPerBDV || deltaSeedsPerBDV.eq(0)) 
                        ? 'no change in SEEDS per BDV'
                        : `a ${deltaSeedsPerBDV.gt(0) ? 'gain' : 'loss'} of ${deltaSeedsPerBDV.abs().toHuman()} Seeds per BDV`
                    )}.
                  </>
                }
              />
            </TokenOutput>
            {(maxAmountUsed && maxAmountUsed.gt(0.9)) ? (
              <Box>
                <WarningAlert>
                  You are converting {displayFullBN(maxAmountUsed.times(100), 4, 0)}% of the way to the peg. 
                  When Converting all the way to the peg, the Convert may fail due to a small amount of slippage in the direction of the peg.
                </WarningAlert>
              </Box>
            ) : null}
            <ClaimAndPlantAdditionalOptions />
            <Box>
              <TxnAccordion defaultExpanded={false}>
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
                  {...claimPlantTxnActions}
                />
              </TxnAccordion>
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
  fromToken: ERC20Token | NativeToken;
}> = ({
  fromToken
}) => {
  const sdk = useSdk();
  const claimPlant = useFarmerClaimPlant();
  const account = useAccount();

  const [refetchClaimPlant] = useFarmerClaimAndPlantRefetch();
  
  /// Token List
  const [tokenList, initialTokenOut] = useMemo(() => {
    const { BEAN, BEAN_CRV3_LP, UNRIPE_BEAN, UNRIPE_BEAN_CRV3 } = sdk.tokens;
    const allTokens = fromToken.isUnripe
      ? [UNRIPE_BEAN, UNRIPE_BEAN_CRV3]
      : [BEAN, BEAN_CRV3_LP];
    const _tokenList = allTokens.filter((_token) => !_token.equals(fromToken));
    return [
      _tokenList,     // all available tokens to convert to
      _tokenList[0],  // tokenOut is the first available token that isn't the fromToken
    ];
  }, [sdk.tokens, fromToken]);

  /// Beanstalk
  const season = useSeason();

  /// Farmer
  const farmerSilo              = useFarmerSilo();
  const farmerSiloBalances      = farmerSilo.balances;
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
    farmActions: {
      preset: 'plant',
      selected: undefined,
      additional: undefined,
    },

  }), [fromToken, initialTokenOut]);

  /// Handlers
  // This handler does not run when _tokenIn = _tokenOut (direct deposit)
  const handleQuote = useCallback<QuoteHandlerWithParams<ConvertQuoteHandlerParams>>(
    async (tokenIn, amountIn, tokenOut, { slippage }) => {
      const siloConvert = sdk.silo.siloConvert;
      const whitelist = [
        siloConvert.Bean, 
        siloConvert.BeanCrv3, 
        siloConvert.urBean, 
        siloConvert.urBeanCrv3
      ];

      const [inToken, outToken] = whitelist.reduce((prev, curr) => {
        prev[0] = curr.equals(tokenIn) ? curr : prev[0];
        prev[1] = curr.equals(tokenOut) ? curr : prev[1];
        return prev;
      }, [null, null] as [Token | null, Token | null]);

      if (!inToken || !outToken) throw new Error('conversion unavailable');

      const { minAmountOut } = await siloConvert.convertEstimate(
        inToken, 
        outToken, 
        inToken.amount(amountIn.toString()), 
        slippage
      );

      return tokenValueToBN(minAmountOut);
    },
    [sdk]
  );

  // const tkIn = sdk.tokens.siloWhitelist.has(fromToken);
  // console.log('tk in is in whitelist:', tkIn);

  const onSubmit = useCallback(async (values: ConvertFormValues, formActions: FormikHelpers<ConvertFormValues>) => {
    let txToast;
    try {
      const { beanstalk } = sdk.contracts;
      middleware.before();

      const slippage = values?.settings?.slippage;
      if (!account) throw new Error('Wallet connection required');
      if (!values.settings.slippage) throw new Error('No slippage value set.');
      if (!values.tokenOut) throw new Error('No output token selected');
      if (!values.tokens[0].amount?.gt(0)) throw new Error('No amount input');
      if (!values.tokens[0].amountOut) throw new Error('No quote available.');

      const siloConvert = sdk.silo.siloConvert;
      // we define this here b/c otherwise txn errors out b/c siloConvert expects token instances from it's own class
      const whitelist = [siloConvert.Bean, siloConvert.BeanCrv3, siloConvert.urBean, siloConvert.urBeanCrv3];
      const _tkIn = values.tokens[0].token;
      const _tkOut = values.tokenOut;
    
      const [tokenIn, tokenOut] = whitelist.reduce((prev, curr) => {
        prev[0] = curr.equals(_tkIn) ? curr : prev[0];
        prev[1] = curr.equals(_tkOut) ? curr : prev[1];
        return prev;
      }, [null, null] as [Token | null, Token | null]);

      if (!tokenIn || !tokenOut) throw new Error('Token not whitelisted.');
      await siloConvert.validateTokens(tokenIn, tokenOut);
      const balances = await sdk.silo.getBalance(tokenIn, account, { source: DataSource.LEDGER });

      const amountIn  = tokenIn.amount(values.tokens[0].amount.toString());           // amount of from token
      const amountOut = tokenOut.amount(values.tokens[0].amountOut.toString());       // amount of to token
      const depositedCrates = balances.deposited.crates;

      const conversion = siloConvert.calculateConvert(
        tokenIn,
        tokenOut,
        amountIn,
        depositedCrates,
        season.toNumber(),
      );

      txToast = new TransactionToast({
        loading: 'Converting...',
        success: 'Convert successful.',
      });

      const crates  = conversion.crates.map((crate) => crate.season.toString());
      const amounts = conversion.crates.map((crate) => crate.amount.toBlockchain());

      const callData = beanstalk.interface.encodeFunctionData('convert', [
        siloConvert.calculateEncoding(
          tokenIn, 
          tokenOut, 
          amountIn, 
          amountOut
        ),
        crates,
        amounts
      ]);

      const work = sdk.farm.create('Convert').add(
        async (_amountInStep: ethers.BigNumber, _context: any) => ({
          name: 'convert',
          amountOut: _amountInStep,
          prepare: () => ({
            target: beanstalk.address,
            callData: callData,
          }),
          decode: (data: string) => beanstalk.interface.decodeFunctionData('convert', data),
          decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('convert', result)
        })
      );

      const { primaryActions, additionalActions, actionsPerformed } = claimPlant.compile(values.farmActions);

      const { execute } = await ClaimPlant.build(
        sdk,
        primaryActions,
        additionalActions,
        work,
        amountIn,
        { slippage },
      );

      const txn = await execute();
      txToast.confirming(txn);

      const receipt = await txn.wait();

      await refetchClaimPlant(actionsPerformed, { 
        farmerSilo: true, // update farmer silo since we just moved deposits around
      }, [refetchPools]);  // update prices to account for pool conversion

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
      formActions.setSubmitting(false);
    }
  }, [sdk, middleware, account, season, claimPlant, refetchClaimPlant, refetchPools]);

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
            currentSeason={season}
            {...formikProps}
          />
        </>
      )}
    </Formik>
  );
};

export default Convert;
