import React, { useCallback, useEffect, useMemo } from 'react';
import { Stack } from '@mui/material';
import { Form, Formik,  FormikHelpers, FormikProps } from 'formik';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { useSelector } from 'react-redux';
import { Token, ERC20Token, NativeToken, TokenValue, FarmWorkflow } from '@beanstalk/sdk';
import { LoadingButton } from '@mui/lab';
import toast from 'react-hot-toast';
import { BEAN } from '~/constants/tokens';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import { FarmWithClaimFormState, FormStateNew, SettingInput, TxnSettings } from '~/components/Common/Form';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import { ApplicableBalance, FarmerBalances } from '~/state/farmer/balances';
import { ZERO_BN } from '~/constants';
import { FarmFromMode, FarmToMode } from '~/lib/Beanstalk/Farm';
import useToggle from '~/hooks/display/useToggle';
import { useSigner } from '~/hooks/ledger/useSigner';
import { useFetchFarmerSilo } from '~/state/farmer/silo/updater';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import { AppState } from '~/state';
import { useFetchPools } from '~/state/bean/pools/updater';
import { useFetchBeanstalkSilo } from '~/state/beanstalk/silo/updater';
import { FC } from '~/types';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';
import useFarmerClaimableBeanAssets from '~/hooks/farmer/useFarmerClaimableBeanAssets';
import ClaimableAssets from '../ClaimableAssets';
import TokenSelectDialogNew from '~/components/Common/Form/TokenSelectDialogNew';
import useSdk, { useToTokenMap } from '~/hooks/sdk';
import TokenQuoteProviderNew from '~/components/Common/Form/TokenQuoteProviderNew';
import { useGetPreferredToken } from '~/hooks/farmer/usePreferredToken';
import TransactionToast from '~/components/Common/TxnToast';
import { parseError } from '~/util';
import useClaimAndDoX from '~/hooks/sdk/useClaimAndDoX';
import { QuoteHandlerAdvanced } from '~/hooks/ledger/useQuoteAdvanced';

// -----------------------------------------------------------------------

type DepositFormValuesNew = FormStateNew & FarmWithClaimFormState & {
  settings: {
    slippage: number;
  }
};

enum DepositTxnErr {
  NoSlippage = 'No slippage value set',
  MoreThanOneToken = 'Only one token supported at this time',
  NoAmount = 'Enter an amount to deposit',
  NoTokenIn = 'Deposit Token not found',
  NoTokenOut = 'Whitelisted Silo Token not found',
}

// -----------------------------------------------------------------------

const DepositForm : FC<
  FormikProps<DepositFormValuesNew> & {
    tokenList: (ERC20Token | NativeToken)[];
    whitelistedToken: ERC20Token | NativeToken;
    amountToBdv: (amount: BigNumber) => BigNumber;
    balances: FarmerBalances;
    contract: ethers.Contract;
    handleQuote: QuoteHandlerAdvanced;
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
  const claimable = useFarmerClaimableBeanAssets();
  const sdk = useSdk();
  const [isTokenSelectVisible, showTokenSelect, hideTokenSelect] = useToggle();
  // const { amount, bdv, stalk, seeds, actions } = BeanstalkSDK.Silo.Deposit.deposit(
  //   whitelistedToken,
  //   values.tokens,
  //   amountToBdv,
  // );

  /// Derived
  // const isReady = bdv.gt(0);

  const applicableBalances: Record<string, ApplicableBalance> = useMemo(() => {
    const beanClaimAmount = Object.values(values.beansClaiming).reduce((prev, curr) => {
      if (curr.amount?.gt(0)) prev = prev.plus(curr.amount);
      return prev;
    }, ZERO_BN);

    return {
      [BEAN[1].address]: {
        total: values.maxBeansClaimable,
        applied: beanClaimAmount,
        remaining: values.maxBeansClaimable.minus(beanClaimAmount),
      }
    };
  }, [values.beansClaiming, values.maxBeansClaimable]);

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
  }, [setFieldValue]);

  /// Effects
  useEffect(() => {
    // update max claimable if it changes
    // do this here instead of in its parent to avoid it not being set in initial values
    if (values.maxBeansClaimable.eq(claimable.total)) return;
    setFieldValue('maxBeansClaimable', claimable.total);
  }, [claimable.total, setFieldValue, values.maxBeansClaimable]);

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
        {values.tokens.map((tokenState, index) => (
          <TokenQuoteProviderNew
            slippage={values.settings.slippage}
            key={`tokens.${index}`}
            name={`tokens.${index}`}
            tokenOut={whitelistedToken}
            balance={balances[
              tokenState.token.equals(sdk.tokens.ETH) ? 'eth' : tokenState.token.address
            ] || ZERO_BN}
            state={tokenState}
            showTokenSelect={showTokenSelect}
            handleQuote={handleQuote}
            inputVariant="wrapped"
            additionalBalance={applicableBalances[tokenState.token.address]?.applied}
            TokenAdornmentProps={{
              balanceFrom: values.balanceFrom
            }}
          />
        ))}
        <ClaimableAssets
          balances={claimable.assets}
          farmerBalances={balances}
        />

        <LoadingButton
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          Deposit
        </LoadingButton>
      </Stack>
    </Form>
  );
};

// -----------------------------------------------------------------------

const Deposit3 : FC<{
  pool: any;
  token: ERC20Token | NativeToken;
}> = ({
  pool,
  token: whitelistedToken
}) => {
  const sdk = useSdk();
  /// Chain Constants

  /// FIXME: name
  /// FIXME: finish deposit functionality for other tokens
  const middleware = useFormMiddleware();
  const initTokenList = useMemo(() => (whitelistedToken.address === sdk.tokens.BEAN.address ? [
    sdk.tokens.BEAN,
    sdk.tokens.ETH,
  ] : [
    sdk.tokens.BEAN,
    sdk.tokens.ETH,
    whitelistedToken,
    sdk.tokens.CRV3,
    sdk.tokens.DAI,
    sdk.tokens.USDC,
    sdk.tokens.USDT
  ]), [sdk, whitelistedToken]);
  const allAvailableTokens = useToTokenMap(initTokenList);

  /// Derived
  const isUnripe = sdk.tokens.unripeTokens.has(whitelistedToken);

  /// Token List
  const [tokenList, preferredTokens] = useMemo(() => {
    // Exception: if page is Depositing Unripe assets
    // then constrain the token list to only unripe.
    if (isUnripe) {
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
  }, [
    isUnripe,
    whitelistedToken,
    allAvailableTokens,
  ]);
  const baseToken = useGetPreferredToken(preferredTokens, 'use-best') as (ERC20Token | NativeToken);

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
  const initialValues : DepositFormValuesNew = useMemo(() => ({
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
  }), [baseToken]);

  const { getEncodedSteps, transferExcess, refetch } = useClaimAndDoX(whitelistedToken.address);

  const getWorkflow = useCallback(async (
    tokenIn: Token, _amountIn: BigNumber, tokenOut: Token, _fromMode?: FarmFromMode
  ): Promise<{
    handleEstimate: (amt: TokenValue) => Promise<TokenValue>,
    workflow: FarmWorkflow<{ slippage: number } & Record<string, any>>;
  }> => {
    const account = await sdk.getAccount();

    const deposit = await sdk.silo.buildDeposit(tokenOut, account);
    deposit.setInputToken(tokenIn);
    const from = tokenIn.symbol === tokenOut.symbol ? FarmFromMode.INTERNAL_EXTERNAL : FarmFromMode.INTERNAL_TOLERANT;

    deposit.fromMode = from;

    console.log('deposit: ', deposit);

    return { 
      handleEstimate: async (amt) => deposit.estimate(amt),
      workflow: deposit.workflow
    };
  }, [sdk]);

  /// Handlers
  // This handler does not run when _tokenIn = _tokenOut (direct deposit)
  const handleQuote = useCallback<QuoteHandlerAdvanced>(
    async (_tokenIn, _amountIn, _tokenOut, _slippage, _fromMode) => {
      const { handleEstimate } = await getWorkflow(_tokenIn, _amountIn, _tokenOut, _fromMode);
      const amountIn = _tokenIn.fromHuman(_amountIn.toString());

      const estimate = await handleEstimate(amountIn);
      if (!estimate) {
        throw new Error(`Depositing ${_tokenOut.symbol} to the Silo via ${_tokenIn.symbol} is currently unsupported.`);
      }
      console.debug('[chain] estimate = ', estimate);

      return {
        amountOut: new BigNumber(estimate.toHuman()),
      };
    },
    [getWorkflow]
  );

  const onSubmit = useCallback(async (
    values: DepositFormValuesNew,
    formActions: FormikHelpers<DepositFormValuesNew>
  ) => {
    let txToast;
    try {
      // Check for errors
      middleware.before();
      const formData = values.tokens[0];
      const tokenIn = sdk.tokens.findBySymbol(formData.token.symbol);

      if (!values.settings.slippage) throw new Error(DepositTxnErr.NoSlippage);
      if (values.tokens.length > 1) throw new Error(DepositTxnErr.MoreThanOneToken);
      if (!formData?.amount || formData.amount.eq(0)) throw new Error(DepositTxnErr.NoAmount);
      if (!tokenIn) throw new Error(DepositTxnErr.NoTokenIn);
      // shoud never happen but need to check to unwrap optional
      if (!whitelistedToken) throw new Error(DepositTxnErr.NoTokenOut);

      const work = sdk.farm.create();
      
      const amountIn = tokenIn.fromHuman(formData.amount.toString());
      const beanClaimAmount = Object.values(values.beansClaiming).reduce((acc, curr) => acc.plus(curr.amount), ZERO_BN);
      const isClaimingBeans = beanClaimAmount.gt(0) && values.maxBeansClaimable.gt(0);
      const toMode = values.destination;
      let surplus: BigNumber = ZERO_BN;

      if (isClaimingBeans) {
        if (tokenIn.equals(sdk.tokens.BEAN)) {
          if (formData.amount?.lt(beanClaimAmount)) {
            surplus = beanClaimAmount.minus(formData.amount);
            console.log('beanClaimAmount: ', surplus.toString());
          }
        } else {
          surplus = beanClaimAmount;
          console.log('beanClaimAmount: ', surplus.toString());
        }
        
        if (toMode) {
          const bClaiming = Object.keys(values.beansClaiming);
          console.log('bclaiming: ', bClaiming);
          for (const k of bClaiming) {
            const encodedStep = getEncodedSteps[k]?.(toMode);
            if (encodedStep) {
              work.add(async () => encodedStep);
            }
          }
        }
      }

      if (surplus?.gt(0) && !toMode) {
        throw new Error('You must select a destination for your excess beans.');
      }

      const { workflow } = await getWorkflow(tokenIn, formData.amount, whitelistedToken);

      if (surplus.gt(0) && values.destination === FarmToMode.EXTERNAL) {
        // work.add(async () => ({
        //   name: 'transfer',
        //   amountOut: surplus.toString(),
        //   prepare: () => ({
        //     target: '',
        //     callData: ''
        //   }),
        //   decode: () => undefined,
        //   decodeResult: () => undefined,
        // }), { onlyLocal: true });
        const transferStep = await transferExcess(sdk.tokens.BEAN.fromHuman(surplus.toString()));
        transferStep && work.add(async () => transferStep);
        console.log('transferStep: ', transferStep);
      }

      if (isClaimingBeans) {
        work.add(async () => ({
          name: 'pre-deposit',
          amountOut: amountIn.toBigNumber(),
          prepare: () => ({
            target: '',
            callData: ''
          }),
          decode: () => undefined,
          decodeResult: () => undefined,
        }), { onlyLocal: true });
      }
      /*
        farm([
          harvest 10 beans
          deposit 5 beans + 1 ETH
        ])
      */

      work.add([...workflow.generators]);

      /*
        is the user claiming beans?
          if no, just deposit
          if yes...
            is the user depositing beans?
              is the user depositing all claimed beans?
                yes: claim => internal balance, deposit
                no: claim => internal balance, deposit, send the excess beans to the destination
            no: 
              claim => destination, deposit

        if is claiming beans, generate the claim work flow
       */

      const est = await work.estimate(amountIn);

      const estimate = whitelistedToken.fromBlockchain(est);
      console.log('estimate: ', estimate.toHuman());

      const summary = await work.summarizeSteps();
      summary.forEach((d) => {
        const name = d.name || 'unknown';
        const amount = d.amountOut.toString();

        console.log(`[chain] ${name} = ${amount}`);
      });

      txToast = new TransactionToast({
        loading: `Depositing ${estimate.toHuman()} ${whitelistedToken.name} into the Silo...`,
        success: 'Deposit successful.'
      });

      // const txn = await handleExecute(amountIn, values.settings.slippage);
      // txToast.confirming(txn);
      // const reciept = await txn.wait();

      // await Promise.all([
      //   refetchFarmerSilo(),
      //   refetchFarmerBalances(),
      //   refetchPools(),
      //   refetchSilo(),
      // ]);
      // txToast.success(reciept);
      txToast.success();
      formActions.resetForm();
    } catch (err) {
      txToast ? txToast.error(err) : toast.error(parseError(err));
      formActions.setSubmitting(false);
      console.log('err: ', err);
    }
  }, [getEncodedSteps, getWorkflow, middleware, sdk.farm, sdk.tokens, transferExcess, whitelistedToken]);
  
  return (
    <Formik<DepositFormValuesNew> initialValues={initialValues} onSubmit={onSubmit}>
      {(formikProps) => (
        <>
          <TxnSettings placement="form-top-right">
            <SettingInput name="settings.slippage" label="Slippage Tolerance" endAdornment="%" />
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

export default Deposit3;

/* {isReady ? (
  <>
    <TxnSeparator />
    <TokenOutputField
      token={whitelistedToken}
      amount={amount}
    />
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
    <Box>
      <Accordion variant="outlined">
        <StyledAccordionSummary title="Transaction Details" />
        <AccordionDetails>
          <TxnPreview
            actions={actions}
          />
        </AccordionDetails>
      </Accordion>
    </Box>
  </>
) : null} */

// const onSubmit = useCallback(async (values: DepositFormValues, formActions: FormikHelpers<DepositFormValues>) => {
//   let txToast;
//   try {
//     middleware.before();
//     if (!values.settings.slippage) throw new Error('No slippage value set');
//     const formData = values.tokens[0];
//     if (values.tokens.length > 1) throw new Error('Only one token supported at this time');
//     if (!formData?.amount || formData.amount.eq(0)) throw new Error('Enter an amount to deposit');

//     // FIXME: getting BDV per amount here
//     const { amount } = BeanstalkSDK.Silo.Deposit.deposit(
//       whitelistedToken,
//       values.tokens,
//       amountToBdv,
//     );

//     txToast = new TransactionToast({
//       loading: `Depositing ${displayFullBN(amount.abs(), whitelistedToken.displayDecimals, whitelistedToken.displayDecimals)} ${whitelistedToken.name} into the Silo...`,
//       success: 'Deposit successful.',
//     });

//     console.log('amount: ', amount.toString());

//     // TEMP: recast as Beanstalk 
//     const b = ((beanstalk as unknown) as Beanstalk);
//     const data : string[] = [];
//     const inputToken = formData.token;
//     let value = ZERO_BN;
//     let depositAmount;
//     let depositFrom;

//     // Direct Deposit
//     if (inputToken === whitelistedToken) {
//       // TODO: verify we have approval for `inputToken`
//       depositAmount = formData.amount; // implicit: amount = amountOut since the tokens are the same
//       depositFrom   = FarmFromMode.INTERNAL_EXTERNAL;
//     }
    
//     // Swap and Deposit
//     else {
//       // Require a quote
//       if (!formData.steps || !formData.amountOut) throw new Error(`No quote available for ${formData.token.symbol}`);

//       // Wrap ETH to WETH
//       if (inputToken === Eth) {
//         value = value.plus(formData.amount); 
//         data.push(b.interface.encodeFunctionData('wrapEth', [
//           toStringBaseUnitBN(value, Eth.decimals),
//           FarmToMode.INTERNAL, // to
//         ]));
//       }
      
//       // `amountOut` of `siloToken` is received when swapping for 
//       // `amount` of `inputToken`. this may include multiple swaps.
//       // using "tolerant" mode allows for slippage during swaps.
//       depositAmount = formData.amountOut;
//       depositFrom   = FarmFromMode.INTERNAL_TOLERANT;

//       // Encode steps to get from token i to siloToken
//       const encoded = Farm.encodeStepsWithSlippage(
//         formData.steps,
//         values.settings.slippage / 100,
//       );
//       data.push(...encoded);
//       encoded.forEach((_data, index) => 
//         console.debug(`[Deposit] step ${index}:`, formData.steps?.[index]?.decode(_data).map((elem) => (elem instanceof ethers.BigNumber ? elem.toString() : elem)))
//       );
//     } 

//     // Deposit step
//     data.push(
//       b.interface.encodeFunctionData('deposit', [
//         whitelistedToken.address,
//         toStringBaseUnitBN(depositAmount, whitelistedToken.decimals),  // expected amountOut from all steps
//         depositFrom,
//       ])
//     );
  
//     const txn = await b.farm(data, { value: toStringBaseUnitBN(value, Eth.decimals) });
//     txToast.confirming(txn);

//     const receipt = await txn.wait();
//     await Promise.all([
//       refetchFarmerSilo(),
//       refetchFarmerBalances(),
//       refetchPools(),
//       refetchSilo(),
//     ]);
//     txToast.success(receipt);
//     txToast.success();
//     formActions.resetForm();
//   } catch (err) {
//     txToast ? txToast.error(err) : toast.error(parseError(err));
//     formActions.setSubmitting(false);
//   }
// }, [
//   Eth,
//   beanstalk,
//   whitelistedToken,
//   amountToBdv,
//   refetchFarmerSilo,
//   refetchFarmerBalances,
//   refetchPools,
//   refetchSilo,
//   middleware,
// ]);
