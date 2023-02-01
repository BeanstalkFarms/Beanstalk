import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Accordion, AccordionDetails, Box, Stack } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { useSelector } from 'react-redux';
import {
  Token,
  ERC20Token,
  NativeToken,
  TokenValue,
  FarmWorkflow,
  FarmFromMode,
  FarmToMode,
  BeanstalkSDK,
} from '@beanstalk/sdk';
import toast from 'react-hot-toast';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import {
  FarmWithClaimFormState,
  FormStateNew,
  SettingInput,
  SmartSubmitButton,
  TxnPreview,
  TxnSeparator,
  TxnSettings,
} from '~/components/Common/Form';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import { ApplicableBalance, FarmerBalances } from '~/state/farmer/balances';
import { ZERO_BN } from '~/constants';
import useToggle from '~/hooks/display/useToggle';
import { useFetchFarmerSilo } from '~/state/farmer/silo/updater';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import { AppState } from '~/state';
import { useFetchPools } from '~/state/bean/pools/updater';
import { useFetchBeanstalkSilo } from '~/state/beanstalk/silo/updater';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';
import useFarmerClaimableBeanAssets, {
  balanceFromToMode, ClaimableBeanToken,
} from '~/hooks/farmer/useFarmerClaimableBeanAssets';
import ClaimableAssets from '../ClaimableAssets';
import TokenSelectDialogNew from '~/components/Common/Form/TokenSelectDialogNew';
import useSdk, { getNewToOldToken, useToTokenMap } from '~/hooks/sdk';
import TokenQuoteProviderWithParams from '~/components/Common/Form/TokenQuoteProviderWithParams';
import { useGetPreferredToken } from '~/hooks/farmer/usePreferredToken';
import TransactionToast from '~/components/Common/TxnToast';
import { displayFullBN, parseError } from '~/util';
import useClaimAndDoX from '~/hooks/sdk/useClaimAndDoX';
import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';
import StyledAccordionSummary from '~/components/Common/Accordion/AccordionSummary';
import TokenOutputsField from '~/components/Common/Form/TokenOutputsField';
import { DepositTxnSummary, getDepositTxnSummary } from '~/lib/Beanstalk/Silo/Deposit';

// -----------------------------------------------------------------------

type DepositFormValuesNew = FormStateNew &
  FarmWithClaimFormState & {
    settings: {
      slippage: number;
    };
  };

const defaultDepositTxnSummary: DepositTxnSummary = {
  amount: ZERO_BN,
  bdv: ZERO_BN,
  stalk: ZERO_BN,
  seeds: ZERO_BN,
  actions: [],
};

// -----------------------------------------------------------------------

const DepositForm: FC<
  FormikProps<DepositFormValuesNew> & {
    tokenList: (ERC20Token | NativeToken)[];
    whitelistedToken: ERC20Token | NativeToken;
    amountToBdv: (amount: BigNumber) => BigNumber;
    balances: FarmerBalances;
    contract: ethers.Contract;
    handleQuote: QuoteHandlerWithParams;
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
  const claimable = useFarmerClaimableBeanAssets();
  const [isTokenSelectVisible, showTokenSelect, hideTokenSelect] = useToggle();
  const [summaryValues, setSummaryValues] = useState<DepositTxnSummary>(defaultDepositTxnSummary);
  const { amount, bdv, stalk, seeds, actions } = summaryValues;

  /// Derived
  // const isReady = bdv.gt(0);
  const isReady = bdv.gt(0);

  // memoize this so it doesn't cause an infinite render cycle for the QuoteProvider component
  const quoteParams = useMemo(() => {
    const fromMode = balanceFromToMode(values.balanceFrom);
    return { fromMode };
  }, [values.balanceFrom]);

  const applicableBalances: Record<string, ApplicableBalance> = useMemo(() => {
    const beanClaimAmount = Object.values(values.beansClaiming).reduce((prev, curr) => {
      prev = curr.amount?.gt(0) ? prev.plus(curr.amount) : prev;
      return prev;
    }, ZERO_BN);

    return {
      [sdk.tokens.BEAN.address]: {
        total: values.maxBeansClaimable,
        applied: beanClaimAmount,
        remaining: values.maxBeansClaimable.minus(beanClaimAmount),
      },
    };
  }, [sdk.tokens.BEAN.address, values.beansClaiming, values.maxBeansClaimable]);

  ///
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
    },
    [values.tokens, setFieldValue]
  );

  const handleSetBalanceFrom = useCallback((_balanceFrom: BalanceFrom) => {
    setFieldValue('balanceFrom', _balanceFrom);
  }, [setFieldValue]);

  /// Effects
  useEffect(() => {
    // update max claimable if it changes
    // do this here instead of in its parent to avoid it not being set in initial values
    if (!values.maxBeansClaimable.eq(claimable.total)) {
      setFieldValue('maxBeansClaimable', claimable.total);
    }
  }, [claimable.total, setFieldValue, values.destination, values.maxBeansClaimable]);

  /// update the depositTxnSummary data when the form values change
  /// FIX ME: debounce this. Is it better to store state locally or in formik?
  useEffect(() => {
    getDepositTxnSummary(sdk, whitelistedToken, values.tokens, getNewToOldToken)
      .then(setSummaryValues);
  }, [sdk, values.tokens, whitelistedToken]);

  return (
    <Form noValidate autoComplete="off">
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
        applicableBalances={applicableBalances}
      />
      <Stack gap={1}>
        {values.tokens.map((tokenState, index) => {
          // sdk ETH token address is not usable as a key
          const tokenKey = tokenState.token.symbol === 'ETH' ? 'eth' : tokenState.token.address;
          // if the user has selected a balance type, use that, otherwise use the total balance
          const balanceType = values.balanceFrom ? values.balanceFrom : BalanceFrom.TOTAL;
          const _balance = balances?.[tokenKey];
          const balance = _balance && balanceType in _balance ? _balance[balanceType] : ZERO_BN;
          const additionalBalance = applicableBalances[tokenState.token.address]?.applied;

          return (
            <TokenQuoteProviderWithParams
              slippage={values.settings.slippage}
              key={`tokens.${index}`}
              name={`tokens.${index}`}
              tokenOut={whitelistedToken}
              balance={balance}
              state={tokenState}
              showTokenSelect={showTokenSelect}
              handleQuote={handleQuote}
              additionalBalance={additionalBalance}
              params={quoteParams}
            />
          );
        })}
        <ClaimableAssets 
          balances={claimable.assets} 
        />
        {isReady ? (
          <>
            <TxnSeparator />
            <TokenOutputsField
              groups={[
                {
                  data: [
                    {
                      token: whitelistedToken,
                      amount: amount,
                      disablePrefix: true,
                    },
                    {
                      token: sdk.tokens.STALK,
                      amount: stalk,
                      amountTooltip: (
                        <>
                          1 {whitelistedToken.symbol} = {displayFullBN(amountToBdv(new BigNumber(1)))} BDV<br />
                          1 BDV &rarr; {whitelistedToken.getStalk().toHuman()} STALK
                        </>
                      ),
                    },
                    {
                      token: sdk.tokens.SEEDS,
                      amount: seeds,
                      amountTooltip: (
                        <>
                          1 {whitelistedToken.symbol} = {displayFullBN(amountToBdv(new BigNumber(1)))} BDV<br />
                          1 BDV &rarr; {whitelistedToken.getSeeds().toHuman()} SEEDS
                        </>
                      ),
                    },
                  ],
                },
              ]}
            />
            <Box>
              <Accordion variant="outlined">
                <StyledAccordionSummary title="Transaction Details" />
                <AccordionDetails>
                  <TxnPreview actions={actions} />
                </AccordionDetails>
              </Accordion>
            </Box>
          </>
        ) : null}
        <SmartSubmitButton
          loading={isSubmitting}
          disabled={isSubmitting}
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
    </Form>
  );
};

// -----------------------------------------------------------------------

const Deposit: FC<{ token: ERC20Token | NativeToken }> = ({
  token: whitelistedToken,
}) => {
  /// Helpers
  const sdk = useSdk();
  const claimAndDoX = useClaimAndDoX();
  const middleware = useFormMiddleware();

  /// Initialize Token List
  const allAvailableTokens = useToTokenMap(
    useMemo(() => (sdk.tokens.BEAN.equals(whitelistedToken) 
      ? [sdk.tokens.BEAN, sdk.tokens.ETH]
      : [
          sdk.tokens.BEAN,
          sdk.tokens.ETH,
          whitelistedToken,
          sdk.tokens.CRV3,
          sdk.tokens.DAI,
          sdk.tokens.USDC,
          sdk.tokens.USDT,
        ]
    ), [sdk, whitelistedToken]));

  /// Token List
  const [tokenList, preferredTokens] = useMemo(() => {
    // Exception: if page is Depositing Unripe assets
    // then constrain the token list to only unripe.
    if (whitelistedToken.isUnripe) {
      return [
        [whitelistedToken], 
        [{ token: whitelistedToken }]
      ];
    }

    const _tokenList = Object.values(allAvailableTokens);
    return [
      _tokenList, 
      _tokenList.map((t) => ({ token: t }))
    ];
  }, [whitelistedToken, allAvailableTokens]);

  const baseToken = useGetPreferredToken(preferredTokens, 'use-best') as (ERC20Token | NativeToken);

  /// Beanstalk
  const bdvPerToken = useSelector<AppState, AppState['_beanstalk']['silo']['balances'][string]['bdvPerToken'] | BigNumber>(
    (state) => state._beanstalk.silo.balances[whitelistedToken.address]?.bdvPerToken || ZERO_BN
  );

  const amountToBdv = useCallback(
    (amount: BigNumber) => bdvPerToken.times(amount),
    [bdvPerToken]
  );

  /// Farmer
  const balances = useFarmerBalances();
  const [refetchFarmerSilo] = useFetchFarmerSilo();
  const [refetchFarmerBalances] = useFetchFarmerBalances();
  const [refetchPools] = useFetchPools();
  const [refetchSilo] = useFetchBeanstalkSilo();

  const beanstalk = sdk.contracts.beanstalk;

  /// Form setup
  const initialValues: DepositFormValuesNew = useMemo(
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
      maxBeansClaimable: ZERO_BN,
      beansClaiming: {},
      balanceFrom: BalanceFrom.TOTAL,
      destination: FarmToMode.INTERNAL,
    }),
    [baseToken]
  );

  /// Build deposit workflow fragment
  const getWorkflow = useCallback(
    async (
      tokenIn: Token,
      _amountIn: BigNumber,
      tokenOut: Token,
      fromMode: FarmFromMode
    ): Promise<{
      handleEstimate: (amt: TokenValue) => Promise<TokenValue>;
      workflow: FarmWorkflow<{ slippage: number } & Record<string, any>>;
      deposit: ReturnType<BeanstalkSDK['silo']['buildDeposit']>
    }> => {
      const account = await sdk.getAccount();
      const deposit = sdk.silo.buildDeposit(tokenOut, account);
      deposit.setInputToken(tokenIn);

      // set the specified token balance source
      deposit.fromMode = fromMode; 

      return {
        handleEstimate: async (amt) => deposit.estimate(amt),
        workflow: deposit.workflow,
        deposit,
      };
    },
    [sdk]
  );

  /// Handlers
  // This handler does not run when _tokenIn = _tokenOut (direct deposit)
  const handleQuote = useCallback<QuoteHandlerWithParams>(
    async (_tokenIn, _amountIn, _tokenOut, params) => {
      // ensure token balance source is selected
      if (!params?.fromMode) {
        throw new Error('Selecting a (Farm / Circulating / Combined) balance is required');
      }

      const { handleEstimate } = await getWorkflow(_tokenIn,_amountIn,_tokenOut,params.fromMode);
      const amountIn = _tokenIn.fromHuman(_amountIn.toString());
      const estimate = await handleEstimate(amountIn);
      console.debug(`[deposit][quote]: ${_amountIn.toFixed(2)} ${_tokenIn.symbol} => ${estimate.toHuman()} ${_tokenOut.symbol}`);
      if (!estimate) {
        throw new Error(`Depositing ${_tokenOut.symbol} to the Silo via ${_tokenIn.symbol} is currently unsupported.`);
      }

      return { 
        amountOut: new BigNumber(estimate.toHuman()) 
      };
    },
    [getWorkflow]
  );

  const onSubmit = useCallback(
    async (
      values: DepositFormValuesNew,
      formActions: FormikHelpers<DepositFormValuesNew>
    ) => {
      let txToast;
      try {
        middleware.before();
        const formData = values.tokens[0];
        const tokenIn = formData.token;

        if (!values.settings.slippage) throw new Error('No slippage value set');
        if (values.tokens.length > 1) throw new Error('Only one token supported at this time');
        if (!formData?.amount || formData.amount.eq(0)) throw new Error('Enter an amount to deposit');

        const assetsClaimed = Object.keys(values.beansClaiming) as ClaimableBeanToken[];

        const { workflow: work, error } = await claimAndDoX.getOrBuildWorkflow({
          ...values,
          tokenIn,
          amountIn: formData.amount,
        });

        if (error) throw error;

        const amountIn = tokenIn.fromHuman(formData.amount.toString());

        // get deposit workflow and add to the existing workflow
        await getWorkflow(
          tokenIn,
          formData.amount,
          whitelistedToken,
          balanceFromToMode(values.balanceFrom)
        ).then((result) => {
          work.add([...result.workflow.generators]);
        });

        const estimate = whitelistedToken.fromBlockchain(await work.estimate(amountIn));
        const summary = await work.summarizeSteps();
        console.debug('[deposit][estimate]', estimate.toHuman());
        console.debug('[deposit][workflow-summary]: ', summary);

        txToast = new TransactionToast({
          loading: `Depositing ${estimate.toHuman()} ${whitelistedToken.name} into the Silo...`,
          success: 'Deposit successful.',
        });

        const txn = await work.execute(amountIn, { slippage: values.settings.slippage });
        txToast.confirming(txn);
        const reciept = await txn.wait();

        await Promise.all([
          claimAndDoX.refetch(assetsClaimed),
          refetchFarmerSilo(),
          refetchFarmerBalances(),
          refetchPools(),
          refetchSilo(),
        ]);
        txToast.success(reciept);
        formActions.resetForm();
      } catch (err) {
        txToast ? txToast.error(err) : toast.error(parseError(err));
        formActions.setSubmitting(false);
      }
    },
    [
      claimAndDoX, 
      middleware, 
      whitelistedToken, 
      refetchFarmerBalances, 
      getWorkflow, 
      refetchFarmerSilo, 
      refetchPools, 
      refetchSilo
    ]
  );

  return (
    <Formik<DepositFormValuesNew>
      initialValues={initialValues}
      onSubmit={onSubmit}
    >
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
            tokenList={tokenList}
            whitelistedToken={whitelistedToken}
            balances={balances}
            contract={beanstalk}
            {...formikProps}
          />
        </>
      )}
    </Formik>
  );
};

export default Deposit;
