const { defaultAbiCoder } = require('@ethersproject/abi');

const ConvertKind = {
  BEANS_TO_CURVE_LP: 0,
  CURVE_LP_TO_BEANS: 1,
  UNRIPE_BEANS_TO_LP: 2,
  UNRIPE_LP_TO_BEANS: 3,
  LAMBDA_LAMBDA: 4,
  BEANS_TO_WELL_LP: 5,
  WELL_LP_TO_BEANS: 6
}

class ConvertEncoder {
  /**
   * Cannot be constructed.
   */
  constructor() {
    // eslint-disable-next-line @javascript-eslint/no-empty-function
  }

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

   static convertUnripeLPToBeans = (lp, minBeans) =>
   defaultAbiCoder.encode(
     ['uint256', 'uint256', 'uint256'],
     [ConvertKind.UNRIPE_LP_TO_BEANS, lp, minBeans]
   );
 
   static convertUnripeBeansToLP = (beans, minLP) =>
     defaultAbiCoder.encode(
     ['uint256', 'uint256', 'uint256'],
     [ConvertKind.UNRIPE_BEANS_TO_LP, beans, minLP]
   );

   static convertLambdaToLambda = (amount, token) =>
    defaultAbiCoder.encode(
      ['uint256', 'uint256', 'address'],
      [ConvertKind.LAMBDA_LAMBDA, amount, token]
    );

  static convertWellLPToBeans = (lp, minBeans, address) =>
  defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'address'],
    [ConvertKind.WELL_LP_TO_BEANS, lp, minBeans, address]
  );

  static convertBeansToWellLP = (beans, minLP, address) =>
    defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'address'],
    [ConvertKind.BEANS_TO_WELL_LP, beans, minLP, address]
  );
}

exports.ConvertEncoder = ConvertEncoder