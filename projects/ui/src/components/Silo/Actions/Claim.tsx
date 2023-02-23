import React, { useCallback, useMemo } from 'react';
import { Accordion, AccordionDetails, Box, Stack, Typography } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import BigNumber from 'bignumber.js';
import toast from 'react-hot-toast';
import { ERC20Token, Token } from '@beanstalk/sdk';
import StyledAccordionSummary from '~/components/Common/Accordion/AccordionSummary';
import { FarmerSiloBalance } from '~/state/farmer/silo';
import { ActionType } from '~/util/Actions';
import {
  TxnPreview,
  TxnSeparator,
  TxnSettings,
  SettingInput,
  SmartSubmitButton,
  FormTokenStateNew,
  ClaimAndPlantFormState
} from '~/components/Common/Form';
import { FarmFromMode, FarmToMode } from '~/lib/Beanstalk/Farm';
import { ZERO_BN } from '~/constants';
import { displayTokenAmount, parseError, tokenValueToBN } from '~/util';
import FarmModeField from '~/components/Common/Form/FarmModeField';
import TokenIcon from '~/components/Common/TokenIcon';
import useToggle from '~/hooks/display/useToggle';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import PillRow from '~/components/Common/Form/PillRow';
import TransactionToast from '~/components/Common/TxnToast';
import copy from '~/constants/copy';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import useClaimAndPlantActions from '~/hooks/farmer/claim-plant/useFarmerClaimPlantActions';
import TokenQuoteProviderWithParams from '~/components/Common/Form/TokenQuoteProviderWithParams';
import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';
import TokenSelectDialogNew from '~/components/Common/Form/TokenSelectDialogNew';
import useSdk, { getNewToOldToken } from '~/hooks/sdk';
import TxnOutputField from '~/components/Common/Form/TxnOutputField';
import ClaimAndPlantFarmActions from '~/components/Common/Form/ClaimAndPlantFarmOptions';
import ClaimAndPlantAdditionalOptions from '~/components/Common/Form/ClaimAndPlantAdditionalOptions';
import ClaimPlant, { ClaimPlantAction } from '~/util/ClaimPlant';

// -----------------------------------------------------------------------

type ClaimFormValues = {
  /**
   * When claiming, there is only one input token
   * (the claimable LP token). the amount of this
   * token is always the full claimable balance.
   * 
   * In this case, token.amountOut is the amount received
   * for converting LP into `tokenOut`.
   */
  token: FormTokenStateNew;
  destination: FarmToMode | undefined;
  tokenOut: ERC20Token | undefined;
} & {
  settings: {
    slippage: number;
  } 
} & ClaimAndPlantFormState;

const ClaimForm : FC<
  FormikProps<ClaimFormValues> & {
    token: ERC20Token;
    claimableBalance: BigNumber;
  }
> = ({
  // Custom
  token,
  claimableBalance,
  // Formik
  values,
  isSubmitting,
  setFieldValue,
}) => {
  const sdk = useSdk();

  //
  const pool = useMemo(() => sdk.pools.getPoolByLPToken(token), [sdk.pools, token]);
  const claimableTokens = useMemo(() => ([
    token,
    ...(token.isLP && pool?.tokens || []),
  ]), [pool, token]);

  //
  const amount = claimableBalance;
  const isSubmittable = (
    amount
    && amount.gt(0)
    && values.destination !== undefined
    && (token.isLP ? values.tokenOut !== undefined : true)
  );
  const tokenOut = values.tokenOut || (token as ERC20Token);

  //
  const handleQuote = useCallback<QuoteHandlerWithParams<{ toMode?: FarmToMode }>>(
    async (_tokenIn, _amountIn, _tokenOut, { toMode }) => {
      if (_tokenIn === _tokenOut) return { amountOut: _amountIn };
      const amountIn = _tokenIn.amount(_amountIn.toString());

      // Require pooldata to be loaded first. 
      if (!pool || !_tokenIn.isLP) return null;

      const work = sdk.farm.create().add(
        new sdk.farm.actions.RemoveLiquidityOneToken(
          pool.address,
          sdk.contracts.curve.registries.metaFactory.address,
          _tokenOut.address,
          FarmFromMode.INTERNAL,
          toMode
        )
      );
      const estimate = await work.estimate(amountIn);
      return {
        amountOut: tokenValueToBN(_tokenOut.fromBlockchain(estimate)),
        workflow: work,
      };
    },
    [pool, sdk.farm, sdk.contracts.curve.registries.metaFactory.address]
  );

  //
  const [isTokenSelectVisible, showTokenSelect, hideTokenSelect] = useToggle();

  //
  const handleSelectTokens = useCallback((_tokens: Set<Token>) => {
    const _token = Array.from(_tokens)[0];
    setFieldValue('tokenOut', _token);
  }, [setFieldValue]);

  // This should be memoized to prevent an infinite reset loop
  const quoteHandlerParams = useMemo(() => ({
    params: { 
      toMode: values.destination || FarmToMode.INTERNAL,
    },
    quoteSettings: {
      ignoreSameToken: false,
      onReset: () => ({ amountOut: claimableBalance }),
    }
  }), [claimableBalance, values.destination]);

  return (
    <Form autoComplete="off" noValidate>
      <Stack gap={1}>
        <TokenQuoteProviderWithParams<{ toMode?: FarmToMode }>
          name="token"
          tokenOut={tokenOut}
          state={values.token}
          // This input is always disabled but we use
          // the underlying handleQuote functionality
          // for consistency with other forms.
          disabled 
          // 
          balance={amount || ZERO_BN}
          balanceLabel="Claimable Balance"
          // -----
          // FIXME:
          // "disableTokenSelect" applies the disabled prop to
          // the TokenSelect button. However if we don't pass
          // a handler to the button then it's effectively disabled
          // but shows with stronger-colored text. param names are
          // a bit confusing.
          // disableTokenSelect={true}
          handleQuote={handleQuote}
          displayQuote={false}
          {...quoteHandlerParams}
          belowComponent={
            <ClaimAndPlantFarmActions preset="plant" />
          }
        />
        <Stack gap={0}>
          {/* Setting: Destination */}
          <FarmModeField
            name="destination"
          />
          {/* Setting: Claim LP */}
          <>
            {token.isLP ? (
              <PillRow
                isOpen={isTokenSelectVisible}
                label="Claim LP as"
                onClick={showTokenSelect}> 
                {values.tokenOut && <TokenIcon token={values.tokenOut} />}
                <Typography variant="body1">
                  {values.tokenOut ? values.tokenOut.symbol : (<>Select Output</>)}
                </Typography>
              </PillRow>
            ) : null}
            <TokenSelectDialogNew
              open={isTokenSelectVisible}
              handleClose={hideTokenSelect}
              handleSubmit={handleSelectTokens}
              selected={values.tokenOut ? [values.tokenOut] : []}
              balances={undefined} // hide balances from right side of selector
              tokenList={claimableTokens as Token[]}
              mode={TokenSelectMode.SINGLE}
            />
          </>
        </Stack>
        {/* Transaction Details */}
        {isSubmittable ? (
          <>
            <TxnSeparator />
            <TxnOutputField 
              items={[
                {
                  primary: {
                    title: token.symbol,
                    amount: values.token.amountOut || ZERO_BN,
                    token: token,
                  }
                }
              ]}
            />
            <ClaimAndPlantAdditionalOptions />
            {/* <TokenOutputField
              token={tokenOut}
              amount={values.token.amountOut || ZERO_BN}
              isLoading={values.token.quoting}
            /> */}
            <Box>
              <Accordion variant="outlined">
                <StyledAccordionSummary title="Transaction Details" />
                <AccordionDetails>
                  <TxnPreview
                    actions={[
                      {
                        type: ActionType.CLAIM_WITHDRAWAL,
                        amount: amount,
                        token: getNewToOldToken(token),
                        // message: `Claim ${displayTokenAmount(amount, token)}.`
                      },
                      token.equals(sdk.tokens.BEAN_CRV3_LP) && values.tokenOut !== token ? {
                        type: ActionType.BASE,
                        message: `Unpack ${displayTokenAmount(amount, token)} into ${displayTokenAmount(values.token.amountOut || ZERO_BN, tokenOut)}.`
                      } : undefined,
                      {
                        type: ActionType.RECEIVE_TOKEN,
                        token: getNewToOldToken(tokenOut),
                        amount: values.token.amountOut || ZERO_BN,
                        destination: values.destination,
                      }
                    ]}
                  />
                </AccordionDetails>
              </Accordion>
            </Box>
          </>
        ) : null}
        <SmartSubmitButton
          loading={isSubmitting}
          disabled={!isSubmittable || isSubmitting}
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          tokens={[]}
          mode="auto"
        >
          Claim
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

// -----------------------------------------------------------------------

const Claim : FC<{
  token: ERC20Token;
  siloBalance: FarmerSiloBalance;
}> = ({
  token,
  siloBalance,
}) => {
  const sdk = useSdk();
  const claimPlant = useClaimAndPlantActions();

  ///
  const middleware = useFormMiddleware();

  /// Data
  const claimableBalance = siloBalance?.claimable.amount;

  // Form
  const initialValues : ClaimFormValues = useMemo(() => ({
    // Input token values
    token: {
      token: token,
      amount: claimableBalance,
      amountOut: claimableBalance
    },
    destination: undefined,
    tokenOut: undefined,
    settings: {
      slippage: 0.1,
    },
    farmActions: {
      options: [
        ClaimPlantAction.PLANT,
      ],
      selected: [],
      additional: {
        selected: [],
        required: [ClaimPlantAction.MOW],
        exclude: [ClaimPlantAction.CLAIM]
      }
    },
  }), [token, claimableBalance]);

  const onSubmit = useCallback(async (values: ClaimFormValues, formActions: FormikHelpers<ClaimFormValues>) => {
    let txToast;
    try {
      middleware.before();
      const crates = siloBalance?.claimable?.crates;
      const amountIn = values.token.token.fromHuman(values.token.amount?.toString() || '0');

      if (!crates || crates.length === 0 || amountIn.lte(0)) throw new Error('Nothing to claim');
      if (!values.destination) throw new Error('Select a balance to claim to');

      const tokenIn = values.token.token as ERC20Token;
      const tokenOut = (values.tokenOut || tokenIn) as ERC20Token; // FIXME: `token` will always be set

      if (!tokenOut) throw new Error('Select an output token'); 

      // If the user wants to swap their LP token for something else,
      // we send their Claimable `token` to their internal balance for
      // ease of interaction and gas efficiency.
      const removeLiquidity  = token.isLP && !tokenIn.equals(tokenOut);
      const claimDestination = removeLiquidity ? FarmToMode.INTERNAL : values.destination;

      console.debug(`[Claim] claimDestination = ${claimDestination}, crates = `, crates);

      txToast = new TransactionToast({
        loading: `Claiming ${displayTokenAmount(claimableBalance, token)} from the Silo...`,
        success: `Claim successful. Added ${displayTokenAmount(values.token.amountOut || ZERO_BN, tokenOut)} to your ${copy.MODES[values.destination]}.`,
      });

      const claim = sdk.farm.create();
      
      // Claim multiple withdrawals of `token` in one call
      if (crates.length > 1) {
        console.debug(`[Claim] claiming ${crates.length} withdrawals`);
        claim.add(new sdk.farm.actions.ClaimWithdrawals(
          token.address,
          crates.map((crate) => crate.season.toString()),
          claimDestination,
        ));
      } 
      
      // Claim a single withdrawal of `token` in one call. Gas efficient.
      else {
        console.debug('[Claim] claiming a single withdrawal');
        claim.add(new sdk.farm.actions.ClaimWithdrawal(
          token.address,
          crates[0].season.toString(),
          claimDestination,
        ));
      }

      if (removeLiquidity) {
        if (!values.token.workflow) throw new Error('No quote found.');
        claim.add([...values.token.workflow.generators]);
      }

      const { execute, actionsPerformed } = await ClaimPlant.build(
        sdk,
        claimPlant.buildActions(values.farmActions.selected),
        claimPlant.buildActions(values.farmActions.additional.selected),
        claim,
        amountIn, 
        { slippage: values.settings.slippage }
      );

      const txn = await execute();
      txToast.confirming(txn);
      const receipt = await txn.wait();

      await claimPlant.refetch(actionsPerformed, { 
        farmerSilo: true, 
        farmerBalances: true
      });

      txToast.success(receipt);
      formActions.resetForm();
    } catch (err) {
      txToast ? txToast.error(err) : toast.error(parseError(err));
      formActions.setSubmitting(false);
    }
  }, [middleware, siloBalance?.claimable?.crates, token, claimableBalance, sdk, claimPlant]);

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit} enableReinitialize>
      {(formikProps) => (
        <>
          <TxnSettings placement="form-top-right">
            <SettingInput name="settings.slippage" label="Slippage Tolerance" endAdornment="%" />
          </TxnSettings>
          <Stack spacing={1}>
            <ClaimForm
              token={token}
              claimableBalance={claimableBalance}
              {...formikProps}
            />
          </Stack>
        </>
      )}
    </Formik>
  );
};

export default Claim;
