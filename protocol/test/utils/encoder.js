const { defaultAbiCoder } = require('@ethersproject/abi');

const ConvertKind = {
  BEANS_TO_UNISWAP_LP: 0,
  UNISWAP_LP_TO_BEANS: 1,
  BEANS_TO_CURVE_LP: 2,
  CURVE_LP_TO_BEANS: 3,
  UNISWAP_BUY_TO_PEG_AND_CURVE_SELL_TO_PEG: 4,
  CURVE_BUY_TO_PEG_AND_UNISWAP_SELL_TO_PEG: 5
}

class ConvertEncoder {
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
  static convertUniswapLPToBeans = (lp, minBeans) =>
    defaultAbiCoder.encode(
      ['uint256', 'uint256', 'uint256'],
      [ConvertKind.UNISWAP_LP_TO_BEANS, lp, minBeans]
    );

  /**
   * Encodes the userData parameter for removing a set amount of LP for beans using Curve Pool
   * @param lp - the amount of lp to be removed
   * @param minBeans - the index of the token to be provided as liquidity
   */
  static convertCurveLPToBeans = (lp, minBeans) =>
    defaultAbiCoder.encode(
      ['uint256', 'uint256'],
      [ConvertKind.CURVE_LP_TO_BEANS, lp, minBeans]
    );

  // Sell to Peg functions

  /**
   * Encodes the userData parameter for removing BEAN/ETH lp, then converting that Bean to LP using Curve Pool
   * @param beans - the amount of lp to be removed
   * @param minLP - the index of the token to be provided as liquidity
   */
  static convertBeansToCurveLP = (beans, minLP) =>
    defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256'],
    [ConvertKind.BEANS_TO_CURVE_LP, beans, minLP]
  );

  /**
   * Encodes the userData parameter for removing BEAN/ETH lp, then converting that Bean to LP using Uniswap Pool
   * @param beans - the amount of lp to be removed
   * @param minLP - the index of the token to be provided as liquidity
   */
   static convertBeansToUniswapLP = (beans, minLP) =>
    defaultAbiCoder.encode(
     ['uint256', 'uint256', 'uint256'],
     [ConvertKind.BEANS_TO_UNISWAP_LP, beans, minLP]
   );
}

exports.ConvertEncoder = ConvertEncoder