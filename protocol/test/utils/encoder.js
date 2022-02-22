const { defaultAbiCoder } = require('@ethersproject/abi');

const BuyToPegKind = {
  EXACT_UNISWAP_REMOVE_BEAN_AND_ADD_LP: 0,
  EXACT_CURVE_LP_OUT_IN_BEANS: 1
}

const SellToPegKind = {
  EXACT_UNISWAP_SELL_BEANS_AND_ADD_LP: 0,
  EXACT_CURVE_ADD_LP_IN_BEANS: 1
}

class GeneralFunctionEncoder {
  /**
   * Cannot be constructed.
   */
  constructor() {
    // eslint-disable-next-line @javascript-eslint/no-empty-function
  }

  // Buy to Peg Functions

  /**
   * Encodes the userData parameter for removing BEAN/ETH lp, then converting that Bean to LP using Uniswap Pool
   * @param lp - the amount of lp to be removed
   * @param minBeans - the index of the token to be provided as liquidity
   */
  static convertExactUniswapBeansOutInLP = (lp, minBeans) =>
    defaultAbiCoder.encode(
      ['uint256', 'uint256', 'uint256'],
      [BuyToPegKind.EXACT_UNISWAP_REMOVE_BEAN_AND_ADD_LP, lp, minBeans]
    );

  /**
   * Encodes the userData parameter for removing a set amount of LP for beans using Curve Pool
   * @param minLPAmountOut - the amount of LP to be removed
   */
  static convertExactCurveLPOutInBeans = (minLPAmountOut) =>
    defaultAbiCoder.encode(
      ['uint256', 'uint256'],
      [BuyToPegKind.EXACT_CURVE_LP_OUT_IN_BEANS, minLPAmountOut]
    );

  // Sell to Peg functions

  /**
   * Encodes the userData parameter for removing BEAN/ETH lp, then converting that Bean to LP using Uniswap Pool
   * @param beans - the amount of lp to be removed
   * @param minLP - the index of the token to be provided as liquidity
   */
  static convertExactCurveAddLPInBeans = (beans, minLP) =>
  defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256'],
    [SellToPegKind.EXACT_CURVE_ADD_LP_IN_BEANS, beans, minLP]
  );

  /**
   * Encodes the userData parameter for removing BEAN/ETH lp, then converting that Bean to LP using Uniswap Pool
   * @param beans - the amount of lp to be removed
   * @param minLP - the index of the token to be provided as liquidity
   */
   static convertExactUniswapSellBeansAndAddLP = (beans, minLP) =>
   defaultAbiCoder.encode(
     ['uint256', 'uint256', 'uint256'],
     [SellToPegKind.EXACT_UNISWAP_SELL_BEANS_AND_ADD_LP, beans, minLP]
   );
}

exports.GeneralFunctionEncoder = GeneralFunctionEncoder