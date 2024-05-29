const { defaultAbiCoder } = require("@ethersproject/abi");

const ConvertKind = {
  DEPRECATED_0: 0,
  DEPRECATED_1: 1,
  UNRIPE_BEANS_TO_LP: 2,
  UNRIPE_LP_TO_BEANS: 3,
  LAMBDA_LAMBDA: 4,
  BEANS_TO_WELL_LP: 5,
  WELL_LP_TO_BEANS: 6,
  UNRIPE_TO_RIPE: 7
};

class ConvertEncoder {
  /**
   * Cannot be constructed.
   */
  constructor() {
    // eslint-disable-next-line @javascript-eslint/no-empty-function
  }
  
  static convertUnripeLPToBeans = (lp, minBeans) =>
    defaultAbiCoder.encode(
      ["uint256", "uint256", "uint256"],
      [ConvertKind.UNRIPE_LP_TO_BEANS, lp, minBeans]
    );

  static convertUnripeBeansToLP = (beans, minLP) =>
    defaultAbiCoder.encode(
      ["uint256", "uint256", "uint256"],
      [ConvertKind.UNRIPE_BEANS_TO_LP, beans, minLP]
    );

  static convertLambdaToLambda = (amount, token) =>
    defaultAbiCoder.encode(
      ["uint256", "uint256", "address"],
      [ConvertKind.LAMBDA_LAMBDA, amount, token]
    );

  static convertWellLPToBeans = (lp, minBeans, address) =>
    defaultAbiCoder.encode(
      ["uint256", "uint256", "uint256", "address"],
      [ConvertKind.WELL_LP_TO_BEANS, lp, minBeans, address]
    );

  static convertBeansToWellLP = (beans, minLP, address) =>
    defaultAbiCoder.encode(
      ["uint256", "uint256", "uint256", "address"],
      [ConvertKind.BEANS_TO_WELL_LP, beans, minLP, address]
    );

  /**
   * Encodes the userData parameter for performing an Unripe-->Ripe convert
   * @param unripeAmount - the amount of unripe beans to be converted
   * @param unripeToken - the address of the unripe asset
   */
  static convertUnripeToRipe = (unripeAmount, unripeToken) =>
    defaultAbiCoder.encode(
      ["uint256", "uint256", "address"],
      [ConvertKind.UNRIPE_TO_RIPE, unripeAmount, unripeToken]
    );
}

exports.ConvertEncoder = ConvertEncoder;
