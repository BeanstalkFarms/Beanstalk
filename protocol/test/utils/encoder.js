const { defaultAbiCoder } = require('@ethersproject/abi');

const ConvertKind = {
  UNISWAP_ADD_LP_IN_BEANS: 0,
  CURVE_ADD_LP_IN_BEANS: 1,
  UNISWAP_ADD_BEANS_IN_LP: 2,
  CURVE_ADD_BEANS_IN_LP: 3,
  UNISWAP_BUY_TO_PEG_AND_CURVE_SELL_TO_PEG: 4,
  CURVE_BUY_TO_PEG_AND_UNISWAP_SELL_TO_PEG: 5
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
  static convertUniswapAddBeansInLP = (lp, minBeans) =>
    defaultAbiCoder.encode(
      ['uint256', 'uint256', 'uint256'],
      [ConvertKind.UNISWAP_ADD_BEANS_IN_LP, lp, minBeans]
    );

  /**
   * Encodes the userData parameter for removing a set amount of LP for beans using Curve Pool
   * @param lp - the amount of lp to be removed
   * @param minBeans - the index of the token to be provided as liquidity
   */
  static convertCurveAddBeansInLP = (lp, minBeans) =>
    defaultAbiCoder.encode(
      ['uint256', 'uint256'],
      [ConvertKind.CURVE_ADD_BEANS_IN_LP, lp, minBeans]
    );

  // Sell to Peg functions

  /**
   * Encodes the userData parameter for removing BEAN/ETH lp, then converting that Bean to LP using Curve Pool
   * @param beans - the amount of lp to be removed
   * @param minLP - the index of the token to be provided as liquidity
   */
  static convertCurveAddLPInBeans = (beans, minLP) =>
    defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256'],
    [ConvertKind.CURVE_ADD_LP_IN_BEANS, beans, minLP]
  );

  /**
   * Encodes the userData parameter for removing BEAN/ETH lp, then converting that Bean to LP using Uniswap Pool
   * @param beans - the amount of lp to be removed
   * @param minLP - the index of the token to be provided as liquidity
   */
   static convertUniswapAddLPInBeans = (beans, minLP) =>
    defaultAbiCoder.encode(
     ['uint256', 'uint256', 'uint256'],
     [ConvertKind.UNISWAP_ADD_LP_IN_BEANS, beans, minLP]
   );
}

exports.GeneralFunctionEncoder = GeneralFunctionEncoder