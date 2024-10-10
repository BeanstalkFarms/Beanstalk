import { useCallback, useState } from 'react';
import { FarmToMode } from '@beanstalk/sdk';
import TransactionToast from '~/components/Common/TxnToast';
import { useFetchFarmerField } from '~/state/farmer/field/updater';
import { BEAN, PODS } from '~/constants/tokens';
import { useFetchFarmerBalances } from '~/state/farmer/balances/updater';
import { PodOrder } from '~/state/farmer/market';
import { useSigner } from '~/hooks/ledger/useSigner';
import useAccount from '~/hooks/ledger/useAccount';
import { useFetchFarmerMarketItems } from '~/hooks/farmer/market/useFarmerMarket2';
import useChainConstant from '../../chain/useChainConstant';
import useFormMiddleware from '../../ledger/useFormMiddleware';
import { useBeanstalkContract } from '../../ledger/useContract';

export default function useFarmerMarketCancelTxn() {
  /// Helpers
  const Bean = useChainConstant(BEAN);

  /// Local state
  const [loading, setLoading] = useState(false);

  /// Ledger
  const account = useAccount();
  const { data: signer } = useSigner();
  const beanstalk = useBeanstalkContract(signer);

  /// Farmer
  const [refetchFarmerField] = useFetchFarmerField();
  const [refetchFarmerBalances] = useFetchFarmerBalances();
  // const [refetchFarmerMarket] = useFetchFarmerMarket();
  const { fetch: refetchFarmerMarketItems } = useFetchFarmerMarketItems();

  /// Form
  const middleware = useFormMiddleware();

  const cancelListing = useCallback(
    (listingId: string) => {
      (async () => {
        const txToast = new TransactionToast({
          loading: 'Cancelling Pod Listing...',
          success: 'Cancellation successful.',
        });

        try {
          setLoading(true);
          middleware.before();

          const txn = await beanstalk.cancelPodListing('0', listingId);
          txToast.confirming(txn);

          const receipt = await txn.wait();
          await Promise.all([refetchFarmerField(), refetchFarmerMarketItems()]);
          txToast.success(receipt);
        } catch (err) {
          txToast.error(err);
          console.error(err);
        } finally {
          setLoading(false);
        }
      })();
    },
    [beanstalk, middleware, refetchFarmerField, refetchFarmerMarketItems]
  );

  const cancelOrder = useCallback(
    (order: PodOrder, destination: FarmToMode, before?: () => void) => {
      (async () => {
        const txToast = new TransactionToast({
          loading: 'Cancelling Pod Order',
          success: 'Cancellation successful.',
        });
        try {
          if (!account) throw new Error('Connect a wallet first.');

          setLoading(true);
          middleware.before();
          before?.();

          const params = [
            Bean.stringify(order.pricePerPod),
            Bean.stringify(order.maxPlaceInLine),
            PODS.stringify(order.minFillAmount || 0),
          ] as const;

          console.debug('Canceling order: ', [account, ...params]);

          // Check: Verify these params actually hash to an on-chain order
          // This prevents invalid orders from getting cancelled and emitting
          // a bogus PodOrderCancelled event.
          const verify = await beanstalk.getPodOrder(order.id);
          if (!verify || verify.eq(0)) throw new Error('Order not found');

          const txn = await beanstalk.cancelPodOrder(
            {
              orderer: account,
              fieldId: '0',
              pricePerPod: Bean.stringify(order.pricePerPod),
              maxPlaceInLine: Bean.stringify(order.maxPlaceInLine),
              minFillAmount: PODS.stringify(order.minFillAmount || 0),
            },
            destination
          );
          txToast.confirming(txn);

          const receipt = await txn.wait();
          await Promise.all([
            refetchFarmerMarketItems(), // clear old pod order
            refetchFarmerBalances(), // refresh Beans
          ]);
          txToast.success(receipt);
          // navigate('/market/account');
        } catch (err) {
          console.error(err);
          txToast.error(err);
        } finally {
          setLoading(false);
        }
      })();
    },
    [
      account,
      middleware,
      Bean,
      beanstalk,
      refetchFarmerMarketItems,
      refetchFarmerBalances,
    ]
  );

  return {
    loading,
    cancelListing,
    cancelOrder,
  };
}
