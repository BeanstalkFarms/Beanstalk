import { defaultAbiCoder } from 'ethers/lib/utils';

export enum ConvertKind {
  BEANS_TO_CURVE_LP   = 0,
  CURVE_LP_TO_BEANS   = 1,
  UNRIPE_BEANS_TO_LP  = 2,
  UNRIPE_LP_TO_BEANS  = 3,
}

export class ConvertEncoder {
  static curveLPToBeans = (amountLP: string, minBeans: string, pool: string) =>
    defaultAbiCoder.encode(
      ['uint256', 'uint256', 'uint256', 'address'],
      [ConvertKind.CURVE_LP_TO_BEANS, amountLP, minBeans, pool]
    );

  static beansToCurveLP = (amountBeans: string, minLP: string, pool: string) =>
    defaultAbiCoder.encode(
      ['uint256', 'uint256', 'uint256', 'address'],
      [ConvertKind.BEANS_TO_CURVE_LP, amountBeans, minLP, pool]
    );

  static unripeLPToBeans = (amountLP: string, minBeans: string) =>
    defaultAbiCoder.encode(
      ['uint256', 'uint256', 'uint256'],
      [ConvertKind.UNRIPE_LP_TO_BEANS, amountLP, minBeans]
    );

  static unripeBeansToLP = (amountBeans: string, minLP: string) =>
    defaultAbiCoder.encode(
      ['uint256', 'uint256', 'uint256'],
      [ConvertKind.UNRIPE_BEANS_TO_LP, amountBeans, minLP]
    );
}
