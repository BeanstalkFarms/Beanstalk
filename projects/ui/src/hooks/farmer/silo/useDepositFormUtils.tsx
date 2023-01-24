import { ERC20Token, FarmFromMode, FarmToMode, NativeToken, TokenValue } from '@beanstalk/sdk';
import { FormikHelpers } from 'formik';
import { useCallback, useMemo } from 'react';

import toast from 'react-hot-toast';
import BigNumber from 'bignumber.js';
import { ZERO_BN } from '~/constants';
import { FarmWithClaimFormState, FormStateNew } from '~/components/Common/Form';
import useFormMiddleware from '~/hooks/ledger/useFormMiddleware';
import useSdk from '~/hooks/sdk';
import TransactionToast from '~/components/Common/TxnToast';
import { useFetchPools } from '~/state/bean/pools/updater';
import { useFetchBeanstalkSilo } from '~/state/beanstalk/silo/updater';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import { useFetchFarmerSilo } from '~/state/farmer/silo/updater';
import { parseError } from '~/util';

type DepositFormValues = FormStateNew &
  FarmWithClaimFormState & {
    settings: {
      slippage: number;
    };
  };

enum DepositTxnErr {
  NoSlippage = 'No slippage value set',
  MoreThanOneToken = 'Only one token supported at this time',
  NoAmount = 'Enter an amount to deposit',
  NoTokenIn = 'Deposit Token not found',
  NoTokenOut = 'Whitelisted Silo Token not found',
}

// type asdf = ReturnType<typeof useSdk>[];
// FarmWorkflow<{ slippage: number } & Record<string, any>>

type WorkflowBuilderParams = {
  tokenIn: ERC20Token | NativeToken;
  amountIn: BigNumber;
  tokenOut: ERC20Token | NativeToken;
}

export default function useDepositFormUtils({
  whitelistedTokenAddress,
}: {
  whitelistedTokenAddress: string;
}) {
  const sdk = useSdk();
  const middleware = useFormMiddleware();

  const [refetchFarmerSilo]     = useFetchFarmerSilo();
  const [refetchFarmerBalances] = useFetchFarmerBalances();
  const [refetchPools]          = useFetchPools();
  const [refetchSilo]           = useFetchBeanstalkSilo();

  const refetch = useCallback(async () => {
    await Promise.all([
      refetchFarmerSilo(),
      refetchFarmerBalances(),
      refetchPools(),
      refetchSilo(),
    ]);
  }, [refetchFarmerBalances, refetchFarmerSilo, refetchPools, refetchSilo]);

  const whitelistedToken = useMemo(() => sdk.tokens.findByAddress(whitelistedTokenAddress), [sdk, whitelistedTokenAddress]);

  const onSubmit2 = useCallback(async (
    values: DepositFormValues,
    formActions: FormikHelpers<DepositFormValues>
  ) => {
    try {
      // Check for errors
      middleware.before();
      const formData = values.tokens[0];
      const tokenIn = sdk.tokens.findByAddress(formData.token.address);

      if (!values.settings.slippage) throw new Error(DepositTxnErr.NoSlippage);
      if (values.tokens.length > 1) throw new Error(DepositTxnErr.MoreThanOneToken);
      if (!formData?.amount || formData.amount.eq(0)) throw new Error(DepositTxnErr.NoAmount);
      if (!tokenIn) throw new Error(DepositTxnErr.NoTokenIn);
      // shoud never happen but need to check to unwrap optional
      if (!whitelistedToken) throw new Error(DepositTxnErr.NoTokenOut);
      if (tokenIn !== sdk.tokens.ETH) throw new Error('not ETH');

      const amount = tokenIn.amount(formData.amount.toString());
      console.log(`Depositing ${formData.amount} ${tokenIn.symbol} to ${whitelistedToken.symbol} silo`);

      const account = await sdk.getAccount();

      console.log('building deposit');
      const deposit = await sdk.silo.buildDeposit(whitelistedToken, account);
      deposit.setInputToken(sdk.tokens.ETH);

      // if (tokenIn.equals(sdk.tokens.ETH)) {
      //   deposit.workflow.add(new sdk.farm.actions.WrapEth());
      //   await deposit.buildWorkflow();
      // }

      // console.log('workflowlength: ', deposit.workflow);
  
      // console.log('inputAmount : ', deposit.inputAmount);
      // console.log('input token: ', deposit.inputToken.symbol);
      // console.log('targetToken: ', deposit.targetToken.symbol);

      // deposit.getGraph();

      const estimate = await deposit.estimate(amount);
      console.log('Estimate:', estimate.toHuman());

      // console.log('steps...');
      // const steps = await deposit.workflow.encodeWorkflow();
      
      // console.log('summary...');
      // for (const s of await deposit.getSummary()) {
      //   console.log(s);
      // }

      // console.log('steps: ', steps);
      // console.log('stepslen: ', steps.length);
      
      // formActions.resetForm();
    } catch (err) {
      formActions.setSubmitting(false);
      console.log('err: ', err);
    }
  }, [middleware, sdk, whitelistedToken]);

  const onSubmit = useCallback(
    async (
      values: DepositFormValues,
      formActions: FormikHelpers<DepositFormValues>
    ) => {
      let txToast;
      try {
        // Check for errors
        middleware.before();
        const formData = values.tokens[0];
        const tokenIn = sdk.tokens.findByAddress(formData.token.address);

        if (!values.settings.slippage) throw new Error(DepositTxnErr.NoSlippage);
        if (values.tokens.length > 1) throw new Error(DepositTxnErr.MoreThanOneToken);
        if (!formData?.amount || formData.amount.eq(0)) throw new Error(DepositTxnErr.NoAmount);
        if (!tokenIn) throw new Error(DepositTxnErr.NoTokenIn);
        // shoud never happen but need to check to unwrap optional
        if (!whitelistedToken) throw new Error(DepositTxnErr.NoTokenOut);

        // show toast of approximate deposit amount of whitelisted token
        const whitelistedTokenAmount = tokenIn === whitelistedToken ? formData.amount : (formData.amountOut || ZERO_BN);
        const bdvAmount = await sdk.bean.getBDV(whitelistedToken, TokenValue.fromHuman((whitelistedTokenAmount).toString(), tokenIn.decimals));
        txToast = new TransactionToast({
          loading: `Depositing ${bdvAmount} ${whitelistedToken.name} into the Silo...`,
          success: 'Deposit successful.',
        });

        const workflow = sdk.farm.create();
        const data : string[] = [];
        const value = ZERO_BN;
        // let depositAmount = formData.amount;
        let depositFrom = FarmFromMode.INTERNAL_EXTERNAL;

        if (!tokenIn.equals(whitelistedToken)) {
          // Require a quote
          if (!formData.steps || !formData.amountOut) throw new Error(`No quote available for ${formData.token.symbol}`);

          // Wrap ETH to WETH
          if (tokenIn.equals(sdk.tokens.ETH)) {
            depositFrom = FarmFromMode.INTERNAL_TOLERANT;
            workflow.add([
              new sdk.farm.actions.WrapEth(), // defaults to FarmToMode.INTERNAL
              new sdk.farm.actions.Exchange(
                sdk.contracts.curve.pools.tricrypto2.address,
                sdk.contracts.curve.registries.cryptoFactory.address,
                sdk.tokens.WETH,
                sdk.tokens.USDT
              ),
              new sdk.farm.actions.ExchangeUnderlying(
                sdk.contracts.curve.pools.beanCrv3.address,
                sdk.tokens.USDT,
                sdk.tokens.BEAN,
                undefined, // defaults to INTERNAL_TOLERANT
                FarmToMode.EXTERNAL
              )
            ]);
          }
        }
        workflow.add([
          new sdk.farm.actions.Deposit(
            whitelistedToken,
            depositFrom,
          )
        ]);

        const amountIn = TokenValue.fromHuman(formData.amount.toString(), tokenIn.decimals);

        console.log('amount in: ', amountIn.toHuman());
        console.log('executing...');
        const txn = await workflow.execute(amountIn.toBigNumber(), { slippage: values.settings.slippage / 100 });
        txToast.confirming(txn);
        const receipt = await txn.wait();
        await refetch();

        txToast.success(receipt);
        formActions.resetForm();
        // const workflow = sdk.farm.create();
      } catch (err) {
        txToast ? txToast.error(err) : toast.error(parseError(err));
        formActions.setSubmitting(false);
        console.log('err: ', err);
      }
    },
    [middleware, sdk, whitelistedToken, refetch]
  );

  return { onSubmit, onSubmit2 };
}
