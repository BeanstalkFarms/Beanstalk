import React, { useCallback, useEffect, useMemo } from 'react';
import { Box, Stack } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { useSelector } from 'react-redux';
import {
  ERC20Token,
  NativeToken,
  Token,
} from '@beanstalk/sdk';

import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import {
  BalanceFromFragment,
  ClaimAndPlantFormState,
  FormStateNew,
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
import { useFetchBeanstalkSilo } from '~/state/beanstalk/silo/updater';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import { BalanceFrom, balanceFromToMode } from '~/components/Common/Form/BalanceFromRow';
import useSdk from '~/hooks/sdk';
import ClaimAndPlantFarmActions from '~/components/Common/Form/ClaimAndPlantFarmOptions';
import TokenQuoteProviderWithParams from '~/components/Common/Form/TokenQuoteProviderWithParams';
import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';
import { depositSummary as getDepositSummary } from '~/lib/Beanstalk/Silo/Deposit';
import TokenSelectDialogNew from '~/components/Common/Form/TokenSelectDialogNew';
import ClaimAndPlantAdditionalOptions from '~/components/Common/Form/ClaimAndPlantAdditionalOptions';
import ClaimPlant, { ClaimPlantAction } from '~/util/ClaimPlant';
import useFarmerClaimingBalance from '~/hooks/farmer/claim-plant/useFarmerClaimingBalance';
import TokenOutput from '~/components/Common/Form/TokenOutput';
import TxnAccordion from '~/components/Common/TxnAccordion';
import useFarmerClaimAndPlant from '~/hooks/farmer/claim-plant/useFarmerClaimAndPlant';
import { tokenValueToBN } from '~/util';
import useAccount from '~/hooks/ledger/useAccount';
import useFarmerClaimAndPlantRefetch from '~/hooks/farmer/claim-plant/useFarmerClaimAndPlantRefetch';
import useFarmerClaimAndPlantTxns from '~/hooks/farmer/claim-plant/useFarmerClaimAndPlantTxns';

// -----------------------------------------------------------------------

type DepositFormValues = FormStateNew &
  ClaimAndPlantFormState &
  BalanceFromFragment & {
    settings: {
      slippage: number;
    };
  };

type DepositQuoteHandler = {
  balanceFrom: BalanceFrom;
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
  const additionalBalances = useFarmerClaimingBalance();
  const txnActions = useFarmerClaimAndPlantTxns(
    sdk.tokens.BEAN.equals(values.tokens[0].token) || false
  );

  const [isTokenSelectVisible, showTokenSelect, hideTokenSelect] = useToggle();
  const { amount, bdv, stalk, seeds, actions } = getDepositSummary(
    whitelistedToken,
    values.tokens,
    amountToBdv
  );

  /// Derived
  const isReady = bdv.gt(0);

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

  const params = useMemo(() => {
    const _params = {
      balanceFrom: values.balanceFrom,
    };
    return _params;
  }, [values.balanceFrom]);

  const disabledActions = useMemo(() => {
    if (values.tokens[0].token.symbol === 'ETH') {
      return [{
        action: ClaimPlantAction.ENROOT,
        reason: 'Depositing ETH and Enrooting is not supported',
      }];
    }
    return [];
  }, [values.tokens]);

  const tokenIn = values.tokens[0].token.symbol;

  useEffect(() => {
      setFieldValue('farmActions', {
        preset: 'rinseAndHarvest',
        selected: undefined,
        additional: undefined,
      });
  }, [setFieldValue, tokenIn]);

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
        applicableBalances={additionalBalances}
      />
      {/* Input Field */}
      <Stack gap={1}>
        {values.tokens.map((tokenState, index) => {
          const key = tokenState.token.symbol === 'ETH' ? 'eth' : tokenState.token.address;
          const balanceType = values.balanceFrom ? values.balanceFrom : BalanceFrom.TOTAL;
          const _balance = balances?.[key];
          const balance = _balance && balanceType in _balance ? _balance[balanceType] : ZERO_BN;
          const additionalBalance = additionalBalances[tokenState.token.address]?.applied;

          return (
            <TokenQuoteProviderWithParams<DepositQuoteHandler>
              key={`tokens.${index}`}
              name={`tokens.${index}`}
              tokenOut={whitelistedToken}
              balance={balance}
              state={tokenState}
              showTokenSelect={showTokenSelect}
              handleQuote={handleQuote}
              additionalBalance={additionalBalance}
              balanceFrom={values.balanceFrom}
              params={params}
              belowComponent={<ClaimAndPlantFarmActions />}
            />
          );
        })}
        {isReady ? (
          <>
            <TxnSeparator />
            <TokenOutput>
              <TokenOutput.Row
                token={whitelistedToken}
                label={whitelistedToken.symbol}
                amount={amount}
              />
              <TokenOutput.Row
                token={sdk.tokens.STALK}
                label={sdk.tokens.STALK.symbol}
                amount={stalk}
                amountTooltip={
                  <>
                    1 {whitelistedToken.symbol} = {displayFullBN(amountToBdv(new BigNumber(1)))} BDV<br />
                    1 BDV&rarr;{whitelistedToken.getStalk()?.toHuman()} STALK
                  </>
                }
              />
              <TokenOutput.Row
                token={sdk.tokens.SEEDS}
                label={sdk.tokens.SEEDS.symbol}
                amount={seeds}
                amountTooltip={
                  <>
                    1 {whitelistedToken.symbol} = {displayFullBN(amountToBdv(new BigNumber(1)))} BDV<br />
                    1 BDV&rarr;{whitelistedToken.getSeeds()?.toHuman()} SEEDS
                  </>
                }
              />
            </TokenOutput>
            <ClaimAndPlantAdditionalOptions 
              disabledActions={disabledActions} 
            />
            <Box>
              <TxnAccordion defaultExpanded={false}>
                <TxnPreview actions={actions} {...txnActions} />
              </TxnAccordion>
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

const Deposit: FC<{
  token: ERC20Token | NativeToken;
}> = ({ token: whitelistedToken }) => {
  const sdk = useSdk();
  const claimAndPlant = useFarmerClaimAndPlant();
  const account = useAccount();
  
  const [claimPlantRefetch] = useFarmerClaimAndPlantRefetch();

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

  const baseToken = usePreferredToken(preferredTokens, 'use-best') as ERC20Token | NativeToken;

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
  const [refetchPools] = useFetchPools();
  const [refetchSilo] = useFetchBeanstalkSilo();

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
        preset: 'rinseAndHarvest',
        selected: undefined,
        additional: undefined,
      },
    }),
    [baseToken]
  );

  /// Handlers
  // This handler does not run when _tokenIn = _tokenOut (direct deposit)
  const handleQuote = useCallback<QuoteHandlerWithParams<DepositQuoteHandler>>(
    async (tokenIn, _amountIn, tokenOut, { balanceFrom }) => {
      if (!account) {
        throw new Error('Wallet connection required.');
      }

      const deposit = sdk.silo.buildDeposit(tokenOut, account);
      deposit.setInputToken(tokenIn, balanceFromToMode(balanceFrom));

      const amountIn = tokenIn.amount(_amountIn.toString());
      const estimate = await deposit.estimate(amountIn);

      if (!estimate) {
        throw new Error(
          `Depositing ${tokenOut.symbol} to the Silo via ${tokenIn.symbol} is currently unsupported.`
        );
      }

      console.debug('[chain] estimate = ', estimate);
      return {
        amountOut: tokenValueToBN(estimate)
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
        const formData = values.tokens[0];
        const tokenIn = formData.token;
        const amountIn = tokenIn.fromHuman(formData?.amount?.toString() || '0');

        if (amountIn.eq(0)) {
          throw new Error('Enter an amount to deposit');
        }

        const deposit = sdk.silo.buildDeposit(whitelistedToken, account);
        deposit.setInputToken(tokenIn, balanceFromToMode(values.balanceFrom));

        const { 
          primaryActions, 
          additionalActions, 
          actionsPerformed 
        } = claimAndPlant.compile(values.farmActions);

        const { execute, estimate } = await ClaimPlant.build(
          sdk,
          primaryActions,
          additionalActions,
          deposit.workflow,
          amountIn,
          { slippage: values.settings.slippage }
        );

        const estimateBN = tokenValueToBN(
          whitelistedToken.fromBlockchain(estimate.toString())
        );

        txToast = new TransactionToast({
          loading: `Depositing ${displayFullBN(
            estimateBN,
            whitelistedToken.displayDecimals,
            whitelistedToken.displayDecimals
          )} ${whitelistedToken.name} into the Silo...`,
          success: 'Deposit successful.',
        });

        const txn = await execute();
        txToast.confirming(txn);

        const receipt = await txn.wait();
        await claimPlantRefetch(
          actionsPerformed,
          {
            farmerSilo: true,
            farmerBalances: true,
          },
          [refetchSilo, refetchPools]
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
    [middleware, account, whitelistedToken, sdk, claimAndPlant, claimPlantRefetch, refetchSilo, refetchPools]
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
