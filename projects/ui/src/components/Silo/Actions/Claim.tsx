import React, { useCallback, useMemo } from 'react';
import { Accordion, AccordionDetails, Box, Stack, Typography } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import BigNumber from 'bignumber.js';
import { useProvider } from 'wagmi';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { useSigner } from '~/hooks/ledger/useSigner';
import { Token } from '~/classes';
import StyledAccordionSummary from '~/components/Common/Accordion/AccordionSummary';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import { FarmerSiloBalance } from '~/state/farmer/silo';
import { ActionType } from '~/util/Actions';
import usePools from '~/hooks/beanstalk/usePools';
import { ERC20Token } from '~/classes/Token';
import {
  FormTokenState,
  TxnPreview,
  TokenOutputField,
  TokenSelectDialog,
  TxnSeparator,
  TokenQuoteProvider,
  TxnSettings,
  SettingInput,
  SmartSubmitButton
} from '~/components/Common/Form';
import Farm, { FarmFromMode, FarmToMode } from '~/lib/Beanstalk/Farm';
import { ZERO_BN } from '~/constants';
import { displayTokenAmount, toStringBaseUnitBN, toTokenUnitsBN, parseError } from '~/util';
import FarmModeField from '~/components/Common/Form/FarmModeField';
import TokenIcon from '~/components/Common/TokenIcon';
import useToggle from '~/hooks/display/useToggle';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import PillRow from '~/components/Common/Form/PillRow';
import { QuoteHandler } from '~/hooks/ledger/useQuote';
import TransactionToast from '~/components/Common/TxnToast';
import { useFetchFarmerSilo } from '~/state/farmer/silo/updater';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import useChainConstant from '~/hooks/chain/useChainConstant';
import { BEAN_CRV3_LP } from '~/constants/tokens';
import copy from '~/constants/copy';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';

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
  token: FormTokenState;
  destination: FarmToMode | undefined;
  tokenOut: ERC20Token | undefined;
} & {
  settings: {
    slippage: number;
  }
};

const ClaimForm : FC<
  FormikProps<ClaimFormValues> & {
    token: Token;
    claimableBalance: BigNumber;
    farm: Farm;
  }
> = ({
  // Custom
  token,
  claimableBalance,
  farm,
  // Formik
  values,
  isSubmitting,
  setFieldValue,
}) => {
  const pools = usePools();
  const BeanCrv3 = useChainConstant(BEAN_CRV3_LP);
  
  // ASSUMPTION: Pool address === LP Token address
  // Lazy way to do this. Should key pools by lpToken.address.
  const pool = pools[token.address];
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
  const handleQuote = useCallback<QuoteHandler>(
    async (_tokenIn, _amountIn, _tokenOut) => {
      if (_tokenIn === _tokenOut) return { amountOut: _amountIn };
      const amountIn = ethers.BigNumber.from(toStringBaseUnitBN(_amountIn, _tokenIn.decimals));
      
      // Require pooldata to be loaded first
      if (token.isLP && !pool) return null; 

      // const tokenIndex = pool.tokens.findIndex((tok) => tok === _tokenOut);
      // if (tokenIndex === -1) throw new Error('No token found');
      // const indices = [0, 0];
      // indices[tokenIndex] = 1; // becomes [0, 1] or [1, 0]

      const estimate = await Farm.estimate([
        farm.removeLiquidityOneToken(
          pool.address,
          farm.contracts.curve.registries.metaFactory.address,
          _tokenOut.address,
          // Always comes from internal balance
          FarmFromMode.INTERNAL,
          values.destination,
        ),
      ], [amountIn]);
      return {
        amountOut: toTokenUnitsBN(estimate.amountOut.toString(), _tokenOut.decimals),
        steps: estimate.steps,
      };
    },
    [
      farm,
      token.isLP,
      pool,
      values.destination
    ]
  );

  //
  const [isTokenSelectVisible, showTokenSelect, hideTokenSelect] = useToggle();

  //
  const handleSelectTokens = useCallback((_tokens: Set<Token>) => {
    const _token = Array.from(_tokens)[0];
    setFieldValue('tokenOut', _token);
  }, [setFieldValue]);

  // This should be memoized to prevent an infinite reset loop
  const quoteSettings = useMemo(() => ({
    ignoreSameToken: false,
    onReset: () => ({ amountOut: claimableBalance }),
  }), [claimableBalance]);

  return (
    <Form autoComplete="off" noValidate>
      <Stack gap={1}>
        <TokenQuoteProvider
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
          quoteSettings={quoteSettings}
          handleQuote={handleQuote}
          displayQuote={false}
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
                  {values.tokenOut ? values.tokenOut.symbol : (
                    <>Select Output</>
                  )}
                </Typography>
              </PillRow>
            ) : null}
            <TokenSelectDialog
              open={isTokenSelectVisible}
              handleClose={hideTokenSelect}
              handleSubmit={handleSelectTokens}
              selected={values.tokenOut ? [values.tokenOut] : []}
              balances={undefined} // hide balances from right side of selector
              tokenList={claimableTokens}
              mode={TokenSelectMode.SINGLE}
            />
          </>
        </Stack>
        {/* Transaction Details */}
        {isSubmittable ? (
          <>
            <TxnSeparator />
            <TokenOutputField
              token={tokenOut}
              amount={values.token.amountOut || ZERO_BN}
              isLoading={values.token.quoting}
            />
            <Box>
              <Accordion variant="outlined">
                <StyledAccordionSummary title="Transaction Details" />
                <AccordionDetails>
                  <TxnPreview
                    actions={[
                      {
                        type: ActionType.CLAIM_WITHDRAWAL,
                        amount: amount,
                        token: token,
                        // message: `Claim ${displayTokenAmount(amount, token)}.`
                      },
                      token === BeanCrv3 && values.tokenOut !== token ? {
                        type: ActionType.BASE,
                        message: `Unpack ${displayTokenAmount(amount, token)} into ${displayTokenAmount(values.token.amountOut || ZERO_BN, tokenOut)}.`
                      } : undefined,
                      {
                        type: ActionType.RECEIVE_TOKEN,
                        token: tokenOut,
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
  siloBalance
}) => {
  /// 
  const { data: signer } = useSigner();
  const provider = useProvider();
  const farm = useMemo(() => new Farm(provider), [provider]);
  const middleware = useFormMiddleware();

  /// Contracts
  const beanstalk = useBeanstalkContract(signer);

  /// Data
  const [refetchFarmerSilo]     = useFetchFarmerSilo();
  const [refetchFarmerBalances] = useFetchFarmerBalances();
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
  }), [token, claimableBalance]);

  const onSubmit = useCallback(async (values: ClaimFormValues, formActions: FormikHelpers<ClaimFormValues>) => {
    let txToast;
    try {
      middleware.before();
      const crates = siloBalance?.claimable?.crates;
      if (!crates || crates.length === 0) throw new Error('Nothing to claim');
      if (!values.destination) throw new Error('Select a balance to claim to');
      const tokenOut = (values.tokenOut || token); // FIXME: `token` will always be set
      if (!tokenOut) throw new Error('Select an output token');

      txToast = new TransactionToast({
        loading: `Claiming ${displayTokenAmount(claimableBalance, token)} from the Silo...`,
        success: `Claim successful. Added ${displayTokenAmount(values.token.amountOut || ZERO_BN, tokenOut)} to your ${copy.MODES[values.destination]}.`,
      });
      
      // If the user wants to swap their LP token for something else,
      // we send their Claimable `token` to their internal balance for
      // ease of interaction and gas efficiency.
      const removeLiquidity  = (tokenOut !== token);
      const claimDestination = token.isLP && removeLiquidity
        ? FarmToMode.INTERNAL
        : values.destination;

      console.debug(`[Claim] claimDestination = ${claimDestination}, crates = `, crates);

      const data : string[] = [];
      
      // Claim multiple withdrawals of `token` in one call
      if (crates.length > 1) {
        console.debug(`[Claim] claiming ${crates.length} withdrawals`);
        data.push(
          beanstalk.interface.encodeFunctionData('claimWithdrawals', [
            token.address,
            crates.map((crate) => crate.season.toString()),
            claimDestination,
          ])
        );
      } 
      
      // Claim a single withdrawal of `token` in one call. Gas efficient.
      else {
        console.debug('[Claim] claiming a single withdrawal');
        data.push(
          beanstalk.interface.encodeFunctionData('claimWithdrawal', [
            token.address,
            crates[0].season.toString(),
            claimDestination,
          ])
        );
      }

      if (token.isLP && removeLiquidity) {
        if (!values.token.steps) throw new Error('No quote found.');
        const encoded = Farm.encodeStepsWithSlippage(
          values.token.steps,
          values.settings.slippage / 100,
        );
        values?.token?.steps.forEach((step, i) => console.debug(`step ${i}:`, step.decode(encoded[i])));
        data.push(...encoded);
      }

      const txn = await beanstalk.farm(data, {});
      txToast.confirming(txn);

      const receipt = await txn.wait();
      await Promise.all([refetchFarmerSilo(), refetchFarmerBalances()]);
      txToast.success(receipt);
      formActions.resetForm();
    } catch (err) {
      txToast ? txToast.error(err) : toast.error(parseError(err));
      formActions.setSubmitting(false);
    }
  }, [
    beanstalk,
    siloBalance?.claimable,
    claimableBalance,
    token,
    refetchFarmerSilo,
    refetchFarmerBalances,
    middleware
  ]);

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
              farm={farm}
              {...formikProps}
            />
          </Stack>
        </>
      )}
    </Formik>
  );
};

export default Claim;
