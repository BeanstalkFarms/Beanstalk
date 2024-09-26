import { defaultAbiCoder } from "ethers/lib/utils";

export enum ConvertKind {
  BEANS_TO_CURVE_LP = 0, // deprecated
  CURVE_LP_TO_BEANS = 1, // deprecated
  UNRIPE_BEANS_TO_LP = 2,
  UNRIPE_LP_TO_BEANS = 3,
  LAMBDA_LAMBDA = 4,
  BEANS_TO_WELL_LP = 5,
  WELL_LP_TO_BEANS = 6,
  UNRIPE_TO_RIPE = 7,
  ANTI_LAMBDA_LAMBDA = 8
}

export class ConvertEncoder {
  /**
   * @deprecated
   */
  static curveLPToBeans = (amountLP: string, minBeans: string, pool: string) =>
    defaultAbiCoder.encode(
      ["uint256", "uint256", "uint256", "address"],
      [ConvertKind.CURVE_LP_TO_BEANS, amountLP, minBeans, pool]
    );

  /**
   * @deprecated
   */
  static beansToCurveLP = (amountBeans: string, minLP: string, pool: string) =>
    defaultAbiCoder.encode(
      ["uint256", "uint256", "uint256", "address"],
      [ConvertKind.BEANS_TO_CURVE_LP, amountBeans, minLP, pool]
    );

  static unripeLPToBeans = (amountLP: string, minBeans: string) =>
    defaultAbiCoder.encode(
      ["uint256", "uint256", "uint256"],
      [ConvertKind.UNRIPE_LP_TO_BEANS, amountLP, minBeans]
    );

  static unripeBeansToLP = (amountBeans: string, minLP: string) =>
    defaultAbiCoder.encode(
      ["uint256", "uint256", "uint256"],
      [ConvertKind.UNRIPE_BEANS_TO_LP, amountBeans, minLP]
    );

  static beansToWellLP = (amountBeans: string, minLP: string, pool: string) =>
    defaultAbiCoder.encode(
      ["uint256", "uint256", "uint256", "address"],
      [ConvertKind.BEANS_TO_WELL_LP, amountBeans, minLP, pool]
    );

  static wellLPToBeans = (amountLP: string, minBeans: string, pool: string) =>
    defaultAbiCoder.encode(
      ["uint256", "uint256", "uint256", "address"],
      [ConvertKind.WELL_LP_TO_BEANS, amountLP, minBeans, pool]
    );

  static unripeToRipe = (unripeAmount: string, unripeToken: string) =>
    defaultAbiCoder.encode(
      ["uint256", "uint256", "uint256"],
      [ConvertKind.UNRIPE_TO_RIPE, unripeAmount, unripeToken]
    );

  static lambdaLambda = (amount: string, token: string) =>
    defaultAbiCoder.encode(
      ["uint256", "uint256", "address"],
      [ConvertKind.LAMBDA_LAMBDA, amount, token]
    );

  static antiLambda = (amount: string, token: string, account: string) =>
    defaultAbiCoder.encode(
      ["uint256", "uint256", "address", "address", "bool"],
      [ConvertKind.ANTI_LAMBDA_LAMBDA, amount, token, account, true]
    );
}
