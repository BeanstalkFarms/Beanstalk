// import BigNumber from 'bignumber.js';

import { ethers } from 'ethers';
import Farm from './Farm';

// ----------------------------------------------------------------------

const ETH_PRICE = 1300; // 1000 BEAN / ETH
const withinPriceRange = (
  value:    ethers.BigNumber,
  expected: [
    value:    number,
    decimals: number,
  ],
  range:    number = 0.1
  ) => {
  const dec  = expected[1];
  const low  = (expected[0] * (1 - range)).toFixed(dec);
  const high = (expected[0] * (1 + range)).toFixed(dec);
  const tru  = (
    value.gte(ethers.utils.parseUnits(low,  dec)) &&
    value.lte(ethers.utils.parseUnits(high, dec))
  );
  // if (!tru) {
  //   console.error(`failed withinPriceRange: [${low.toString()} <= ${ethers.utils.formatUnits(value, expected[1])} <= ${high.toString()}]`);
  // }
  return tru;
};

// ----------------------------------------------------------------------

describe('utilities', () => {
  describe('range', () => {
    const value = ethers.utils.parseUnits('1', 18); // 1 * 10**18
    it('handles numbers within the range', () => {
      expect(withinPriceRange(value, [1, 18])).toBe(true);
    });
    it('handles numbers outside the range', () => {
      expect(withinPriceRange(value, [0.5, 18])).toBe(false);
    });
  });
  describe('slippage', () => {
    const oneBean    = ethers.BigNumber.from(1_000_000); // 1 BEAN
    const billyBeans = ethers.BigNumber.from(1_000_000_000_000_000); // 1,000,000,000 BEAN
    it('returns input for zero slippage', () => {
      const out = Farm.slip(oneBean, 0);
      expect(out.toString()).toEqual('1000000');
    });
    it('calculates a standard 0.1% slippage on 1 BEAN', () => {
      const out = Farm.slip(oneBean, 0.001); // 0.1%
      expect(out.toString()).toEqual('999000'); // 0.999 BEAN
    });
    it('calculates a standard 0.1% slippage on 1 BEAN', () => {
      const out = Farm.slip(oneBean, 0.001); // 0.1%
      expect(out.toString()).toEqual('999000'); // 0.999 BEAN
    });
    it('calculates a standard 0.1% slippage on 1,000,000,000 BEAN', () => {
      const out = Farm.slip(billyBeans, 0.001); // 0.1%
      expect(out.toString()).toEqual('999000000000000'); // 999,000,000 BEAN
    });
    /// FIXME: test cases for very small inputs
  });
  describe('direction', () => {
    it('orders forward', () => {
      expect(Farm.direction(1, 2, true)).toEqual([1, 2]);
    });
    it('orders backward', () => {
      expect(Farm.direction(1, 2, false)).toEqual([2, 1]);
    });
  });
});

// ----------------------------------------------------------------------

describe('estimation', () => {
  /// NOTE: requires replanted beanstalk
  const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545', {
    chainId: 1337,
    name: 'Localhost'
  });
  const farm = new Farm(provider);

  it('estimates: 1 ETH -> X BEAN', async () => {
    const result = await Farm.estimate(farm.buyBeans(), [ethers.utils.parseUnits('1', 18)]); //
    console.log(`1 ETH -> X BEAN: ${ethers.utils.formatUnits(result.amountOut, 6)}`); // 1000306788
    expect(withinPriceRange(result.amountOut, [ETH_PRICE, 6], 0.1)).toBe(true); // 10% of ETH_PRICE
    expect(result.steps.length).toBe(2);  /// only when hardcoded thru tricrypto2
  });

  it('estimates: X ETH <- 1000 BEAN', async () => {
    const result = await Farm.estimate(farm.buyBeans(), [ethers.utils.parseUnits('1000', 6)], false); //
    console.log(`X ETH <- 1000 BEAN: ${ethers.utils.formatUnits(result.amountOut, 18)}`); // 997470693756958276
    expect(withinPriceRange(result.amountOut, [1000 / ETH_PRICE, 18], 0.1)).toBe(true); // 10% of ETH_PRICE/1000
    expect(result.steps.length).toBe(2);  /// only when hardcoded thru tricrypto2
  });
});
