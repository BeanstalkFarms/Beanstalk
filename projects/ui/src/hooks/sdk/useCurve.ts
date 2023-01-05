import { useEffect, useState } from 'react';
import curve, { initCurve } from '~/util/Curve';
import useChainId from '../chain/useChainId';

// class DebugProvider extends ethers.providers.ExternalProvider {
//   readonly provider: ethers.providers.BaseProvider;

//   constructor(provider: ethers.providers.BaseProvider) {
//     super(provider.getNetwork());
//     this.provider = provider;
//   }

//   // This should return a Promise (and may throw errors)
//   // method is the method name (e.g. getBalance) and params is an
//   // object with normalized values passed in, depending on the method
//   // perform(method: string, params: any): Promise<any> {
//   //   return this.provider.perform(method, params).then((result: any) => {
//   //     console.log('DEBUG', method, params, '=>', result);
//   //     return result;
//   //   }, (error: any) => {
//   //     console.log('DEBUG:ERROR', method, params, '=>', error);
//   //     throw error;
//   //   });
//   // }
// }

export default function useCurve() {
  const [_curve, setCurve] = useState<typeof curve | null>(null);
  const [initializing] = useState(false);
  const chainId = useChainId();
  
  useEffect(() => {
    if (chainId) {
      setCurve(null);
      // setInitializing(true);
      console.debug('[curve/use] initializing: ', chainId);
      initCurve(chainId)
        .then((c) => {
          console.debug('[curve/use] initialized: ', c);
          setCurve(c);
        })
        .catch((e) => {
          console.error('[curve/use]', e);
        });
    }
  }, [
    chainId,
    initializing,
  ]);
  
  return _curve;

  // return new Promise<typeof curve>((resolve, reject) => {
  //   if (_curve) {
  //     resolve(_curve);
  //   } else {
  //     resolve(initCurve(chainId));
  //   }
  // });

  // return []
}
