import React, { useCallback, useMemo } from 'react';
import { Alert, Box, Divider, Link, Stack, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import toast from 'react-hot-toast';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Token, ERC20Token, NativeToken } from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { TokenSelectMode } from '~/components/Common/Form/TokenSelectDialog';
import { BalanceFromFragment, ClaimAndPlantFormState, FormStateNew } from '~/components/Common/Form';
import TxnPreview from '~/components/Common/Form/TxnPreview';
import TxnAccordion from '~/components/Common/TxnAccordion';
import { BUY_FERTILIZER } from '~/components/Barn/FertilizerItemTooltips';
import SmartSubmitButton from '~/components/Common/Form/SmartSubmitButton';
import TransactionToast from '~/components/Common/TxnToast';
import IconWrapper from '~/components/Common/IconWrapper';
import { IconSize } from '~/components/App/muiTheme';
import TokenIcon from '~/components/Common/TokenIcon';
import useToggle from '~/hooks/display/useToggle';
import useFertilizerSummary from '~/hooks/farmer/useFertilizerSummary';
import useTokenMap from '~/hooks/chain/useTokenMap';
import useFarmerBalances from '~/hooks/farmer/useFarmerBalances';
import usePreferredToken, { PreferredToken } from '~/hooks/farmer/usePreferredToken';
import Farm, { FarmFromMode, FarmToMode } from '~/lib/Beanstalk/Farm';
import { displayFullBN, toStringBaseUnitBN, parseError } from '~/util';
import { useFetchFarmerAllowances } from '~/state/farmer/allowances/updater';
import { FarmerBalances } from '~/state/farmer/balances';
import { ZERO_BN } from '~/constants';
import FertilizerItem from '../FertilizerItem';
import useAccount from '~/hooks/ledger/useAccount';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import { FC } from '~/types';
import TokenQuoteProviderWithParams from '~/components/Common/Form/TokenQuoteProviderWithParams';
import TokenSelectDialogNew from '~/components/Common/Form/TokenSelectDialogNew';
import useSdk, { getNewToOldToken } from '~/hooks/sdk';
import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';
import { BalanceFrom, balanceFromToMode } from '~/components/Common/Form/BalanceFromRow';
import ClaimPlant from '~/util/ClaimPlant';
import useClaimAndPlantActions from '~/hooks/farmer/claim-plant/useFarmerClaimPlantActions';
import ClaimAndPlantFarmActions from '~/components/Common/Form/ClaimAndPlantFarmOptions';
import useFarmerClaimingBalance from '~/hooks/farmer/claim-plant/useFarmerClaimingBalance';
import ClaimAndPlantAdditionalOptions from '~/components/Common/Form/ClaimAndPlantAdditionalOptions';

// ---------------------------------------------------

type BuyFormValues = FormStateNew & 
  BalanceFromFragment 
& ClaimAndPlantFormState & {
  settings: {
    slippage: number
  }
}

type BuyQuoteHandlerParams = {
  fromMode: FarmFromMode;
  additionalBean: BigNumber;
}

// ---------------------------------------------------

const BuyForm : FC<
  FormikProps<BuyFormValues>
  & {
    handleQuote: QuoteHandlerWithParams<BuyQuoteHandlerParams>;
    balances: FarmerBalances;
    tokenOut: ERC20Token;
  }
> = ({
  // Formik
  values,
  setFieldValue,
  isSubmitting,
  // Custom
  handleQuote,
  balances,
  tokenOut: token
}) => {
  const sdk = useSdk();
  const claimingBalances = useFarmerClaimingBalance();
  const tokenMap = useTokenMap<ERC20Token | NativeToken>([sdk.tokens.BEAN, sdk.tokens.USDC, sdk.tokens.ETH]);
  const { usdc, fert, humidity, actions } = useFertilizerSummary(values.tokens);

  // Extract
  const isValid = fert?.gt(0);

  // Handlers
  const [showTokenSelect, handleOpen, handleClose] = useToggle();
  const handleSelectTokens = useCallback((_tokens: Set<Token>) => {
    setFieldValue(
      'tokens',
      Array.from(_tokens).map((t) => ({ token: t, amount: null }))
    );
  }, [setFieldValue]);

  const handleSetBalanceFrom = (balanceFrom: BalanceFrom) => {
    setFieldValue('balanceFrom', balanceFrom);
  };

  return (
    <Form autoComplete="off" noValidate>
      <Stack gap={1}>
        {showTokenSelect && (
          <TokenSelectDialogNew
            open={showTokenSelect}
            handleClose={handleClose}
            selected={values.tokens}
            handleSubmit={handleSelectTokens}
            balances={balances}
            tokenList={Object.values(tokenMap)}
            mode={TokenSelectMode.SINGLE}
            balanceFrom={values.balanceFrom}
            setBalanceFrom={handleSetBalanceFrom}
            applicableBalances={claimingBalances}
          />
        )}

        {/* Form Contents */}
        {values.tokens.map((state, index) => {
          const balanceKey = state.token.symbol === 'ETH' ? 'eth' : state.token.address;
          const additionalBalance = claimingBalances[sdk.tokens.BEAN.address]?.applied || ZERO_BN;
          return (
            <TokenQuoteProviderWithParams<BuyQuoteHandlerParams>
              key={state.token.address}
              name={`tokens.${index}`}
              state={state}
              tokenOut={token}
              balance={balances[balanceKey] || undefined}
              showTokenSelect={handleOpen}
              handleQuote={handleQuote}
              balanceFrom={values.balanceFrom}
              additionalBalance={additionalBalance}
              params={{
                fromMode: balanceFromToMode(values.balanceFrom),
                additionalBean: additionalBalance
              }}
              belowComponent={<ClaimAndPlantFarmActions />}
            />
          ); }
        )}
        {/* Outputs */}
        {fert?.gt(0) ? (
          <>
            <Stack direction="column" gap={1} alignItems="center" justifyContent="center">
              <KeyboardArrowDownIcon color="secondary" />
              <Box sx={{ width: 150, pb: 1 }}>
                <FertilizerItem
                  isNew
                  amount={fert}
                  sprouts={fert.multipliedBy(humidity.plus(1))}
                  humidity={humidity}
                  state="active"
                  tooltip={BUY_FERTILIZER}
                />
              </Box>
              <Alert
                color="warning"
                icon={<IconWrapper boxSize={IconSize.medium}><WarningAmberIcon sx={{ fontSize: IconSize.small }} /></IconWrapper>}
                sx={{ color: 'black' }}
              >The amount of Fertilizer received rounds down to the nearest USDC. {usdc?.toFixed(2)} USDC = {fert?.toFixed(0)} FERT.
              </Alert>
              <Box width="100%">
                <ClaimAndPlantAdditionalOptions />
              </Box>
              <Box sx={{ width: '100%', mt: 0 }}>
                <TxnAccordion defaultExpanded={false}>
                  <TxnPreview
                    actions={actions}
                  />
                  <Divider sx={{ my: 2, opacity: 0.4 }} />
                  <Box sx={{ pb: 1 }}>
                    <Typography variant="body2">
                      Sprouts become <strong>Rinsable</strong> on a <Link href="https://docs.bean.money/almanac/protocol/glossary#pari-passu" target="_blank" rel="noreferrer" underline="hover">pari passu</Link> basis. Upon <strong>Rinse</strong>, each Sprout is redeemed for <span><TokenIcon token={sdk.tokens.BEAN} css={{ height: IconSize.xs, marginTop: 2.6 }} /></span>1.
                    </Typography>
                  </Box>
                </TxnAccordion>
              </Box>
            </Stack>
          </>
        ) : null}
        {/* Submit */}
        <SmartSubmitButton
          mode="auto"
          // Button props
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          loading={isSubmitting}
          disabled={!isValid}
          // Smart props
          contract={sdk.contracts.beanstalk}
          tokens={values.tokens}
        >
          Buy
        </SmartSubmitButton>
      </Stack>
    </Form>
  );
};

const Buy : FC<{}> = () => {
  // 
  const sdk = useSdk();
  const claimPlant = useClaimAndPlantActions();
  const account = useAccount();

  /// Farmer
  const balances = useFarmerBalances();
  const [refetchAllowances] = useFetchFarmerAllowances();
  
  /// Form
  const middleware = useFormMiddleware();
  const preferredTokens: PreferredToken[] = useMemo(() => {
    const tokens = sdk.tokens;

    return [
      { token: tokens.BEAN, minimum: new BigNumber(1) },
      { token: tokens.USDC, minimum: new BigNumber(1) },
      { token: tokens.ETH, minimum: new BigNumber(0.01) },
    ];
  }, [sdk.tokens]);
  const baseToken = usePreferredToken(preferredTokens, 'use-best');
  const tokenOut = sdk.tokens.USDC;
  
  const initialValues: BuyFormValues = useMemo(() => ({
    tokens: [
      {
        token: baseToken as (ERC20Token | NativeToken),
        amount: undefined,
      },
    ],
    balanceFrom: BalanceFrom.TOTAL,
    farmActions: {
      options: ClaimPlant.presets.claimBeans,
      selected: undefined,
      additional: undefined,
    },
    settings: {
      slippage: 0.1
    }
  }), [baseToken]);

  /// Handlers
  // Doesn't get called if tokenIn === tokenOut
  // aka if the user has selected USDC as input
  const handleQuote = useCallback<QuoteHandlerWithParams<BuyQuoteHandlerParams>>(async (
    _tokenIn, _amountIn, _tokenOut, { fromMode: _fromMode, additionalBean }
  ) => {
    if (!account) throw new Error('No account connected');
    const { ETH, WETH, BEAN, USDC } = sdk.tokens;
    const isEth = _tokenIn.symbol === ETH.symbol;
    const isWeth = WETH.equals(_tokenIn);

    let tokenIn = _tokenIn;
    let fromMode = _fromMode;
    let amountIn = _amountIn;

    const work = sdk.farm.create();
    if (_tokenIn === ETH || isWeth) {
      if (isEth) {
        work.add(new sdk.farm.actions.WrapEth(FarmToMode.INTERNAL));
        fromMode = FarmFromMode.INTERNAL_TOLERANT;
      } 
      // assume we have WETH now
      if (additionalBean.gt(0)) {
        // from mode is INTERNAL_TOLERANT
        work.add(sdk.farm.presets.weth2bean(fromMode, FarmToMode.INTERNAL));
        work.add(
          ClaimPlant.injectOnlyLocalAndAddAmount('inject beanAmount', BEAN.fromHuman(additionalBean.toString())), 
          { onlyLocal: true }
        );
        tokenIn = BEAN;
      } else {
        tokenIn = WETH;
      }
    } else if (BEAN.equals(tokenIn)) {
      amountIn = _amountIn.plus(additionalBean);
    } else if (!USDC.equals(tokenIn)) {
      throw new Error(`Buying fertilizer with ${_tokenIn.symbol} is not supported at this time.`);
    }

    const swap = sdk.swap.buildSwap(tokenIn, _tokenOut, account, fromMode, FarmToMode.INTERNAL);
    work.add(swap.getFarm());

    const estimate = await work.estimate(_tokenIn.amount(amountIn.toString()));

    return {
      amountOut: new BigNumber(_tokenOut.fromBlockchain(estimate).toHuman()),
      workflow: work,
    };
  }, [account, sdk]);

  const onSubmit = useCallback(async (
    values: BuyFormValues, formActions: FormikHelpers<BuyFormValues>
  ) => {
    let txToast;
    try {
      middleware.before();
      const { USDC } = sdk.tokens;
      const { beanstalk, curve, fertilizer } = sdk.contracts;
      if (!sdk.contracts.beanstalk) throw new Error('Unable to access contracts');
      if (!account) throw new Error('Connect a wallet first.');

      const formData = values.tokens[0];
      const tokenIn = formData.token;
      const amountIn = formData.amount;
      const amountUsdc = USDC.equals(tokenIn) ? formData.amount : formData.amountOut;
      
      if (!amountIn || !amountUsdc) throw new Error('An error occured');

      txToast = new TransactionToast({
        loading: `Buying ${displayFullBN(amountUsdc, USDC.displayDecimals)} Fertilizer...`,
        success: 'Purchase successful.',
      });

      const buyFert = sdk.farm.create();
      let fromMode = balanceFromToMode(values.balanceFrom);
      if (!USDC.equals(tokenIn)) {
        if (!formData.workflow) throw new Error('No quote available');
        buyFert.add(formData.workflow);
        fromMode = FarmFromMode.INTERNAL_TOLERANT;
      }

      const minLP = await curve.zap.callStatic.calc_token_amount(
        curve.pools.beanCrv3.address,
        [
          // 0.866616 is the ratio to add USDC/Bean at such that post-exploit
          // delta B in the Bean:3Crv pool with A=1 equals the pre-export 
          // total delta B times the haircut. Independent of the haircut %.
          USDC.amount(amountUsdc.times(0.866616).toString()).blockchainString, // BEAN
          0, // DAI
          USDC.amount(amountUsdc.toString()).blockchainString, // USDC
          0, // USDT
        ],
        true, // _is_deposit
        { gasLimit: 10000000 }
      );

      const callData =  beanstalk.interface.encodeFunctionData('mintFertilizer', [
        toStringBaseUnitBN(amountUsdc, 0),
        Farm.slip(minLP, 0.1 / 100),
        fromMode,
      ]);

      buyFert.add(async (_amountInStep: ethers.BigNumber, _context: any) => ({
        name: 'mintFertilizer',
        amountOut: _amountInStep,
        prepare: () => ({
          target: beanstalk.address,
          callData,
        }),
        decode: (data: string) => beanstalk.interface.decodeFunctionData('mintFertilizer', data),
        decodeResult: (result: string) => beanstalk.interface.decodeFunctionResult('mintFertilizer', result),
      }));

      const options = { slippage: values.settings.slippage };
      const { execute, actionsPerformed } = await ClaimPlant.build(
        sdk,
        {}, // no actions. Handled in useQuote
        claimPlant.buildActions(values.farmActions.additional),
        buyFert,
        tokenIn.amount(amountIn.toString()),
        options,
      );

      const txn = await execute();
      txToast.confirming(txn);

      const receipt = await txn.wait();

      await claimPlant.refetch(actionsPerformed, { 
        farmerBarn: true,
        farmerBalances: true,
      }, [
        () => refetchAllowances(account, fertilizer.address, getNewToOldToken(USDC))
      ]);
      txToast.success(receipt);
      formActions.resetForm();
    } catch (err) {
      txToast ? txToast.error(err) : toast.error(parseError(err));
      console.error(err);
    }
  }, [middleware, sdk, account, claimPlant, refetchAllowances]);

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit}>
      {(formikProps) => (
        <BuyForm
          handleQuote={handleQuote}
          balances={balances}
          tokenOut={tokenOut}
          {...formikProps}
        />
      )}
    </Formik>
  );
};

export default Buy;
