import curve from '@curvefi/api';
import { SupportedChainId, TESTNET_RPC_ADDRESSES } from '~/constants';

/**
 * Initialize a new instance of curve-js; load requisite data.
 * @unused will be updated in a future release to support more
 *         complex Curve swaps.
 */
export async function initCurve(chainId : SupportedChainId = 1) {
  // curve.chainId = chainId;
  if (TESTNET_RPC_ADDRESSES[chainId]) {
    console.debug('[curve/init] using JsonRPC');
    await curve.init(
      'JsonRpc',
      { url: TESTNET_RPC_ADDRESSES[chainId] },
      { chainId }
    );
  } else {
    console.debug('[curve/init] using Alchemy');
    await curve.init(
      'Alchemy',
      { apiKey: import.meta.env.VITE_ALCHEMY_API_KEY },
      { chainId }
    );
  }
  console.debug('[curve/init] initialized instance');
  await Promise.all([ 
    curve.fetchFactoryPools(), // chainId === 1
    curve.fetchCryptoFactoryPools(),
  ]);
  console.debug('[curve/init] fetched pools');
  return curve;
}

export default curve;
