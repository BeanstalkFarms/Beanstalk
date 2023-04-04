import React, { useCallback, useMemo, useRef } from 'react';
import { Box, Stack } from '@mui/material';
import { Formik, FormikHelpers, FormikProps } from 'formik';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { useSelector } from 'react-redux';
import {
  ERC20Token,
  FarmFromMode,
  FarmToMode,
  NativeToken,
  Token,
} from '@beanstalk/sdk';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import {
  BalanceFromFragment,
  ClaimBeansFormState,
  FormStateNew,
  FormTxnsFormState,
  SettingInput,
  TxnSettings,
} from '~/components/Common/Form';
import TxnPreview from '~/components/Common/Form/TxnPreview';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import { FarmerBalances } from '~/state/farmer/balances';
import { displayFullBN } from '~/util/Tokens';
import TransactionToast from '~/components/Common/TxnToast';
import { ZERO_BN } from '~/constants';
import SmartSubmitButton from '~/components/Common/Form/SmartSubmitButton';
import TxnSeparator from '~/components/Common/Form/TxnSeparator';
import useToggle from '~/hooks/display/useToggle';
import usePreferredToken from '~/hooks/farmer/usePreferredToken';
import useTokenMap from '~/hooks/chain/useTokenMap';
import { AppState } from '~/state';
import { useFetchPools } from '~/state/bean/pools/updater';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import {
  BalanceFrom,
  balanceFromToMode,
} from '~/components/Common/Form/BalanceFromRow';
import useSdk from '~/hooks/sdk';
import TokenQuoteProviderWithParams from '~/components/Common/Form/TokenQuoteProviderWithParams';
import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';
import { depositSummary as getDepositSummary } from '~/lib/Beanstalk/Silo/Deposit';
import TokenSelectDialogNew from '~/components/Common/Form/TokenSelectDialogNew';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import TxnAccordion from '~/components/Common/TxnAccordion';
import { STALK_PER_SEED_PER_SEASON, tokenValueToBN } from '~/util';
import useAccount from '~/hooks/ledger/useAccount';
import { FormTxn, FormTxnBuilder } from '~/util/FormTxns';
import useFarmerFormTxns from '~/hooks/farmer/form-txn/useFarmerFormTxns';
import useFarmerFormTxnActions from '~/hooks/farmer/form-txn/useFarmerFormTxnActions';
import AdditionalTxnsAccordion from '~/components/Common/Form/FormTxn/AdditionalTxnsAccordion';
import useSilo from '~/hooks/beanstalk/useSilo';

import FormWithDrawer from '~/components/Common/Form/FormWithDrawer';
import ClaimBeanDrawerToggle from '~/components/Common/Form/FormTxn/ClaimBeanDrawerToggle';
import ClaimBeanDrawerContent from '~/components/Common/Form/FormTxn/ClaimBeanDrawerContent';

// -----------------------------------------------------------------------

type DepositFormValues = FormStateNew &
  FormTxnsFormState &
  BalanceFromFragment & {
    settings: {
      slippage: number;
    };
  } & ClaimBeansFormState;

type DepositQuoteHandler = {
  fromMode: FarmFromMode;
};

const defaultFarmActionsFormState = {
  preset: 'claim',
  primary: undefined,
  secondary: undefined,
  implied: [FormTxn.MOW],
};

// -----------------------------------------------------------------------

const DepositForm: FC<
  FormikProps<DepositFormValues> & {
    tokenList: (ERC20Token | NativeToken)[];
    whitelistedToken: ERC20Token | NativeToken;
    amountToBdv: (amount: BigNumber) => BigNumber;
    balances: FarmerBalances;
    contract: ethers.Contract;
    handleQuote: QuoteHandlerWithParams<DepositQuoteHandler>;
  }
> = ({
  // Custom
  tokenList,
  whitelistedToken,
  amountToBdv,
  balances,
  contract,
  handleQuote,
  // Formik
  values,
  isSubmitting,
  setFieldValue,
}) => {
  const sdk = useSdk();
  const beanstalkSilo = useSilo();
  const siblingRef = useRef<HTMLDivElement | null>(null);

  const txnActions = useFarmerFormTxnActions({
    showGraphicOnClaim: sdk.tokens.BEAN.equals(values.tokens[0].token) || false,
    claimBeansState: values.claimableBeans,
  });

  const formData = values.tokens[0];
  const tokenIn = formData.token;

  const combinedTokenState = [...values.tokens, values.claimableBeans];

  const [isTokenSelectVisible, showTokenSelect, hideTokenSelect] = useToggle();
  const { amount, bdv, stalk, seeds, actions } = getDepositSummary(
    whitelistedToken,
    combinedTokenState,
    amountToBdv
  );

  // Memoized params to prevent infinite loop
  const quoteProviderParams = useMemo(
    () => ({
      fromMode: balanceFromToMode(values.balanceFrom),
    }),
    [values.balanceFrom]
  );

  /// Handlers
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
      setFieldValue('farmActions', defaultFarmActionsFormState);
      setFieldValue('claimableBeans', {
        token: sdk.tokens.BEAN,
        amount: undefined,
      });
    },
    [values.tokens, sdk.tokens.BEAN, setFieldValue]
  );

  const handleSetBalanceFrom = useCallback(
    (_balanceFrom: BalanceFrom) => {
      setFieldValue('balanceFrom', _balanceFrom);
    },
    [setFieldValue]
  );

  const filteredFormTxns = useMemo(
    () => (tokenIn.equals(sdk.tokens.ETH) ? [FormTxn.ENROOT] : undefined),
    [sdk.tokens.ETH, tokenIn]
  );

  const increasedStalkPct = stalk.div(beanstalkSilo.stalk.total).times(100);
  const increasedStalkPctStr = increasedStalkPct.lt(0.01)
    ? '<0.01%'
    : `+${increasedStalkPct.toFixed(2)}%`;

  /// Derived
  const isReady = bdv.gt(0);

  const noAmount =
    values.tokens[0].amount === undefined &&
    values.claimableBeans.amount?.eq(0);

  return (
    <FormWithDrawer noValidate autoComplete="off" siblingRef={siblingRef}>
      <TokenSelectDialogNew
        open={isTokenSelectVisible}
        handleClose={hideTokenSelect}
        handleSubmit={handleSelectTokens}
        selected={values.tokens}
        balances={balances}
        tokenList={tokenList}
        mode={TokenSelectMode.SINGLE}
        title="Assets"
        balanceFrom={values.balanceFrom}
        setBalanceFrom={handleSetBalanceFrom}
      />
      {/* Input Field */}
      <Stack gap={1} ref={siblingRef}>
        {values.tokens.map((tokenState, index) => {
          const key = tokenState.token.equals(sdk.tokens.ETH)
            ? 'eth'
            : tokenState.token.address;
          const balanceType = values.balanceFrom
            ? values.balanceFrom
            : BalanceFrom.TOTAL;
          const _balance = balances?.[key];
          const balance =
            _balance && balanceType in _balance
              ? _balance[balanceType]
              : ZERO_BN;

          return (
            <TokenQuoteProviderWithParams<DepositQuoteHandler>
              key={`tokens.${index}`}
              name={`tokens.${index}`}
              tokenOut={whitelistedToken}
              balance={balance}
              state={tokenState}
              showTokenSelect={showTokenSelect}
              handleQuote={handleQuote}
              balanceFrom={values.balanceFrom}
              params={quoteProviderParams}
            />
          );
        })}

        <ClaimBeanDrawerToggle />
        {isReady ? (
          <>
            <TxnSeparator />
            <TokenOutput>
              <TokenOutput.Row
                token={whitelistedToken}
                label={`Deposited ${whitelistedToken.symbol}`}
                amount={amount}
              />
              <TokenOutput.Row
                token={sdk.tokens.STALK}
                label={sdk.tokens.STALK.symbol}
                amount={stalk}
                description="Ownership percentage"
                descriptionTooltip="Your ownership percentage of Beanstalk denominated by STALK"
                delta={increasedStalkPctStr}
                amountTooltip={
                  <>
                    1 {whitelistedToken.symbol} ={' '}
                    {displayFullBN(amountToBdv(new BigNumber(1)))} BDV
                    <br />1 BDV&rarr;
                    {whitelistedToken.getStalk()?.toHuman()} STALK
                  </>
                }
              />
              <TokenOutput.Row
                token={sdk.tokens.SEEDS}
                label={sdk.tokens.SEEDS.symbol}
                amount={seeds}
                description="Stalk Growth per Season"
                descriptionTooltip="The amount of STALK you will receive per season"
                delta={seeds.times(STALK_PER_SEED_PER_SEASON)}
                amountTooltip={
                  <>
                    1 {whitelistedToken.symbol} ={' '}
                    {displayFullBN(amountToBdv(new BigNumber(1)))} BDV
                    <br />1 BDV&rarr;
                    {whitelistedToken.getSeeds()?.toHuman()} SEEDS
                  </>
                }
              />
            </TokenOutput>
            <AdditionalTxnsAccordion filter={filteredFormTxns} />
            <Box>
              <TxnAccordion defaultExpanded={false}>
                <TxnPreview actions={actions} {...txnActions} />
              </TxnAccordion>
            </Box>
          </>
        ) : null}
        <SmartSubmitButton
          loading={isSubmitting}
          disabled={isSubmitting || noAmount}
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          contract={contract}
          tokens={values.tokens}
          mode="auto"
        >
          Deposit
        </SmartSubmitButton>
      </Stack>
      <FormWithDrawer.Drawer title="Use Claimable Assets">
        <ClaimBeanDrawerContent
          quoteProviderProps={{
            name: 'claimableBeans',
            handleQuote: handleQuote,
            params: {
              fromMode: FarmFromMode.INTERNAL_TOLERANT,
            },
            tokenOut: whitelistedToken,
            state: values.claimableBeans,
          }}
        />
      </FormWithDrawer.Drawer>
    </FormWithDrawer>
  );
};

// -----------------------------------------------------------------------

const Deposit: FC<{
  token: ERC20Token | NativeToken;
}> = ({ token: whitelistedToken }) => {
  const sdk = useSdk();
  const account = useAccount();

  ///
  const formTxns = useFarmerFormTxns();

  /// FIXME: name
  /// FIXME: finish deposit functionality for other tokens
  const middleware = useFormMiddleware();
  const initTokenList = useMemo(() => {
    const tokens = sdk.tokens;
    if (tokens.BEAN.equals(whitelistedToken)) {
      return [tokens.ETH, tokens.BEAN];
    }
    return [
      tokens.BEAN,
      tokens.ETH,
      whitelistedToken,
      tokens.CRV3,
      tokens.DAI,
      tokens.USDC,
      tokens.USDT,
    ];
  }, [sdk.tokens, whitelistedToken]);
  const allAvailableTokens = useTokenMap(initTokenList);

  /// Token List
  const [tokenList, preferredTokens] = useMemo(() => {
    // Exception: if page is Depositing Unripe assets
    // then constrain the token list to only unripe.
    if (whitelistedToken.isUnripe) {
      return [[whitelistedToken], [{ token: whitelistedToken }]];
    }

    const _tokenList = Object.values(allAvailableTokens);
    return [_tokenList, _tokenList.map((t) => ({ token: t }))];
  }, [whitelistedToken, allAvailableTokens]);

  const baseToken = usePreferredToken(preferredTokens, 'use-best') as
    | ERC20Token
    | NativeToken;

  /// Beanstalk
  const bdvPerToken = useSelector<
    AppState,
    | AppState['_beanstalk']['silo']['balances'][string]['bdvPerToken']
    | BigNumber
  >(
    (state) =>
      state._beanstalk.silo.balances[whitelistedToken.address]?.bdvPerToken ||
      ZERO_BN
  );

  const amountToBdv = useCallback(
    (amount: BigNumber) => bdvPerToken.times(amount),
    [bdvPerToken]
  );

  /// Farmer
  const balances = useFarmerBalances();
  const [refetchPools] = useFetchPools();

  /// Form setup
  const initialValues: DepositFormValues = useMemo(
    () => ({
      settings: {
        slippage: 0.1,
      },
      tokens: [
        {
          token: baseToken,
          amount: undefined,
          quoting: false,
          amountOut: undefined,
        },
      ],
      balanceFrom: BalanceFrom.TOTAL,
      farmActions: {
        preset: whitelistedToken.isUnripe ? 'noPrimary' : 'claim',
        primary: undefined,
        secondary: undefined,
        implied: [FormTxn.MOW],
        additionalAmount: undefined,
      },
      /// claimable beans
      claimableBeans: {
        token: sdk.tokens.BEAN,
        amount: undefined,
      },
    }),
    [baseToken, sdk.tokens.BEAN, whitelistedToken]
  );

  /// Handlers
  // This handler does not run when _tokenIn = _tokenOut (direct deposit)
  const handleQuote = useCallback<QuoteHandlerWithParams<DepositQuoteHandler>>(
    async (tokenIn, _amountIn, tokenOut, { fromMode }) => {
      if (!account) {
        throw new Error('Wallet connection required.');
      }

      const deposit = sdk.silo.buildDeposit(tokenOut, account);
      deposit.setInputToken(tokenIn, fromMode);

      const amountIn = tokenIn.amount(_amountIn.toString());
      const estimate = await deposit.estimate(amountIn);

      if (!estimate) {
        throw new Error(
          `Depositing ${tokenOut.symbol} to the Silo via ${tokenIn.symbol} is currently unsupported.`
        );
      }

      console.debug('[chain] estimate = ', estimate);
      return {
        amountOut: tokenValueToBN(estimate),
        // steps: deposit.workflow.generators as StepGenerator[],
      };
    },
    [account, sdk.silo]
  );

  const onSubmit = useCallback(
    async (
      values: DepositFormValues,
      formActions: FormikHelpers<DepositFormValues>
    ) => {
      let txToast;
      try {
        middleware.before();
        if (!account) {
          throw new Error('Wallet connection required');
        }
        if (!values.settings.slippage) {
          throw new Error('No slippage value set');
        }
        if (values.tokens.length > 1) {
          throw new Error('Only one token supported at this time');
        }

        const { BEAN } = sdk.tokens;

        const formData = values.tokens[0];
        const claimData = values.claimableBeans;
        const farmActions = values.farmActions;

        const tokenIn = formData.token;
        const _amountIn = formData.amount || '0';
        const amountIn = tokenIn.fromHuman(_amountIn.toString());

        const target = whitelistedToken as ERC20Token;
        const isDepositingSameToken = target.equals(tokenIn);

        const amountOut =
          (isDepositingSameToken ? formData.amount : formData.amountOut) ||
          ZERO_BN;

        const amountOutFromClaimed =
          (target.equals(sdk.tokens.BEAN)
            ? claimData.amount
            : claimData.amountOut) || ZERO_BN;

        const totalAmountOut = amountOut.plus(amountOutFromClaimed);

        const claimedBeansUsed = BEAN.amount(
          claimData.amount?.toString() || '0'
        );
        const totalClaimAmount = BEAN.amount(
          claimData.maxAmountIn?.toString() || '0'
        );
        const transferDestination =
          farmActions.transferToMode || FarmToMode.INTERNAL;

        if (amountIn.eq(0) && claimedBeansUsed.eq(0)) {
          throw new Error('Enter an amount to deposit');
        }

        if (
          (claimedBeansUsed && !totalClaimAmount) ||
          claimedBeansUsed.gt(totalClaimAmount)
        ) {
          throw new Error('Insufficient claimable Beans');
        }

        txToast = new TransactionToast({
          loading: `Depositing ${displayFullBN(
            totalAmountOut,
            whitelistedToken.displayDecimals,
            whitelistedToken.displayDecimals
          )} ${whitelistedToken.name} into the Silo...`,
          success: 'Deposit successful.',
        });

        // initialize workflow
        const work = sdk.farm.create();

        /**
         * In the case where the 'tokenIn' is BEAN we can combine the amounts
         * & create only 1 deposit workflow.
         * In the case where 'tokenIn' != BEAN, we need to create 2 deposit workflows.
         */

        const canCombine =
          BEAN.equals(tokenIn) && amountIn.gt(0) && claimedBeansUsed.gt(0);

        /// primary input deposit
        if (canCombine || amountIn.gt(0)) {
          const deposit = sdk.silo.buildDeposit(whitelistedToken, account);
          deposit.setInputToken(
            tokenIn,
            canCombine
              ? FarmFromMode.INTERNAL_EXTERNAL
              : balanceFromToMode(values.balanceFrom)
          );
          work.add([...deposit.workflow.generators]);
          console.debug(
            `[Deposit]: deposited added ${tokenIn.symbol} => ${target.symbol}`,
            work
          );
        }

        /// Claim beans input deposit
        /// FIXME: currently if the user is depositing claimed BEANs, we add another deposit operation.
        // Is there a more efficient way to do this?
        if (!canCombine && claimedBeansUsed.gt(0)) {
          const depositClaimed = sdk.silo.buildDeposit(
            whitelistedToken,
            account
          );
          depositClaimed.setInputToken(
            sdk.tokens.BEAN,
            FarmFromMode.INTERNAL_TOLERANT
          );

          work.add(
            FormTxnBuilder.getLocalOnlyStep('deposit-claimed-beans', {
              overrideAmount: claimedBeansUsed,
            }),
            { onlyLocal: true }
          );
          work.add([...depositClaimed.workflow.generators]);
          console.debug(
            `[Deposit]: deposit added claimed BEANs => ${target.symbol}`,
            work
          );
        }

        /// If the user is claiming beans and isn't using the full amount,
        /// transfer the remaining amount to their external wallet if requested.
        const finalSteps = (() => {
          const transferAmount = totalClaimAmount.sub(claimedBeansUsed);
          const isToExternal = transferDestination === FarmToMode.EXTERNAL;
          const shouldTransfer = isToExternal && transferAmount.gt(0);

          if (!shouldTransfer) return undefined;

          const transferStep = new sdk.farm.actions.TransferToken(
            BEAN.address,
            account,
            FarmFromMode.INTERNAL_TOLERANT,
            FarmToMode.EXTERNAL
          );

          const finalStep = {
            steps: [transferStep],
            overrideAmount: transferAmount,
          };
          console.debug(`[Deposit]: Transfer amount ${transferAmount}`);
          return [finalStep];
        })();

        const finalAmountIn = canCombine
          ? amountIn.add(claimedBeansUsed)
          : amountIn?.gt(0)
          ? amountIn
          : undefined;

        const { execute, performed, workflow } = await FormTxnBuilder.compile(
          sdk,
          values.farmActions,
          formTxns.getGenerators,
          work,
          finalAmountIn,
          values.settings.slippage,
          finalSteps
        );

        console.debug(`[Deposit]: final workflow`, workflow);

        const txn = await execute();
        txToast.confirming(txn);

        const receipt = await txn.wait();
        await formTxns.refetch(
          performed,
          {
            beanstalkSilo: true,
            farmerSilo: true,
            farmerBalances: true,
          },
          [refetchPools]
        );

        txToast.success(receipt);
        formActions.resetForm();
      } catch (err) {
        if (txToast) {
          txToast.error(err);
        } else {
          const errorToast = new TransactionToast({});
          errorToast.error(err);
        }
        formActions.setSubmitting(false);
      }
    },
    [middleware, account, sdk, whitelistedToken, formTxns, refetchPools]
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
          <DepositForm
            handleQuote={handleQuote}
            amountToBdv={amountToBdv}
            tokenList={tokenList as (ERC20Token | NativeToken)[]}
            whitelistedToken={whitelistedToken}
            balances={balances}
            contract={sdk.contracts.beanstalk}
            {...formikProps}
          />
        </>
      )}
    </Formik>
  );
};

export default Deposit;
