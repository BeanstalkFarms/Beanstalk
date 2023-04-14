import { SupportedChainId } from '~/constants/chains';
import { BEAN, BEAN_CRV3_LP, BEAN_ETH_UNIV2_LP } from '~/constants/tokens';

const m = SupportedChainId.MAINNET;

export const mockLiquidityByToken = {
  [BEAN[m].address]: 10,
  [BEAN_ETH_UNIV2_LP[m].address]: 24,
  [BEAN_CRV3_LP[m].address]: 66,
};

export type LiquidityDatum = {
  label: string;
  value: number;
}

export default Object.keys(mockLiquidityByToken).map((key) => ({
  label: key.substring(0, 6),
  value: mockLiquidityByToken[key],
}));
