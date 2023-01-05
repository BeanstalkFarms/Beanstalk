import BigNumber from 'bignumber.js';

export type BeanPoolState = {
  /**
   * The current exchange rate between assets in the Pool.
   * 
   * ```solidity
   * // Example: Uniswap
   * function getUniswapPrice(
   *    uint256[2] memory reserves,
   *    uint256[2] memory pegReserves
   * ) private pure returns (uint256[2] memory prices) {
   *    prices[1] = uint256(pegReserves[0]).mul(1e18).div(pegReserves[1]);  // ETH
   *    prices[0] = reserves[1].mul(prices[1]).div(reserves[0]).div(1e12);  // BEAN
   * }
   * ```
   */
  price: BigNumber;

  /**
   * The amount of underlying ('reserve') tokens in the Pool.
   * Typically a tuple, but can be higher (3pool for example).
   */
  reserves: BigNumber[];

  /**
   * The difference between the actual number of
   * Beans and the desired number of Beans in a Pool.
   * 
   * ```solidity
   * // Example: Uniswap
   * function getUniswapDeltaB(
   *    uint256[2] memory reserves,
   *    uint256[2] memory pegReserves
   * ) private pure returns (int256) {
   *    uint256 newBeans = sqrt(reserves[1].mul(reserves[0]).mul(pegReserves[0]).div(pegReserves[1]));
   *    return int256(newBeans) - int256(reserves[0]);
   * }
   * ```
   * 
   * Think of this as the change in Bean supply that Beanstalk
   * wants in order to return to Peg. If the number is negative,
   * Beanstalk wants to reduce supply by `deltaB`. If the number
   * is positive, Beanstalk wants to mint `deltaB` more Beans.
   * 
   * deltaB < 0   ->   excess Beans; need to remove `deltaB` to return to peg
   * deltaB = 0   ->   at peg. no action taken.
   * deltaB > 0   ->   need more Beans; need to mint `deltaB` to return to peg
   */
  deltaB: BigNumber;

  /**
   * The total USD value of the assets in the Pool.
   */
  liquidity: BigNumber;
  
  /**
   * The total supply of the Pool's LP token.
   */
  supply: BigNumber;
}

export type BeanPools = { 
  [address: string]: BeanPoolState 
}
