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
import { displayFullBN, getTokenIndex } from '~/util/Tokens';
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
import { STALK_PER_SEED_PER_SEASON, normaliseTV, tokenValueToBN } from '~/util';
import useAccount from '~/hooks/ledger/useAccount';
import useFarmerFormTxnActions from '~/hooks/farmer/form-txn/useFarmerFormTxnActions';
import AdditionalTxnsAccordion from '~/components/Common/Form/FormTxn/AdditionalTxnsAccordion';
import useSilo from '~/hooks/beanstalk/useSilo';

import FormWithDrawer from '~/components/Common/Form/FormWithDrawer';
import ClaimBeanDrawerToggle from '~/components/Common/Form/FormTxn/ClaimBeanDrawerToggle';
import ClaimBeanDrawerContent from '~/components/Common/Form/FormTxn/ClaimBeanDrawerContent';
import FormTxnProvider from '~/components/Common/Form/FormTxnProvider';
import useFormTxnContext from '~/hooks/sdk/useFormTxnContext';
import { ClaimAndDoX, DepositFarmStep, FormTxn } from '~/lib/Txn';

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
          const key = getTokenIndex(tokenState.token);
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
                description="Stalk Ownership"
                descriptionTooltip="Your increase in ownership of Beanstalk."
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
                description="Grown Stalk per Season"
                descriptionTooltip="Your increase in Grown Stalk per Season."
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
            <AdditionalTxnsAccordion />
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
      <FormWithDrawer.Drawer title="Use Claimable Beans">
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

const DepositPropProvider: FC<{
  token: ERC20Token | NativeToken;
}> = ({ token: whitelistedToken }) => {
  const sdk = useSdk();
  const account = useAccount();

  /// FIXME: name
  /// FIXME: finish deposit functionality for other tokens
  const middleware = useFormMiddleware();
  const { txnBundler, refetch } = useFormTxnContext();

  const initTokenList = useMemo(() => {
    const tokens = sdk.tokens;
    if (tokens.BEAN.equals(whitelistedToken)) {
      return [tokens.BEAN, tokens.ETH, tokens.WETH, tokens.CRV3, tokens.DAI, tokens.USDC, tokens.USDT];
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

      const amountOut = await DepositFarmStep.getAmountOut(
        sdk,
        account,
        tokenIn,
        tokenIn.amount(_amountIn.toString()),
        tokenOut, // whitelisted silo token
        fromMode
      );

      return tokenValueToBN(amountOut);
    },
    [account, sdk]
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

        const tokenIn = formData.token;
        const _amountIn = formData.amount || '0';
        const amountIn = tokenIn.fromHuman(_amountIn.toString());

        const target = whitelistedToken as ERC20Token;

        const areSameTokens = target.equals(tokenIn);
        const depositingBean = target.equals(BEAN);

        const amountOut =
          (areSameTokens ? formData.amount : formData.amountOut) || ZERO_BN;
        const amountOutFromClaimed =
          (depositingBean ? claimData.amount : claimData.amountOut) || ZERO_BN;

        const claimedUsed = normaliseTV(BEAN, claimData.amount);

        if (amountIn.eq(0) && claimedUsed.eq(0)) {
          throw new Error('Enter an amount to deposit');
        }

        txToast = new TransactionToast({
          loading: `Depositing ${displayFullBN(
            amountOut.plus(amountOutFromClaimed),
            whitelistedToken.displayDecimals,
            whitelistedToken.displayDecimals
          )} ${whitelistedToken.name} into the Silo...`,
          success: 'Deposit successful.',
        });

        const claimAndDoX = new ClaimAndDoX(
          sdk,
          normaliseTV(BEAN, claimData.maxAmountIn),
          claimedUsed,
          values.farmActions.transferToMode || FarmToMode.INTERNAL
        );

        const depositTxn = new DepositFarmStep(sdk, target);
        depositTxn.build(
          tokenIn,
          amountIn,
          balanceFromToMode(values.balanceFrom),
          account,
          claimAndDoX
        );

        const actionsPerformed = txnBundler.setFarmSteps(values.farmActions);
        const { execute } = await txnBundler.bundle(
          depositTxn,
          amountIn,
          values.settings.slippage
        );

        const txn = await execute();
        txToast.confirming(txn);

        const receipt = await txn.wait();
        await refetch(
          actionsPerformed,
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
    [
      middleware,
      account,
      sdk,
      whitelistedToken,
      txnBundler,
      refetch,
      refetchPools,
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

const Deposit: FC<{
  token: ERC20Token | NativeToken;
}> = (props) => (
  <FormTxnProvider>
    <DepositPropProvider {...props} />
  </FormTxnProvider>
);

export default Deposit;
