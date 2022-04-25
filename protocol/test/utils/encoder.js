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
   * @param lp - the amount of Uniswap lp to be removed
   * @param minBeans - min amount of beans to receive
   */
  static convertUniswapLPToBeans = (lp, minBeans) =>
    defaultAbiCoder.encode(
      ['uint256', 'uint256', 'uint256'],
      [ConvertKind.UNISWAP_LP_TO_BEANS, lp, minBeans]
    );

  /**
   * Encodes the userData parameter for removing BEAN/ETH lp, then converting that Bean to LP using Uniswap Pool
   * @param beans - amount of beans to convert to Uniswap LP
   * @param minLP - min amount of Uniswap LP to receive
   */
   static convertBeansToUniswapLP = (beans, minLP) =>
    defaultAbiCoder.encode(
     ['uint256', 'uint256', 'uint256'],
     [ConvertKind.BEANS_TO_UNISWAP_LP, beans, minLP]
   );

     /**
   * Encodes the userData parameter for removing a set amount of LP for beans using Curve Pool
   * @param lp - the amount of Curve lp to be removed
   * @param minBeans - min amount of beans to receive
   * @param address - the address of the token converting into
   */
  static convertCurveLPToBeans = (lp, minBeans, address) =>
  defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'address'],
    [ConvertKind.CURVE_LP_TO_BEANS, lp, minBeans, address]
  );

// Sell to Peg functions

/**
 * Encodes the userData parameter for removing BEAN/ETH lp, then converting that Bean to LP using Curve Pool
 * @param beans - amount of beans to convert to Curve LP
 * @param minLP - min amount of Curve LP to receive
   * @param address - the address of the token converting into
 */
static convertBeansToCurveLP = (beans, minLP, address) =>
  defaultAbiCoder.encode(
  ['uint256', 'uint256', 'uint256', 'address'],
  [ConvertKind.BEANS_TO_CURVE_LP, beans, minLP, address]
);

}

exports.ConvertEncoder = ConvertEncoder