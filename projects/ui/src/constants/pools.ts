import { CurveMetaPool } from '~/classes/Pool';
import { SupportedChainId } from '~/constants/chains';

import curveLogo from '~/img/dexes/curve-logo.svg';

import { ChainConstant, PoolMap } from '.';
import { BEAN_CRV3_ADDRESSES } from './addresses';
import { BEAN, BEAN_CRV3_LP, CRV3 } from './tokens';

// ------------------------------------
// BEAN:CRV3 Curve MetaPool
// ------------------------------------

export const BEANCRV3_CURVE_MAINNET = new CurveMetaPool(
  SupportedChainId.MAINNET,
  BEAN_CRV3_ADDRESSES,
  BEAN_CRV3_LP,
  [BEAN, CRV3],
  {
    name: 'BEAN:3CRV Pool',
    logo: curveLogo,
    symbol: 'BEAN:3CRV',
    color: '#ed9f9c'
  },
);

// --------------------------------------------------

export const ALL_POOLS: ChainConstant<PoolMap> = {
  [SupportedChainId.MAINNET]: {
    [BEANCRV3_CURVE_MAINNET.address]: BEANCRV3_CURVE_MAINNET,
  },
};

export default ALL_POOLS;
