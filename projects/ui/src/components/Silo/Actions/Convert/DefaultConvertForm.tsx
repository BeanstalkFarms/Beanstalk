import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, Tooltip, TextField } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Form } from 'formik';
import BigNumber from 'bignumber.js';
import { Token, ERC20Token, ConvertDetails } from '@beanstalk/sdk';
import { useSelector } from 'react-redux';
import { SmartSubmitButton } from '~/components/Common/Form';
import TxnPreview from '~/components/Common/Form/TxnPreview';
import TxnSeparator from '~/components/Common/Form/TxnSeparator';
import PillRow from '~/components/Common/Form/PillRow';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import { displayBN, displayFullBN, MaxBN, MinBN } from '~/util/Tokens';
import { ZERO_BN } from '~/constants';
import useToggle from '~/hooks/display/useToggle';
import { tokenValueToBN, bnToTokenValue, transform } from '~/util';
import useBDV from '~/hooks/beanstalk/useBDV';
import TokenIcon from '~/components/Common/TokenIcon';
import { ActionType } from '~/util/Actions';
import { FC } from '~/types';
import TokenSelectDialogNew from '~/components/Common/Form/TokenSelectDialogNew';
import TokenQuoteProviderWithParams from '~/components/Common/Form/TokenQuoteProviderWithParams';
import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';
import WarningAlert from '~/components/Common/Alert/WarningAlert';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import TxnAccordion from '~/components/Common/TxnAccordion';
import AdditionalTxnsAccordion from '~/components/Common/Form/FormTxn/AdditionalTxnsAccordion';
import useFarmerFormTxnsActions from '~/hooks/farmer/form-txn/useFarmerFormTxnActions';
import AddPlantTxnToggle from '~/components/Common/Form/FormTxn/AddPlantTxnToggle';
import { FormTxn, ConvertFarmStep } from '~/lib/Txn';
import StatHorizontal from '~/components/Common/StatHorizontal';
import { BeanstalkPalette, FontSize } from '~/components/App/muiTheme';
import { AppState } from '~/state';
import { ConvertQuoteHandlerParams, BaseConvertFormProps } from './types';

interface Props extends BaseConvertFormProps {
  conversion: ConvertDetails;
  handleQuote: QuoteHandlerWithParams<ConvertQuoteHandlerParams>;
}

export const DefaultConvertForm: FC<Props> = ({
  tokenList,
  siloBalances,
  handleQuote,
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
  const [isChopping, setIsChopping] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [choppingConfirmed, setChoppingConfirmed] = useState(false);
  const unripeTokens = useSelector<AppState, AppState['_bean']['unripe']>(
    (_state) => _state._bean.unripe
  );

  const isChoppingLP =
    isChopping &&
    values.tokens[0].token.symbol === sdk.tokens.UNRIPE_BEAN_WSTETH.symbol;

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
  const depositedAmount = siloBalance?.deposited.convertibleAmount || ZERO_BN;

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

  const txnActions = useFarmerFormTxnsActions({ mode: 'plantToggle' });

  /// Change button state and prepare outputs
  if (depositedAmount.eq(0) && (!plantCrate || plantCrate.amount.eq(0))) {
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
    buttonContent = isChopping ? 'Chop and Convert' : 'Convert';
    if (
      tokenOut &&
      (amountOut?.gt(0) || isUsingPlanted) &&
      totalAmountIn?.gt(0)
    ) {
      isReady = true;
      bdvOut = getBDV(tokenOut).times(amountOut || ZERO_BN);
      bdvIn = getBDV(tokenIn).times(totalAmountIn || ZERO_BN);
      depositsBDV = transform(conversion.bdv.abs(), 'bnjs');
      deltaBDV = MaxBN(bdvOut.minus(depositsBDV), ZERO_BN);
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

  useEffect(() => {
    if (isChopping) {
      if (confirmText.toUpperCase() === 'CHOP MY ASSETS') {
        setChoppingConfirmed(true);
      } else {
        setChoppingConfirmed(false);
      }
    } else {
      setChoppingConfirmed(true);
    }
  }, [isChopping, confirmText, setChoppingConfirmed]);

  function getBDVTooltip(instantBDV: BigNumber, depositBDV: BigNumber) {
    return (
      <Stack gap={0.5}>
        <StatHorizontal label="Current BDV:">
          ~{displayFullBN(instantBDV, 2, 2)}
        </StatHorizontal>
        <StatHorizontal label="Recorded BDV:">
          ~{displayFullBN(depositBDV, 2, 2)}
        </StatHorizontal>
      </Stack>
    );
  }

  function showOutputBDV() {
    if (isChopping) return bdvOut || ZERO_BN;
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
        setConfirmText('');
      }
    },
    [setFieldValue, tokenOut]
  );

  useEffect(() => {
    setConfirmText('');
  }, [amountIn]);

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

        // Figure out if we're chopping
        const chopping =
          (tokenIn.address === sdk.tokens.UNRIPE_BEAN.address &&
            tokenOut?.address === sdk.tokens.BEAN.address) ||
          (tokenIn.address === sdk.tokens.UNRIPE_BEAN_WSTETH.address &&
            tokenOut?.address === sdk.tokens.BEAN_WSTETH_WELL_LP.address);

        setIsChopping(chopping);
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
    if (tokenOut && !tokenOut.equals(sdk.tokens.BEAN_CRV3_LP)) {
      pool += ' Well';
    } else {
      pool += ' pool';
    }
    if (['urBEANETH', 'urBEAN'].includes(tokenIn.symbol)) pool = 'BEANETH Well';

    const lowerOrGreater =
      tokenIn.isLP || tokenIn.symbol === 'urBEANETH' ? 'less' : 'greater';

    const message = `${tokenIn.symbol} can only be Converted to ${tokenOut?.symbol} when deltaB in the ${pool} is ${lowerOrGreater} than 0.`;

    return message;
  };

  const chopPercent = unripeTokens[tokenIn?.address || 0]?.chopPenalty || 0;

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
                placement="top"
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
          <AddPlantTxnToggle
            plantAndDoX={plantAndDoX.plantAction}
            actionText="Convert"
          />
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
        {totalAmountIn &&
        tokenOut &&
        maxAmountIn &&
        (amountOut?.gt(0) || isUsingPlanted) ? (
          <>
            <TxnSeparator mt={-1} />
            <TokenOutput danger={isChopping}>
              {isChopping && (
                <Typography
                  sx={{
                    fontSize: FontSize.sm,
                    fontWeight: 'bold',
                    color: BeanstalkPalette.trueRed,
                    px: 0.5,
                    mb: 0.25,
                    '&:after': {
                      content: "''",
                      display: 'block',
                      margin: '10px 10px',
                      borderBottom: '1px solid #e9ccce',
                    },
                  }}
                  component="span"
                  display="inline-block"
                >
                  You will forfeit {displayBN(chopPercent)}% of your claim to
                  future Ripe assets through this transaction
                  <br />
                </Typography>
              )}
              <TokenOutput.Row
                token={tokenOut}
                amount={amountOut || ZERO_BN}
                delta={
                  showOutputBDV()
                    ? `~${displayFullBN(showOutputBDV(), 2)} BDV`
                    : undefined
                }
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
            {!isUsingPlanted && (
              <AdditionalTxnsAccordion filter={disabledFormActions} />
            )}

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
                        amountOut || ZERO_BN,
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

        {isReady && isChopping && (
          <Box sx={{ m: 1 }}>
            <Typography
              sx={{
                fontSize: 'bodySmall',
                px: 0.5,
                mb: 0.25,
              }}
              component="span"
              display="inline-block"
            >
              This Convert will effectively perform a CHOP operation. Please
              confirm you understand this by typing{' '}
              <strong>&quot;CHOP MY ASSETS&quot;</strong> below.
            </Typography>
            <TextField
              fullWidth
              type="text"
              name="confirm"
              color="error"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              sx={{
                background: '#f5d1d1',
                borderRadius: '10px',
                border: '1px solid red',
                input: { color: '#880202', textTransform: 'uppercase' },
              }}
            />
          </Box>
        )}
        {isChoppingLP && (
          <WarningAlert>
            You can get more value by converting to{' '}
            {sdk.tokens.UNRIPE_BEAN.symbol} first.
          </WarningAlert>
        )}

        {/* Submit */}
        <SmartSubmitButton
          loading={buttonLoading || isQuoting}
          disabled={!isReady || isSubmitting || !choppingConfirmed}
          type="submit"
          variant="contained"
          color={isChopping ? 'error' : 'primary'}
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
