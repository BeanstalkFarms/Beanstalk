import React, { useCallback, useMemo, useState } from 'react';
import { Formik, FormikHelpers } from 'formik';
import BigNumber from 'bignumber.js';
import {
  Token,
  ERC20Token,
  BeanstalkSDK,
  TokenValue,
  ConvertDetails,
  FarmToMode,
  FarmFromMode,
  TokenSiloBalance,
} from '@beanstalk/sdk';
import { SettingInput, TxnSettings } from '~/components/Common/Form';
import { tokenValueToBN } from '~/util';
import { FarmerSilo } from '~/state/farmer/silo';
import useSeason from '~/hooks/beanstalk/useSeason';
import TransactionToast from '~/components/Common/TxnToast';
import { useFetchPools } from '~/state/bean/pools/updater';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import useSdk from '~/hooks/sdk';
import { QuoteHandlerWithParams } from '~/hooks/ledger/useQuoteWithParams';
import useAccount from '~/hooks/ledger/useAccount';
import FormTxnProvider from '~/components/Common/Form/FormTxnProvider';
import useFormTxnContext from '~/hooks/sdk/useFormTxnContext';
import { FormTxn, ConvertFarmStep } from '~/lib/Txn';
import { useWhitelistedTokens } from '~/hooks/beanstalk/useTokens';
import { useFetchFarmerSilo } from '~/state/farmer/silo/updater';
import { DefaultConvertForm } from './DefaultConvertForm';
// import { PipelineConvertForm } from './PipelineConvertForm';
import {
  BaseConvertFormProps,
  ConvertFormSubmitHandler,
  ConvertFormValues,
  ConvertProps,
  ConvertQuoteHandlerParams,
} from './types';
import { PipelineConvertForm } from './PipelineConvertForm';

interface Props extends BaseConvertFormProps {
  farmerBalances: TokenSiloBalance | undefined;
}

// ---------- Regular Convert via Beanstalk.convert() ----------
const DefaultConvertFormWrapper = (props: Props) => {
  const { sdk, plantAndDoX, farmerBalances, currentSeason } = props;

  const [conversion, setConversion] = useState<ConvertDetails>({
    actions: [],
    amount: TokenValue.ZERO,
    bdv: TokenValue.ZERO,
    crates: [],
    seeds: TokenValue.ZERO,
    stalk: TokenValue.ZERO,
  });

  /// Handlers
  // This handler does not run when _tokenIn = _tokenOut (direct deposit)
  const handleQuote = useCallback<
    QuoteHandlerWithParams<ConvertQuoteHandlerParams>
  >(
    async (tokenIn, _amountIn, tokenOut, { slippage, isConvertingPlanted }) => {
      try {
        if (!farmerBalances?.convertibleDeposits) {
          throw new Error('No balances found');
        }
        const { plantAction } = plantAndDoX;

        const includePlant = !!(isConvertingPlanted && plantAction);

        const result = await ConvertFarmStep._handleConversion(
          sdk,
          farmerBalances.convertibleDeposits,
          tokenIn,
          tokenOut,
          tokenIn.amount(_amountIn.toString() || '0'),
          currentSeason.toNumber(),
          slippage,
          includePlant ? plantAction : undefined
        );

        setConversion(result.conversion);

        return tokenValueToBN(result.minAmountOut);
      } catch (e) {
        console.debug('[Convert/handleQuote]: FAILED: ', e);
        return new BigNumber('0');
      }
    },
    [farmerBalances?.convertibleDeposits, sdk, currentSeason, plantAndDoX]
  );

  return (
    <DefaultConvertForm
      handleQuote={handleQuote}
      conversion={conversion}
      {...props}
    />
  );
};

// ---------- Convert Form Router ----------
/**
 * Depending on whether the conversion requires a pipeline convert,
 * return the appropriate convert form.
 */
const ConvertFormRouter = (props: Props) => {
  const tokenOut = props.values.tokenOut as ERC20Token;

  if (!tokenOut) return null;

  if (isPipelineConvert(props.fromToken, tokenOut)) {
    return <PipelineConvertForm {...props} />;
  }

  return <DefaultConvertFormWrapper {...props} />;
};

// ---------- Convert Forms Wrapper ----------
// Acts as a Prop provider for the Convert forms
const ConvertFormsWrapper = ({ fromToken }: ConvertProps) => {
  const sdk = useSdk();
  const farmerSilo = useFarmerSilo();
  const season = useSeason();

  /// Form
  const middleware = useFormMiddleware();
  const formTxnContext = useFormTxnContext();

  /// Token List
  const [tokenList, initialTokenOut] = useConvertTokenList(fromToken);

  const initialValues: ConvertFormValues = useMemo(
    () => ({
      // Settings
      settings: {
        slippage: 0.05,
      },
      // Token Inputs
      tokens: [
        {
          token: fromToken,
          amount: undefined,
          quoting: false,
          amountOut: undefined,
        },
      ],
      // Convert data
      maxAmountIn: undefined,
      // Token Outputs
      tokenOut: initialTokenOut,
      farmActions: {
        preset: fromToken.isLP || fromToken.isUnripe ? 'noPrimary' : 'plant',
        primary: undefined,
        secondary: undefined,
        implied: [FormTxn.MOW],
      },
      pipe: {
        callData: [],
        amountOut: undefined,
      },
    }),
    [fromToken, initialTokenOut]
  );

  const farmerBalances = farmerSilo.balancesSdk.get(fromToken);

  const defaultSubmitHandler = useDefaultConvertSubmitHandler({
    sdk,
    farmerSilo,
    middleware,
    initialValues,
    formTxnContext,
    season,
    fromToken,
  });

  const pipelineConvertSubmitHandler = usePipelineConvertSubmitHandler({
    sdk,
    middleware,
    initialValues,
  });

  const submitHandler: ConvertFormSubmitHandler = useCallback(
    async (values, formActions) => {
      const tokenOut = values.tokenOut;
      if (!tokenOut) {
        throw new Error('no token out set');
      }

      if (isPipelineConvert(fromToken, tokenOut as ERC20Token)) {
        return pipelineConvertSubmitHandler(values, formActions);
      }

      return defaultSubmitHandler(values, formActions);
    },
    [defaultSubmitHandler, pipelineConvertSubmitHandler, fromToken]
  );

  return (
    <Formik initialValues={initialValues} onSubmit={submitHandler}>
      {(formikProps) => (
        <>
          <TxnSettings placement="form-top-right">
            <SettingInput
              name="settings.slippage"
              label="Slippage Tolerance"
              endAdornment="%"
            />
          </TxnSettings>
          <ConvertFormRouter
            {...formikProps}
            sdk={sdk}
            tokenList={tokenList}
            farmerBalances={farmerBalances}
            siloBalances={farmerSilo.balances}
            plantAndDoX={formTxnContext.plantAndDoX}
            fromToken={fromToken}
            currentSeason={season}
          />
        </>
      )}
    </Formik>
  );
};

const Convert = (props: ConvertProps) => (
  <FormTxnProvider>
    <ConvertFormsWrapper {...props} />
  </FormTxnProvider>
);

export default Convert;

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function usePipelineConvertSubmitHandler({
  sdk,
  middleware,
  initialValues,
}: {
  sdk: BeanstalkSDK;
  middleware: ReturnType<typeof useFormMiddleware>;
  initialValues: ConvertFormValues;
}) {
  const account = useAccount();
  const [refetchFarmerSilo] = useFetchFarmerSilo();
  const [refetchPools] = useFetchPools();

  return useCallback(
    async (
      values: ConvertFormValues,
      formActions: FormikHelpers<ConvertFormValues>
    ) => {
      const txToast = new TransactionToast({
        loading: 'Converting...',
        success: 'Convert successful.',
      });

      try {
        middleware.before();

        // form Data
        const tokenIn = values.tokens[0].token;
        const _amountIn = values.tokens[0].amount;
        const tokenOut = values.tokenOut;
        const _amountOut = values?.pipe?.amountOut;

        const callData = values.pipe?.callData || [];
        const slippage = values?.settings?.slippage;
        const amountIn = tokenIn?.amount(_amountIn?.toString() || '0'); // amount of from token
        const amountOut = tokenOut?.amount(_amountOut?.toString() || '0'); // amount of to token

        /// Validation
        if (!account) throw new Error('Wallet connection required');
        if (!slippage) throw new Error('No slippage value set.');
        if (!tokenOut) throw new Error('Conversion pathway not set');
        if (amountIn.lte(0)) throw new Error('Amount must be greater than 0');

        if (!callData?.length) {
          throw new Error('Pipeline Convert callData not found');
        }
        if (!amountOut || amountOut?.lte(0)) {
          throw new Error('Conversion invalid');
        }

        const farm = sdk.farm.createAdvancedFarm();

        callData.forEach((data) => {
          farm.add(() => ({
            target: sdk.contracts.beanstalk.address,
            callData: data,
          }));
        });

        const gasEstimate = await farm.estimateGas(amountIn, { slippage });
        const adjustedGas = Math.round(gasEstimate.toNumber() * 1.2).toString();
        const txn = await farm.execute(
          amountIn,
          { slippage },
          { gasLimit: adjustedGas }
        );
        txToast.confirming(txn);

        const receipt = await txn.wait();

        await Promise.all([
          refetchFarmerSilo(),
          refetchPools(), // update prices to account for pool conversion
        ]);

        txToast.success(receipt);

        formActions.resetForm({
          values: {
            ...initialValues,
          },
        });
      } catch (err) {
        console.error(err);
        txToast.error(err);
        formActions.setSubmitting(false);
      }
    },
    [sdk, account, initialValues, middleware, refetchFarmerSilo, refetchPools]
  );
}

function useDefaultConvertSubmitHandler({
  sdk,
  farmerSilo,
  middleware,
  formTxnContext,
  initialValues,
  season,
  fromToken,
}: {
  sdk: BeanstalkSDK;
  farmerSilo: FarmerSilo;
  middleware: ReturnType<typeof useFormMiddleware>;
  formTxnContext: ReturnType<typeof useFormTxnContext>;
  initialValues: ConvertFormValues;
  season: BigNumber;
  fromToken: ERC20Token;
}) {
  const { txnBundler, plantAndDoX, refetch } = formTxnContext;
  const account = useAccount();
  const [refetchFarmerSilo] = useFetchFarmerSilo();
  const [refetchPools] = useFetchPools();

  return useCallback(
    async (
      values: ConvertFormValues,
      formActions: FormikHelpers<ConvertFormValues>
    ) => {
      const farmerBalances = farmerSilo.balancesSdk.get(fromToken);
      let txToast;
      try {
        middleware.before();

        /// FormData
        const slippage = values?.settings?.slippage;
        const tokenIn = values.tokens[0].token;
        const tokenOut = values.tokenOut;
        const _amountIn = values.tokens[0].amount;

        /// Validation
        if (!account) throw new Error('Wallet connection required');
        if (!slippage) throw new Error('No slippage value set.');
        if (!tokenOut) throw new Error('Conversion pathway not set');
        if (!farmerBalances) throw new Error('No balances found');

        txToast = new TransactionToast({
          loading: 'Converting...',
          success: 'Convert successful.',
        });

        let txn;

        const { plantAction } = plantAndDoX;

        const amountIn = tokenIn.amount(_amountIn?.toString() || '0'); // amount of from token
        const isPlanting =
          plantAndDoX && values.farmActions.primary?.includes(FormTxn.PLANT);

        const convertTxn = new ConvertFarmStep(
          sdk,
          tokenIn,
          tokenOut,
          season.toNumber(),
          farmerBalances.convertibleDeposits
        );

        const { getEncoded, minAmountOut } = await convertTxn.handleConversion(
          amountIn,
          slippage,
          isPlanting ? plantAction : undefined
        );

        convertTxn.build(getEncoded, minAmountOut);
        const actionsPerformed = txnBundler.setFarmSteps(values.farmActions);

        if (!isPlanting) {
          const { execute } = await txnBundler.bundle(
            convertTxn,
            amountIn,
            slippage,
            1.2
          );

          txn = await execute();
        } else {
          // Create Advanced Farm operation for alt-route Converts
          const farm = sdk.farm.createAdvancedFarm('Alternative Convert');

          // Get Earned Beans data
          const stemTips = await sdk.silo.getStemTip(tokenIn);
          const earnedBeans = await sdk.silo.getEarnedBeans(account);
          const earnedStem = stemTips.toString();
          const earnedAmount = earnedBeans.toBlockchain();

          // Plant
          farm.add(new sdk.farm.actions.Plant());

          // Withdraw Planted deposit crate
          farm.add(
            new sdk.farm.actions.WithdrawDeposit(
              tokenIn.address,
              earnedStem,
              earnedAmount,
              FarmToMode.INTERNAL
            )
          );

          // Transfer to Well
          farm.add(
            new sdk.farm.actions.TransferToken(
              tokenIn.address,
              sdk.pools.BEAN_ETH_WELL.address,
              FarmFromMode.INTERNAL,
              FarmToMode.EXTERNAL
            )
          );

          // Create Pipeline operation
          const pipe = sdk.farm.createAdvancedPipe('pipelineDeposit');

          // (Pipeline) - Call sync on Well
          pipe.add(
            new sdk.farm.actions.WellSync(
              sdk.pools.BEAN_ETH_WELL,
              tokenIn,
              sdk.contracts.pipeline.address
            ),
            { tag: 'amountToDeposit' }
          );

          // (Pipeline) - Approve transfer of sync output
          const approveClipboard = {
            tag: 'amountToDeposit',
            copySlot: 0,
            pasteSlot: 1,
          };
          pipe.add(
            new sdk.farm.actions.ApproveERC20(
              sdk.pools.BEAN_ETH_WELL.lpToken,
              sdk.contracts.beanstalk.address,
              approveClipboard
            )
          );

          // (Pipeline) - Transfer sync output to Beanstalk
          const transferClipboard = {
            tag: 'amountToDeposit',
            copySlot: 0,
            pasteSlot: 2,
          };
          pipe.add(
            new sdk.farm.actions.TransferToken(
              sdk.tokens.BEAN_ETH_WELL_LP.address,
              account,
              FarmFromMode.EXTERNAL,
              FarmToMode.INTERNAL,
              transferClipboard
            )
          );

          // Add Pipeline operation to the Advanced Pipe operation
          farm.add(pipe);

          // Deposit Advanced Pipe output to Silo
          farm.add(
            new sdk.farm.actions.Deposit(
              sdk.tokens.BEAN_ETH_WELL_LP,
              FarmFromMode.INTERNAL
            )
          );

          // Convert the other Deposits as usual
          if (amountIn.gt(0)) {
            const convertData = sdk.silo.siloConvert.calculateConvert(
              tokenIn,
              tokenOut,
              amountIn,
              farmerBalances.convertibleDeposits,
              season.toNumber()
            );
            const amountOut = await sdk.contracts.beanstalk.getAmountOut(
              tokenIn.address,
              tokenOut.address,
              convertData.amount.toBlockchain()
            );
            const _minAmountOut = TokenValue.fromBlockchain(
              amountOut.toString(),
              tokenOut.decimals
            ).mul(1 - slippage);
            farm.add(
              new sdk.farm.actions.Convert(
                sdk.tokens.BEAN,
                sdk.tokens.BEAN_ETH_WELL_LP,
                amountIn,
                _minAmountOut,
                convertData.crates
              )
            );
          }

          // Mow Grown Stalk
          const tokensWithStalk: Map<Token, TokenValue> = new Map();
          farmerSilo.stalk.grownByToken.forEach((value, token) => {
            if (value.gt(0)) {
              tokensWithStalk.set(token, value);
            }
          });
          if (tokensWithStalk.size > 0) {
            farm.add(new sdk.farm.actions.Mow(account, tokensWithStalk));
          }

          const gasEstimate = await farm.estimateGas(earnedBeans, {
            slippage: slippage,
          });
          const adjustedGas = Math.round(
            gasEstimate.toNumber() * 1.2
          ).toString();
          txn = await farm.execute(
            earnedBeans,
            { slippage: slippage },
            { gasLimit: adjustedGas }
          );
        }

        txToast.confirming(txn);

        const receipt = await txn.wait();

        await refetch(actionsPerformed, { farmerSilo: true }, [
          refetchPools, // update prices to account for pool conversion
          refetchFarmerSilo,
        ]);

        txToast.success(receipt);

        /// Reset the max Amount In
        const _maxAmountIn = await ConvertFarmStep.getMaxConvert(
          sdk,
          tokenIn,
          tokenOut
        );

        formActions.resetForm({
          values: {
            ...initialValues,
            maxAmountIn: tokenValueToBN(_maxAmountIn),
          },
        });
      } catch (err) {
        console.error(err);
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
      fromToken,
      sdk,
      season,
      account,
      txnBundler,
      middleware,
      plantAndDoX,
      initialValues,
      farmerSilo,
      refetch,
      refetchPools,
      refetchFarmerSilo,
    ]
  );
}

function isPipelineConvert(
  fromToken: ERC20Token,
  toToken: ERC20Token | undefined
) {
  if (!toToken) return false;
  if (fromToken.isLP && toToken.isLP) {
    // Make sure it isn't a lambda convert
    return !fromToken.equals(toToken);
  }
  return false;
}

function useConvertTokenList(
  fromToken: ERC20Token
): [tokenList: ERC20Token[], initialTokenOut: ERC20Token] {
  const { whitelist, tokenMap: whitelistLookup } = useWhitelistedTokens();
  const sdk = useSdk();
  return useMemo(() => {
    const pathSet = new Set<string>(
      sdk.silo.siloConvert.getConversionPaths(fromToken).map((t) => t.address)
    );

    // As of now, we don't include unripe PipelineConverts
    if (!fromToken.isUnripe) {
      whitelist.forEach((toToken) => {
        !toToken.isUnripe && pathSet.add(toToken.address);
      });
    }

    // As of now, remove the fromToken from the list.
    // They can update their deposits via silo/token/updateDeposits
    pathSet.delete(fromToken.address);

    const list = Array.from(pathSet).map((address) => whitelistLookup[address]);
    return [
      list, // all available tokens to convert to
      list?.[0], // tokenOut is the first available token that isn't the fromToken
    ];
  }, [fromToken, sdk, whitelist, whitelistLookup]);
}

// const ConvertPropProvider: FC<{
//   fromToken: ERC20Token;
// }> = ({ fromToken }) => {
//   const sdk = useSdk();

//   /// Token List
//   const [tokenList, initialTokenOut] = useMemo(() => {
//     const paths = sdk.silo.siloConvert.getConversionPaths(fromToken);
//     const _tokenList = paths.filter((_token) => !_token.equals(fromToken));
//     return [
//       _tokenList, // all available tokens to convert to
//       _tokenList?.[0], // tokenOut is the first available token that isn't the fromToken
//     ];
//   }, [sdk, fromToken]);

//   /// Beanstalk
//   const season = useSeason();
//   const [refetchPools] = useFetchPools();

//   /// Farmer
//   const farmerSilo = useFarmerSilo();
//   const farmerSiloBalances = farmerSilo.balances;
//   const account = useAccount();

//   /// Temporary solution. Remove this when we move the site to use the new sdk types.
//   const [farmerBalances, refetchFarmerBalances] = useAsyncMemo(async () => {
//     if (!account) return undefined;
//     console.debug(
//       `[Convert] Fetching silo balances for SILO:${fromToken.symbol}`
//     );
//     return sdk.silo.getBalance(fromToken, account, {
//       source: DataSource.LEDGER,
//     });
//   }, [account, sdk]);

//   /// Form
//   const middleware = useFormMiddleware();
//   const { txnBundler, plantAndDoX, refetch } = useFormTxnContext();
//   const [conversion, setConversion] = useState<ConvertDetails>({
//     actions: [],
//     amount: TokenValue.ZERO,
//     bdv: TokenValue.ZERO,
//     crates: [],
//     seeds: TokenValue.ZERO,
//     stalk: TokenValue.ZERO,
//   });

//   const initialValues: ConvertFormValues = useMemo(
//     () => ({
//       // Settings
//       settings: {
//         slippage: 0.05,
//       },
//       // Token Inputs
//       tokens: [
//         {
//           token: fromToken,
//           amount: undefined,
//           quoting: false,
//           amountOut: undefined,
//         },
//       ],
//       // Convert data
//       maxAmountIn: undefined,
//       // Token Outputs
//       tokenOut: initialTokenOut,
//       farmActions: {
//         preset: fromToken.isLP || fromToken.isUnripe ? 'noPrimary' : 'plant',
//         primary: undefined,
//         secondary: undefined,
//         implied: [FormTxn.MOW],
//       },
//     }),
//     [fromToken, initialTokenOut]
//   );

//   /// Handlers
//   // This handler does not run when _tokenIn = _tokenOut (direct deposit)
//   const handleQuote = useCallback<
//     QuoteHandlerWithParams<ConvertQuoteHandlerParams>
//   >(
//     async (tokenIn, _amountIn, tokenOut, { slippage, isConvertingPlanted }) => {
//       try {
//         if (!farmerBalances?.convertibleDeposits) {
//           throw new Error('No balances found');
//         }
//         const { plantAction } = plantAndDoX;

//         const includePlant = !!(isConvertingPlanted && plantAction);

//         const result = await ConvertFarmStep._handleConversion(
//           sdk,
//           farmerBalances.convertibleDeposits,
//           tokenIn,
//           tokenOut,
//           tokenIn.amount(_amountIn.toString() || '0'),
//           season.toNumber(),
//           slippage,
//           includePlant ? plantAction : undefined
//         );

//         setConversion(result.conversion);

//         return tokenValueToBN(result.minAmountOut);
//       } catch (e) {
//         console.debug('[Convert/handleQuote]: FAILED: ', e);
//         return new BigNumber('0');
//       }
//     },
//     [farmerBalances?.convertibleDeposits, sdk, season, plantAndDoX]
//   );

//   const onSubmit = useCallback(
//     async (
//       values: ConvertFormValues,
//       formActions: FormikHelpers<ConvertFormValues>
//     ) => {
//       let txToast;
//       try {
//         middleware.before();

//         /// FormData
//         const slippage = values?.settings?.slippage;
//         const tokenIn = values.tokens[0].token;
//         const tokenOut = values.tokenOut;
//         const _amountIn = values.tokens[0].amount;

//         /// Validation
//         if (!account) throw new Error('Wallet connection required');
//         if (!slippage) throw new Error('No slippage value set.');
//         if (!tokenOut) throw new Error('Conversion pathway not set');
//         if (!farmerBalances) throw new Error('No balances found');

//         txToast = new TransactionToast({
//           loading: 'Converting...',
//           success: 'Convert successful.',
//         });

//         let txn;

//         const { plantAction } = plantAndDoX;

//         const amountIn = tokenIn.amount(_amountIn?.toString() || '0'); // amount of from token
//         const isPlanting =
//           plantAndDoX && values.farmActions.primary?.includes(FormTxn.PLANT);

//         const convertTxn = new ConvertFarmStep(
//           sdk,
//           tokenIn,
//           tokenOut,
//           season.toNumber(),
//           farmerBalances.convertibleDeposits
//         );

//         const { getEncoded, minAmountOut } = await convertTxn.handleConversion(
//           amountIn,
//           slippage,
//           isPlanting ? plantAction : undefined
//         );

//         convertTxn.build(getEncoded, minAmountOut);
//         const actionsPerformed = txnBundler.setFarmSteps(values.farmActions);

//         if (!isPlanting) {
//           const { execute } = await txnBundler.bundle(
//             convertTxn,
//             amountIn,
//             slippage,
//             1.2
//           );

//           txn = await execute();
//         } else {
//           // Create Advanced Farm operation for alt-route Converts
//           const farm = sdk.farm.createAdvancedFarm('Alternative Convert');

//           // Get Earned Beans data
//           const stemTips = await sdk.silo.getStemTip(tokenIn);
//           const earnedBeans = await sdk.silo.getEarnedBeans(account);
//           const earnedStem = stemTips.toString();
//           const earnedAmount = earnedBeans.toBlockchain();

//           // Plant
//           farm.add(new sdk.farm.actions.Plant());

//           // Withdraw Planted deposit crate
//           farm.add(
//             new sdk.farm.actions.WithdrawDeposit(
//               tokenIn.address,
//               earnedStem,
//               earnedAmount,
//               FarmToMode.INTERNAL
//             )
//           );

//           // Transfer to Well
//           farm.add(
//             new sdk.farm.actions.TransferToken(
//               tokenIn.address,
//               sdk.pools.BEAN_ETH_WELL.address,
//               FarmFromMode.INTERNAL,
//               FarmToMode.EXTERNAL
//             )
//           );

//           // Create Pipeline operation
//           const pipe = sdk.farm.createAdvancedPipe('pipelineDeposit');

//           // (Pipeline) - Call sync on Well
//           pipe.add(
//             new sdk.farm.actions.WellSync(
//               sdk.pools.BEAN_ETH_WELL,
//               tokenIn,
//               sdk.contracts.pipeline.address
//             ),
//             { tag: 'amountToDeposit' }
//           );

//           // (Pipeline) - Approve transfer of sync output
//           const approveClipboard = {
//             tag: 'amountToDeposit',
//             copySlot: 0,
//             pasteSlot: 1,
//           };
//           pipe.add(
//             new sdk.farm.actions.ApproveERC20(
//               sdk.pools.BEAN_ETH_WELL.lpToken,
//               sdk.contracts.beanstalk.address,
//               approveClipboard
//             )
//           );

//           // (Pipeline) - Transfer sync output to Beanstalk
//           const transferClipboard = {
//             tag: 'amountToDeposit',
//             copySlot: 0,
//             pasteSlot: 2,
//           };
//           pipe.add(
//             new sdk.farm.actions.TransferToken(
//               sdk.tokens.BEAN_ETH_WELL_LP.address,
//               account,
//               FarmFromMode.EXTERNAL,
//               FarmToMode.INTERNAL,
//               transferClipboard
//             )
//           );

//           // Add Pipeline operation to the Advanced Pipe operation
//           farm.add(pipe);

//           // Deposit Advanced Pipe output to Silo
//           farm.add(
//             new sdk.farm.actions.Deposit(
//               sdk.tokens.BEAN_ETH_WELL_LP,
//               FarmFromMode.INTERNAL
//             )
//           );

//           // Convert the other Deposits as usual
//           if (amountIn.gt(0)) {
//             const convertData = sdk.silo.siloConvert.calculateConvert(
//               tokenIn,
//               tokenOut,
//               amountIn,
//               farmerBalances.convertibleDeposits,
//               season.toNumber()
//             );
//             const amountOut = await sdk.contracts.beanstalk.getAmountOut(
//               tokenIn.address,
//               tokenOut.address,
//               convertData.amount.toBlockchain()
//             );
//             const _minAmountOut = TokenValue.fromBlockchain(
//               amountOut.toString(),
//               tokenOut.decimals
//             ).mul(1 - slippage);
//             farm.add(
//               new sdk.farm.actions.Convert(
//                 sdk.tokens.BEAN,
//                 sdk.tokens.BEAN_ETH_WELL_LP,
//                 amountIn,
//                 _minAmountOut,
//                 convertData.crates
//               )
//             );
//           }

//           // Mow Grown Stalk
//           const tokensWithStalk: Map<Token, TokenValue> = new Map();
//           farmerSilo.stalk.grownByToken.forEach((value, token) => {
//             if (value.gt(0)) {
//               tokensWithStalk.set(token, value);
//             }
//           });
//           if (tokensWithStalk.size > 0) {
//             farm.add(new sdk.farm.actions.Mow(account, tokensWithStalk));
//           }

//           const gasEstimate = await farm.estimateGas(earnedBeans, {
//             slippage: slippage,
//           });
//           const adjustedGas = Math.round(
//             gasEstimate.toNumber() * 1.2
//           ).toString();
//           txn = await farm.execute(
//             earnedBeans,
//             { slippage: slippage },
//             { gasLimit: adjustedGas }
//           );
//         }

//         txToast.confirming(txn);

//         const receipt = await txn.wait();

//         await refetch(actionsPerformed, { farmerSilo: true }, [
//           refetchPools, // update prices to account for pool conversion
//           refetchFarmerBalances,
//         ]);

//         txToast.success(receipt);

//         /// Reset the max Amount In
//         const _maxAmountIn = await ConvertFarmStep.getMaxConvert(
//           sdk,
//           tokenIn,
//           tokenOut
//         );

//         formActions.resetForm({
//           values: {
//             ...initialValues,
//             maxAmountIn: tokenValueToBN(_maxAmountIn),
//           },
//         });
//       } catch (err) {
//         console.error(err);
//         if (txToast) {
//           txToast.error(err);
//         } else {
//           const errorToast = new TransactionToast({});
//           errorToast.error(err);
//         }
//         formActions.setSubmitting(false);
//       }
//     },
//     [
//       sdk,
//       season,
//       account,
//       txnBundler,
//       middleware,
//       plantAndDoX,
//       initialValues,
//       farmerBalances,
//       farmerSilo,
//       refetch,
//       refetchPools,
//       refetchFarmerBalances,
//     ]
//   );

//   return (
//     <Formik initialValues={initialValues} onSubmit={onSubmit}>
//       {(formikProps) => (
//         <>
//           <TxnSettings placement="form-top-right">
//             <SettingInput
//               name="settings.slippage"
//               label="Slippage Tolerance"
//               endAdornment="%"
//             />
//           </TxnSettings>
//           <ConvertForm
//             handleQuote={handleQuote}
//             tokenList={tokenList as (ERC20Token | NativeToken)[]}
//             siloBalances={farmerSiloBalances}
//             currentSeason={season}
//             sdk={sdk}
//             conversion={conversion}
//             plantAndDoX={plantAndDoX}
//             {...formikProps}
//           />
//         </>
//       )}
//     </Formik>
//   );
// };
