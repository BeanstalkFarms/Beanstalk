import React, { useCallback, useMemo } from 'react';
import { Accordion, AccordionDetails, Box, Stack } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { ERC20Token, NativeToken, Token, FarmFromMode, TokenValue } from '@beanstalk/sdk';
import {
  SEEDS,
  STALK,
} from '~/constants/tokens';
import {
  TokenSelectMode,
} from '~/components/Common/Form/TokenSelectDialog';
import StyledAccordionSummary from '~/components/Common/Accordion/AccordionSummary';
import {
  ClaimAndPlantFormState,
  FormStateNew,
  SettingInput,
  TxnSettings,
} from '~/components/Common/Form';
import TxnPreview from '~/components/Common/Form/TxnPreview';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import { FarmerBalances } from '~/state/farmer/balances';
import {
  displayFullBN,
  toStringBaseUnitBN,
} from '~/util/Tokens';
import TransactionToast from '~/components/Common/TxnToast';
import { Beanstalk } from '~/generated/index';
import { ZERO_BN } from '~/constants';
import Pool from '~/classes/Pool';
import SmartSubmitButton from '~/components/Common/Form/SmartSubmitButton';
import Farm from '~/lib/Beanstalk/Farm';
import TxnSeparator from '~/components/Common/Form/TxnSeparator';
import useToggle from '~/hooks/display/useToggle';
import usePreferredToken from '~/hooks/farmer/usePreferredToken';
import useTokenMap from '~/hooks/chain/useTokenMap';
import { useSigner } from '~/hooks/ledger/useSigner';
import { useFetchFarmerSilo } from '~/state/farmer/silo/updater';
import { parseError } from '~/util';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import { AppState } from '~/state';
import { useFetchPools } from '~/state/bean/pools/updater';
import { useFetchBeanstalkSilo } from '~/state/beanstalk/silo/updater';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';
// import ClaimableAssets from '../ClaimableAssets';
import TokenOutputsField from '~/components/Common/Form/TokenOutputsField';
import useSdk from '~/hooks/sdk';
import useFarmerClaimAndPlantActions, { ClaimPlantAction } from '~/hooks/beanstalk/useClaimAndPlantActions';
import useGetClaimAppliedBalances from '~/hooks/farmer/useGetClaimAppliedBalances';
import ClaimAndPlantFarmActions from '~/components/Common/Form/ClaimAndPlantFarmOptions';
import ClaimAndPlantAdditionalOptions from '~/components/Common/Form/ClaimAndPlantAdditionalOptions';
import TokenQuoteProviderWithParams from '~/components/Common/Form/TokenQuoteProviderWithParams';
import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';
import { depositSummary } from '~/lib/Beanstalk/Silo/Deposit';
import TokenSelectDialogNew from '~/components/Common/Form/TokenSelectDialogNew';
import useFarmerClaimAndPlantOptions from '~/hooks/farmer/useFarmerClaimAndPlantOptions';

// -----------------------------------------------------------------------

type DepositFormValues = FormStateNew &
 ClaimAndPlantFormState & {
    settings: {
      slippage: number;
    };
  };

type DepositQuoteHandlerParams = {
  claimedBeans: BigNumber,
  balanceFrom: BalanceFrom, 
}

// -----------------------------------------------------------------------

const DepositForm: FC<
  FormikProps<DepositFormValues> & {
    tokenList: (ERC20Token | NativeToken)[];
    whitelistedToken: ERC20Token | NativeToken;
    amountToBdv: (amount: BigNumber) => BigNumber;
    balances: FarmerBalances;
    contract: ethers.Contract;
    handleQuote: QuoteHandlerWithParams<DepositQuoteHandlerParams>;
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
  const [isTokenSelectVisible, showTokenSelect, hideTokenSelect] = useToggle();
  const { amount, bdv, stalk, seeds, actions } = depositSummary(
      whitelistedToken,
      values.tokens,
      amountToBdv,
    );

  /// Derived
  const isReady = bdv.gt(0);

  // console.log(values);

  const applicableBalances = useGetClaimAppliedBalances(
    values.farmActions.options,
    values.farmActions.selected,
    values.balanceFrom
  );

  const { options } = useFarmerClaimAndPlantOptions();

  const quoteProviderParams: DepositQuoteHandlerParams = useMemo(() => {
    const claimedBeans = values.farmActions.selected.reduce((prev, curr) => {
      const option = options[curr];
      if (option.claimable && option.claimable.amount) {
        prev = prev.plus(option.claimable.amount);
      }
      return prev;
    }, ZERO_BN);
    return {
      claimedBeans: claimedBeans || ZERO_BN,
      balanceFrom: values.balanceFrom,
    };
  }, [options, values.balanceFrom, values.farmActions.selected]);

  ///
  const handleSelectTokens = useCallback((_tokens: Set<Token>) => {
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
          amount: undefined
        })),
      ]);
    }, [values.tokens, setFieldValue]);

  const handleSetBalanceFrom = useCallback((_balanceFrom: BalanceFrom) => {
    setFieldValue('balanceFrom', _balanceFrom);
  },[setFieldValue]);

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
          const key = tokenState.token.symbol === 'ETH' ? 'eth' : tokenState.token.address;
          const balanceType = values.balanceFrom ? values.balanceFrom : BalanceFrom.TOTAL;
          const _balance = balances?.[key];
          const balance = _balance && balanceType in _balance ? _balance[balanceType] : ZERO_BN;
          const additionalBalance = applicableBalances[tokenState.token.address]?.applied;
          return (
            <TokenQuoteProviderWithParams<DepositQuoteHandlerParams>
              key={`tokens.${index}`}
              name={`tokens.${index}`}
              tokenOut={whitelistedToken}
              balance={balance}
              state={tokenState}
              showTokenSelect={showTokenSelect}
              handleQuote={handleQuote}
              additionalBalance={additionalBalance}
              balanceFrom={values.balanceFrom}
              params={quoteProviderParams}
              belowComponent={
                <ClaimAndPlantFarmActions preset="claim" />
              }
            />
          );
        })}
        {isReady ? (
          <>
            <TxnSeparator />
            <TokenOutputsField
              groups={[
                {
                  data: [{
                    token: whitelistedToken,
                    amount: amount,
                    disablePrefix: true,
                  },
                  {
                    token: STALK,
                    amount: stalk,
                    amountTooltip: (
                      <>
                        1 {whitelistedToken.symbol} = {displayFullBN(amountToBdv(new BigNumber(1)))} BDV<br />
                        1 BDV &rarr; {whitelistedToken.getStalk().toString()} STALK
                      </>
                    ),
                  },
                  {
                    token: SEEDS,
                    amount: seeds,
                    amountTooltip: (
                      <>
                        1 {whitelistedToken.symbol} = {displayFullBN(amountToBdv(new BigNumber(1)))} BDV<br />
                        1 BDV &rarr; {whitelistedToken.getSeeds().toString()} SEEDS
                      </>
                    )
                  }]
                }
              ]}
            />
            <ClaimAndPlantAdditionalOptions />
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

const Deposit: FC<{
  pool: Pool;
  token: ERC20Token | NativeToken;
}> = ({ 
  pool, 
  token: whitelistedToken 
}) => {
  const sdk = useSdk();
  const actions = useFarmerClaimAndPlantActions();

  /// FIXME: name
  /// FIXME: finish deposit functionality for other tokens
  const middleware = useFormMiddleware();
  const initTokenList = useMemo(() => {
    const tokens = sdk.tokens;
    if (tokens.BEAN.equals(whitelistedToken)) {
      return [
        tokens.ETH,
        tokens.BEAN, 
      ];
    }
    return [
      tokens.BEAN,
      tokens.ETH,
      whitelistedToken,
      tokens.CRV3,
      tokens.DAI,
      tokens.USDC,
      tokens.USDT
    ];
  }, [sdk.tokens, whitelistedToken]);
  const allAvailableTokens = useTokenMap(initTokenList);

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
      _tokenList.map((t) => ({ token: t })),
    ];
  }, [whitelistedToken, allAvailableTokens]);
  const baseToken = usePreferredToken(preferredTokens, 'use-best') as (ERC20Token | NativeToken);

  /// Beanstalk
  const bdvPerToken = useSelector<AppState, AppState['_beanstalk']['silo']['balances'][string]['bdvPerToken'] | BigNumber>(
    (state) => state._beanstalk.silo.balances[whitelistedToken.address]?.bdvPerToken || ZERO_BN
  );
  const amountToBdv = useCallback((amount: BigNumber) => bdvPerToken.times(amount), [bdvPerToken]);

  /// Farmer
  const balances                = useFarmerBalances();
  const [refetchFarmerSilo]     = useFetchFarmerSilo();
  const [refetchFarmerBalances] = useFetchFarmerBalances();
  const [refetchPools]          = useFetchPools();
  const [refetchSilo]           = useFetchBeanstalkSilo();

  /// Network
  const { data: signer } = useSigner();
  const beanstalk = useBeanstalkContract(signer);

  /// Form setup
  const initialValues: DepositFormValues = useMemo(() => ({
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
      options: [
        ClaimPlantAction.RINSE,
        ClaimPlantAction.HARVEST,
        ClaimPlantAction.CLAIM,
      ],
      selected: [],
      additional: {
        selected: [],
        required: [ClaimPlantAction.MOW],
      }
    },
  }), [baseToken]);

  const getWorkflow = useCallback(async (
    _tokenIn: ERC20Token | NativeToken, _tokenOut: ERC20Token | NativeToken, balanceFrom: BalanceFrom,
  ) => {
    let fromMode: FarmFromMode;

    if (balanceFrom === BalanceFrom.TOTAL) {
      fromMode = FarmFromMode.INTERNAL_EXTERNAL;
    } else if (balanceFrom === BalanceFrom.INTERNAL) {
      fromMode = FarmFromMode.INTERNAL;
    } else {
      fromMode = FarmFromMode.EXTERNAL;
    }

      const account = await sdk.getAccount();
      const op = sdk.silo.buildDeposit(_tokenOut, account);
      op.setInputToken(_tokenIn, fromMode);

      const estimate = async (amount: TokenValue) => op.estimate(amount);

      return {
        estimate,
        op,
      };
  }, [sdk]);

  /// Handlers
  // This handler does not run when _tokenIn = _tokenOut (direct deposit)
  const handleQuote = useCallback<QuoteHandlerWithParams<DepositQuoteHandlerParams>>(
    async (tokenIn, amountIn, tokenOut, { claimedBeans, balanceFrom }
  ) => {
    let totalAmountIn: TokenValue;

    if (sdk.tokens.BEAN.equals(tokenIn)) {    
      totalAmountIn = tokenIn.amount(amountIn.plus(claimedBeans).toString());
    } else {
      totalAmountIn = tokenIn.amount(amountIn.toString());
    }

    const work = await getWorkflow(tokenIn, tokenOut, balanceFrom);

    const estimate = await work.estimate(totalAmountIn);
    
      if (!estimate) {
        throw new Error(
          `Depositing ${tokenOut.symbol} to the Silo via ${tokenIn.symbol} is currently unsupported.`
        );
      }

      console.debug('[chain] estimate = ', estimate);

      return {
        amountOut: new BigNumber(estimate.toHuman()),
      };
    },
    [sdk.tokens.BEAN, getWorkflow]
  );

  const onSubmit = useCallback(
    async (
      values: DepositFormValues,
      formActions: FormikHelpers<DepositFormValues>
    ) => {
      let txToast;
      try {
        middleware.before();
        if (!values.settings.slippage) throw new Error('No slippage value set');
        const formData = values.tokens[0];
        if (values.tokens.length > 1) {
          throw new Error('Only one token supported at this time');
        }
        if (!formData?.amount || formData.amount.eq(0)) {
          throw new Error('Enter an amount to deposit');
        }

        // FIXME: getting BDV per amount here
        const { amount } = depositSummary(
          whitelistedToken,
          values.tokens,
          amountToBdv
        );

        txToast = new TransactionToast({
          loading: `Depositing ${displayFullBN(
            amount.abs(),
            whitelistedToken.displayDecimals,
            whitelistedToken.displayDecimals
          )} ${whitelistedToken.name} into the Silo...`,
          success: 'Deposit successful.',
        });

        // TEMP: recast as Beanstalk
        const b = beanstalk as unknown as Beanstalk;
        const data: string[] = [];
        const inputToken = formData.token;
        const value = ZERO_BN;
        let depositAmount;
        let depositFrom;

        // Direct Deposit
        if (inputToken === whitelistedToken) {
          // TODO: verify we have approval for `inputToken`
          depositAmount = formData.amount; // implicit: amount = amountOut since the tokens are the same
          depositFrom = FarmFromMode.INTERNAL_EXTERNAL;
        }

        // Swap and Deposit
        else {
          // Require a quote
          if (!formData.steps || !formData.amountOut) {
            throw new Error(`No quote available for ${formData.token.symbol}`);
          }

          // Wrap ETH to WETH
          // if (inputToken === Eth) {
          //   value = value.plus(formData.amount);
          //   data.push(
          //     b.interface.encodeFunctionData('wrapEth', [
          //       toStringBaseUnitBN(value, Eth.decimals),
          //       FarmToMode.INTERNAL, // to
          //     ])
          //   );
          // }

          // `amountOut` of `siloToken` is received when swapping for
          // `amount` of `inputToken`. this may include multiple swaps.
          // using "tolerant" mode allows for slippage during swaps.
          depositAmount = formData.amountOut;
          depositFrom = FarmFromMode.INTERNAL_TOLERANT;

          // Encode steps to get from token i to siloToken
          const encoded = Farm.encodeStepsWithSlippage(
            formData.steps,
            values.settings.slippage / 100
          );
          data.push(...encoded);
          encoded.forEach((_data, index) =>
            console.debug(
              `[Deposit] step ${index}:`,
              formData.steps?.[index]
                ?.decode(_data)
                .map((elem) =>
                  (elem instanceof ethers.BigNumber ? elem.toString() : elem)
                )
            )
          );
        }

        // Deposit step
        data.push(
          b.interface.encodeFunctionData('deposit', [
            whitelistedToken.address,
            toStringBaseUnitBN(depositAmount, whitelistedToken.decimals), // expected amountOut from all steps
            depositFrom,
          ])
        );

        const txn = await b.farm(data, {
          value: toStringBaseUnitBN(value, sdk.tokens.ETH.decimals),
        });
        txToast.confirming(txn);

        const receipt = await txn.wait();
        await Promise.all([
          refetchFarmerSilo(),
          refetchFarmerBalances(),
          refetchPools(),
          refetchSilo(),
        ]);
        txToast.success(receipt);
        formActions.resetForm();
      } catch (err) {
        txToast ? txToast.error(err) : toast.error(parseError(err));
        formActions.setSubmitting(false);
      }
    },
    [
      middleware, 
      whitelistedToken, 
      amountToBdv, 
      beanstalk, 
      sdk.tokens.ETH.decimals, 
      refetchFarmerSilo, 
      refetchFarmerBalances, 
      refetchPools, 
      refetchSilo
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

export default Deposit;
