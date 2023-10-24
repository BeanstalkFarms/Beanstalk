import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, Tooltip } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import BigNumber from 'bignumber.js';
import {
  Token,
  ERC20Token,
  NativeToken,
  DataSource,
  BeanstalkSDK,
  TokenValue,
  ConvertDetails,
} from '@beanstalk/sdk';
import {
  FormStateNew,
  FormTxnsFormState,
  SettingInput,
  SmartSubmitButton,
  TxnSettings,
} from '~/components/Common/Form';
import TxnPreview from '~/components/Common/Form/TxnPreview';
import TxnSeparator from '~/components/Common/Form/TxnSeparator';
import PillRow from '~/components/Common/Form/PillRow';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import { displayFullBN, MaxBN, MinBN } from '~/util/Tokens';
import { ZERO_BN } from '~/constants';
import useToggle from '~/hooks/display/useToggle';
import { tokenValueToBN, bnToTokenValue, transform } from '~/util';
import { FarmerSilo } from '~/state/farmer/silo';
import useSeason from '~/hooks/beanstalk/useSeason';
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
import useSdk from '~/hooks/sdk';
import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';
import useAccount from '~/hooks/ledger/useAccount';
import WarningAlert from '~/components/Common/Alert/WarningAlert';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import TxnAccordion from '~/components/Common/TxnAccordion';
import AdditionalTxnsAccordion from '~/components/Common/Form/FormTxn/AdditionalTxnsAccordion';
import useFarmerFormTxnsActions from '~/hooks/farmer/form-txn/useFarmerFormTxnActions';
import useAsyncMemo from '~/hooks/display/useAsyncMemo';
import AddPlantTxnToggle from '~/components/Common/Form/FormTxn/AddPlantTxnToggle';
import FormTxnProvider from '~/components/Common/Form/FormTxnProvider';
import useFormTxnContext from '~/hooks/sdk/useFormTxnContext';
import { FormTxn, ConvertFarmStep } from '~/lib/Txn';
import usePlantAndDoX from '~/hooks/farmer/form-txn/usePlantAndDoX';
import StatHorizontal from '~/components/Common/StatHorizontal';

// -----------------------------------------------------------------------

type ConvertFormValues = FormStateNew & {
  settings: {
    slippage: number;
  };
  maxAmountIn: BigNumber | undefined;
  tokenOut: Token | undefined;
} & FormTxnsFormState;

type ConvertQuoteHandlerParams = {
  slippage: number;
  isConvertingPlanted: boolean;
};

// -----------------------------------------------------------------------

const INIT_CONVERSION = {
  amount: ZERO_BN,
  bdv: ZERO_BN,
  stalk: ZERO_BN,
  seeds: ZERO_BN,
  actions: [],
};

const ConvertForm: FC<
  FormikProps<ConvertFormValues> & {
    /** List of tokens that can be converted to. */
    tokenList: (ERC20Token | NativeToken)[];
    /** Farmer's silo balances */
    siloBalances: FarmerSilo['balances'];
    handleQuote: QuoteHandlerWithParams<ConvertQuoteHandlerParams>;
    currentSeason: BigNumber;
    /** other */
    sdk: BeanstalkSDK;
    conversion: ConvertDetails;
    plantAndDoX: ReturnType<typeof usePlantAndDoX>;
  }
> = ({
  tokenList,
  siloBalances,
  handleQuote,
  currentSeason,
  plantAndDoX,
  sdk,
  // Formik
  values,
  isSubmitting,
  setFieldValue,
  conversion,
}) => {
  /// Local state
  const [isTokenSelectVisible, showTokenSelect, hideTokenSelect] = useToggle();
  const getBDV = useBDV();

  const plantCrate = plantAndDoX?.crate?.bn;

  /// Extract values from form state
  const tokenIn = values.tokens[0].token; // converting from token
  const amountIn = values.tokens[0].amount; // amount of from token
  const tokenOut = values.tokenOut; // converting to token
  const amountOut = values.tokens[0].amountOut; // amount of to token
  const maxAmountIn = values.maxAmountIn;
  const canConvert = maxAmountIn?.gt(0) || false;

  // FIXME: these use old structs instead of SDK
  const siloBalance = siloBalances[tokenIn.address];
  const depositedAmount = siloBalance?.deposited.amount || ZERO_BN;

  const isQuoting = values.tokens[0].quoting || false;
  const slippage = values.settings.slippage;

  const isUsingPlanted = Boolean(
    values.farmActions.primary?.includes(FormTxn.PLANT) &&
      sdk.tokens.BEAN.equals(tokenIn)
  );

  const totalAmountIn =
    isUsingPlanted && plantCrate
      ? (amountIn || ZERO_BN).plus(plantCrate.amount)
      : amountIn;

  /// Derived form state
  let isReady = false;
  let buttonLoading = false;
  let buttonContent = 'Convert';
  let bdvOut: BigNumber; // the BDV received after re-depositing `amountOut` of `tokenOut`.
  let bdvIn: BigNumber; // BDV of amountIn.
  let depositsBDV: BigNumber; // BDV of the deposited crates.
  let deltaBDV: BigNumber | undefined; // the change in BDV during the convert. should always be >= 0.
  let deltaStalk; // the change in Stalk during the convert. should always be >= 0.
  let deltaSeedsPerBDV; // change in seeds per BDV for this pathway. ex: bean (2 seeds) -> bean:3crv (4 seeds) = +2 seeds.
  let deltaSeeds; // the change in seeds during the convert.

  const txnActions = useFarmerFormTxnsActions();

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
  } else {
    buttonContent = 'Convert';
    if (tokenOut && amountOut?.gt(0) && amountIn?.gt(0)) {
      isReady = true;
      bdvOut = getBDV(tokenOut).times(amountOut);
      bdvIn = getBDV(tokenIn).times(amountIn);
      depositsBDV = transform(conversion.bdv.abs(), 'bnjs');
      deltaBDV = MaxBN(
        bdvOut.minus(depositsBDV),
        ZERO_BN
      );
      deltaStalk = MaxBN(
        tokenValueToBN(tokenOut.getStalk(bnToTokenValue(tokenOut, deltaBDV))),
        ZERO_BN
      );
      deltaSeedsPerBDV = tokenOut
        .getSeeds()
        .sub(tokenValueToBN(tokenIn.getSeeds()).toNumber());
      deltaSeeds = tokenValueToBN(
        tokenOut
          .getSeeds(bnToTokenValue(tokenOut, bdvOut)) // seeds for depositing this token with new BDV
          .sub(bnToTokenValue(tokenOut, conversion.seeds.abs()))
      ); // seeds lost when converting
    }
  }

  function getBDVTooltip(instantBDV: BigNumber, depositBDV: BigNumber) {
    return (
      <Stack gap={0.5}>
        <StatHorizontal label="Instantaneous BDV:">
          ~{displayFullBN(instantBDV, 2, 2)}
        </StatHorizontal>
        <StatHorizontal label="BDV of Deposits:">
          ~{displayFullBN(depositBDV, 2, 2)}
        </StatHorizontal>
      </Stack>
    )
  }

  function showOutputBDV() {
    return MaxBN(depositsBDV || ZERO_BN, bdvOut || ZERO_BN);
  }

  /// When a new output token is selected, reset maxAmountIn.
  const handleSelectTokenOut = useCallback(
    async (_tokens: Set<Token>) => {
      const arr = Array.from(_tokens);
      if (arr.length !== 1) throw new Error();
      const _tokenOut = arr[0];
      /// only reset if the user clicked a different token
      if (tokenOut !== _tokenOut) {
        setFieldValue('tokenOut', _tokenOut);
        setFieldValue('maxAmountIn', null);
      }
    },
    [setFieldValue, tokenOut]
  );

  /// When `tokenIn` or `tokenOut` changes, refresh the
  /// max amount that the user can input of `tokenIn`.
  /// FIXME: flash when clicking convert tab
  useEffect(() => {
    (async () => {
      if (tokenOut) {
        const maxAmount = await ConvertFarmStep.getMaxConvert(
          sdk,
          tokenIn,
          tokenOut
        );
        const _maxAmountIn = tokenValueToBN(maxAmount);
        setFieldValue('maxAmountIn', _maxAmountIn);

        const _maxAmountInStr = tokenIn.amount(_maxAmountIn.toString());
        console.debug('[Convert][maxAmountIn]: ', _maxAmountInStr);
      }
    })();
  }, [sdk, setFieldValue, tokenIn, tokenOut]);

  const quoteHandlerParams = useMemo(
    () => ({
      slippage: slippage,
      isConvertingPlanted: isUsingPlanted,
    }),
    [slippage, isUsingPlanted]
  );
  const maxAmountUsed =
    totalAmountIn && maxAmountIn ? totalAmountIn.div(maxAmountIn) : null;

  const disabledFormActions = useMemo(
    () => (tokenIn.isUnripe ? [FormTxn.ENROOT] : undefined),
    [tokenIn.isUnripe]
  );

  const getConvertWarning = () => {
    let pool = tokenIn.isLP ? tokenIn.symbol : tokenOut!.symbol;
    pool += ' pool';
    if (['urBEANETH', 'urBEAN'].includes(tokenIn.symbol)) pool = 'BEANETH Well';

    const lowerOrGreater =
      tokenIn.isLP || tokenIn.symbol === 'urBEANETH' ? 'lower' : 'greater';

    const message = `${tokenIn.symbol} can only be Converted to ${tokenOut?.symbol} when deltaB in the ${pool} is ${lowerOrGreater} than 0.`;

    return message;
  };

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
        {/* User Input: token amount */}
        <TokenQuoteProviderWithParams
          name="tokens.0"
          tokenOut={(tokenOut || tokenIn) as ERC20Token}
          max={MinBN(values.maxAmountIn || ZERO_BN, depositedAmount)}
          balance={depositedAmount}
          balanceLabel="Deposited Balance"
          state={values.tokens[0]}
          handleQuote={handleQuote}
          displayQuote={(_amountOut) =>
            _amountOut &&
            deltaBDV && (
            <Tooltip
              title={getBDVTooltip(bdvIn, depositsBDV)}
              placement='top'
            >
              <Box display="flex" text-align="center" gap={0.25}>
                <Typography variant="body1">
                  ~{displayFullBN(depositsBDV, 2)} BDV
                </Typography>
                <HelpOutlineIcon
                  sx={{
                    color: 'text.secondary',
                    display: 'inline-block',
                    margin: 'auto',
                    fontSize: '14px',
                  }}
                />
              </Box>
            </Tooltip>
            )
          }
          tokenSelectLabel={tokenIn.symbol}
          disabled={
            !values.maxAmountIn || // still loading `maxAmountIn`
            values.maxAmountIn.eq(0) // = 0 means we can't make this conversion
          }
          params={quoteHandlerParams}
        />
        {!canConvert && tokenOut && maxAmountIn ? null : (
          <AddPlantTxnToggle plantAndDoX={plantAndDoX.plantAction} />
        )}

        {/* User Input: destination token */}
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
        {!canConvert && tokenOut && maxAmountIn && depositedAmount.gt(0) ? (
          <Box>
            <WarningAlert iconSx={{ alignItems: 'flex-start' }}>
              {getConvertWarning()}
              <br />
            </WarningAlert>
          </Box>
        ) : null}

        {/* Outputs */}
        {totalAmountIn && tokenOut && maxAmountIn && amountOut?.gt(0) ? (
          <>
            <TxnSeparator mt={-1} />
            <TokenOutput>
              <TokenOutput.Row
                token={tokenOut}
                amount={amountOut || ZERO_BN}
                delta={showOutputBDV() ? `~${displayFullBN(showOutputBDV(), 2)} BDV` : undefined}
              />
              <TokenOutput.Row
                token={sdk.tokens.STALK}
                amount={deltaStalk || ZERO_BN}
                amountTooltip={
                  deltaBDV?.gt(0) ? (
                    <>
                      Converting will increase the BDV of your Deposit by{' '}
                      {displayFullBN(deltaBDV || ZERO_BN, 6)}
                      {deltaBDV?.gt(0) ? ', resulting in a gain of Stalk' : ''}.
                    </>
                  ) : (
                    <>
                      The BDV of your Deposit won&apos;t change with this
                      Convert.
                    </>
                  )
                }
              />
              <TokenOutput.Row
                token={sdk.tokens.SEEDS}
                amount={deltaSeeds || ZERO_BN}
                amountTooltip={
                  <>
                    Converting from {tokenIn.symbol} to {tokenOut.symbol}{' '}
                    results in{' '}
                    {!deltaSeedsPerBDV || deltaSeedsPerBDV.eq(0)
                      ? 'no change in SEEDS per BDV'
                      : `a ${
                          deltaSeedsPerBDV.gt(0) ? 'gain' : 'loss'
                        } of ${deltaSeedsPerBDV.abs().toHuman()} Seeds per BDV`}
                    .
                  </>
                }
              />
            </TokenOutput>

            {/* Warnings */}
            {maxAmountUsed && maxAmountUsed.gt(0.9) ? (
              <Box>
                <WarningAlert>
                  You are converting{' '}
                  {displayFullBN(maxAmountUsed.times(100), 4, 0)}% of the way to
                  the peg. When Converting all the way to the peg, the Convert
                  may fail due to a small amount of slippage in the direction of
                  the peg.
                </WarningAlert>
              </Box>
            ) : null}

            {/* Add-on transactions */}
            <AdditionalTxnsAccordion filter={disabledFormActions} />

            {/* Transation preview */}
            <Box>
              <TxnAccordion defaultExpanded={false}>
                <TxnPreview
                  actions={[
                    {
                      type: ActionType.BASE,
                      message: `Convert ${displayFullBN(
                        totalAmountIn,
                        tokenIn.displayDecimals
                      )} ${tokenIn.name} to ${displayFullBN(
                        amountOut,
                        tokenIn.displayDecimals
                      )} ${tokenOut.name}.`,
                    },
                    {
                      type: ActionType.UPDATE_SILO_REWARDS,
                      stalk: deltaStalk || ZERO_BN,
                      seeds: deltaSeeds || ZERO_BN,
                    },
                  ]}
                  {...txnActions}
                />
              </TxnAccordion>
            </Box>
          </>
        ) : null}

        {/* Submit */}
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

const ConvertPropProvider: FC<{
  fromToken: ERC20Token | NativeToken;
}> = ({ fromToken }) => {
  const sdk = useSdk();

  /// Token List
  const [tokenList, initialTokenOut] = useMemo(() => {
    const { path } = ConvertFarmStep.getConversionPath(sdk, fromToken);
    const _tokenList = [...path].filter((_token) => !_token.equals(fromToken));
    return [
      _tokenList, // all available tokens to convert to
      _tokenList[0], // tokenOut is the first available token that isn't the fromToken
    ];
  }, [sdk, fromToken]);

  /// Beanstalk
  const season = useSeason();
  const [refetchPools] = useFetchPools();

  /// Farmer
  const farmerSilo = useFarmerSilo();
  const farmerSiloBalances = farmerSilo.balances;
  const account = useAccount();

  /// Temporary solution. Remove this when we move the site to use the new sdk types.
  const [farmerBalances, refetchFarmerBalances] = useAsyncMemo(async () => {
    if (!account) return undefined;
    console.debug(
      `[Convert] Fetching silo balances for SILO:${fromToken.symbol}`
    );
    return sdk.silo.getBalance(fromToken, account, {
      source: DataSource.LEDGER,
    });
  }, [account, sdk]);

  /// Form
  const middleware = useFormMiddleware();
  const { txnBundler, plantAndDoX, refetch } = useFormTxnContext();
  const [conversion, setConversion] = useState<ConvertDetails>({
    actions: [],
    amount: TokenValue.ZERO,
    bdv: TokenValue.ZERO,
    crates: [],
    seeds: TokenValue.ZERO,
    stalk: TokenValue.ZERO,
  });

  const initialValues: ConvertFormValues = useMemo(
    () => ({
      // Settings
      settings: {
        slippage: 0.05,
      },
      // Token Inputs
      tokens: [
        {
          token: fromToken,
          amount: undefined,
          quoting: false,
          amountOut: undefined,
        },
      ],
      // Convert data
      maxAmountIn: undefined,
      // Token Outputs
      tokenOut: initialTokenOut,
      farmActions: {
        preset: fromToken.isLP || fromToken.isUnripe ? 'noPrimary' : 'plant',
        primary: undefined,
        secondary: undefined,
        implied: [FormTxn.MOW],
      },
    }),
    [fromToken, initialTokenOut]
  );

  /// Handlers
  // This handler does not run when _tokenIn = _tokenOut (direct deposit)
  const handleQuote = useCallback<
    QuoteHandlerWithParams<ConvertQuoteHandlerParams>
  >(
    async (tokenIn, _amountIn, tokenOut, { slippage, isConvertingPlanted }) => {
      try {
        if (!farmerBalances?.deposits) {
          throw new Error('No balances found');
        }
        const { plantAction } = plantAndDoX;

        const includePlant = !!(isConvertingPlanted && plantAction);

        const result = await ConvertFarmStep._handleConversion(
          sdk,
          farmerBalances.deposits,
          tokenIn,
          tokenOut,
          tokenIn.amount(_amountIn.toString()),
          season.toNumber(),
          slippage,
          includePlant ? plantAction : undefined
        );

        setConversion(result.conversion);

        return tokenValueToBN(result.minAmountOut);
      } catch (e) {
        console.debug('[Convert/handleQuote]: FAILED: ', e);
        return new BigNumber('0');
      }
    },
    [farmerBalances?.deposits, sdk, season, plantAndDoX]
  );

  const onSubmit = useCallback(
    async (
      values: ConvertFormValues,
      formActions: FormikHelpers<ConvertFormValues>
    ) => {
      let txToast;
      try {
        middleware.before();

        /// FormData
        const slippage = values?.settings?.slippage;
        const tokenIn = values.tokens[0].token;
        const tokenOut = values.tokenOut;
        const _amountIn = values.tokens[0].amount;

        /// Validation
        if (!account) throw new Error('Wallet connection required');
        if (!slippage) throw new Error('No slippage value set.');
        if (!_amountIn) throw new Error('No amount input');
        if (!tokenOut) throw new Error('Conversion pathway not set');
        if (!farmerBalances) throw new Error('No balances found');

        txToast = new TransactionToast({
          loading: 'Converting...',
          success: 'Convert successful.',
        });

        const { plantAction } = plantAndDoX;

        const amountIn = tokenIn.amount(_amountIn.toString()); // amount of from token
        const isPlanting =
          plantAndDoX && values.farmActions.primary?.includes(FormTxn.PLANT);

        const lpConversion =
          tokenOut.equals(sdk.tokens.BEAN_ETH_WELL_LP) ||
          tokenIn.address.toLowerCase() ===
            sdk.tokens.BEAN_ETH_WELL_LP.address.toLowerCase();

        const convertTxn = new ConvertFarmStep(
          sdk,
          tokenIn,
          tokenOut,
          season.toNumber(),
          farmerBalances.deposits
        );

        const { getEncoded, minAmountOut } = await convertTxn.handleConversion(
          amountIn,
          slippage,
          isPlanting ? plantAction : undefined
        );

        convertTxn.build(getEncoded, minAmountOut);
        const actionsPerformed = txnBundler.setFarmSteps(values.farmActions);

        const { execute } = await txnBundler.bundle(
          convertTxn,
          amountIn,
          slippage,
          1.2
        );

        const txn = await execute();
        txToast.confirming(txn);

        const receipt = await txn.wait();

        await refetch(actionsPerformed, { farmerSilo: true }, [
          refetchPools, // update prices to account for pool conversion
          refetchFarmerBalances,
        ]);

        txToast.success(receipt);

        /// Reset the max Amount In
        const _maxAmountIn = await ConvertFarmStep.getMaxConvert(
          sdk,
          tokenIn,
          tokenOut
        );

        formActions.resetForm({
          values: {
            ...initialValues,
            maxAmountIn: tokenValueToBN(_maxAmountIn),
          },
        });
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
    },
    [
      sdk,
      season,
      account,
      txnBundler,
      middleware,
      plantAndDoX,
      initialValues,
      farmerBalances,
      refetch,
      refetchPools,
      refetchFarmerBalances,
    ]
  );

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit}>
      {(formikProps) => (
        <>
          <TxnSettings placement="form-top-right">
            <SettingInput
              name="settings.slippage"
              label="Slippage Tolerance"
              endAdornment="%"
            />
          </TxnSettings>
          <ConvertForm
            handleQuote={handleQuote}
            tokenList={tokenList as (ERC20Token | NativeToken)[]}
            siloBalances={farmerSiloBalances}
            currentSeason={season}
            sdk={sdk}
            conversion={conversion}
            plantAndDoX={plantAndDoX}
            {...formikProps}
          />
        </>
      )}
    </Formik>
  );
};

const Convert: FC<{
  fromToken: ERC20Token | NativeToken;
}> = (props) => (
  <FormTxnProvider>
    <ConvertPropProvider {...props} />
  </FormTxnProvider>
);

export default Convert;
