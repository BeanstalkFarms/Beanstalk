import { ContractFunctionParameters, MulticallReturnType } from 'viem';

type MulticallResultParams<
  T extends
    readonly ContractFunctionParameters[] = ContractFunctionParameters[],
> = T;

export type MulticallResult<AllowFail extends boolean = true> =
  MulticallReturnType<MulticallResultParams, AllowFail>;

export const getExtractMulticallResult =
  (context: string) =>
  <V = bigint>(result: MulticallResult[number], fnName?: string): V | null => {
    if (result.error && fnName) {
      const functionName = fnName ? `: ${fnName}()` : '';
      const ctx = context.startsWith('[') ? context : `[${context}]`;
      console.debug(`${ctx}${functionName}: FAILED: `, result.error);
      return null;
    }
    return result.result as V;
  };

/**
 * Extracts a result from a multicall.
 * @param result - The result of a multicall.
 * @param fnName - The name of the function that was called.
 * @returns The result of the multicall.
 */
export const extractMulticallResult = <V = bigint>(
  result: MulticallResult[number],
  fnName?: string
): V | null => {
  if (result.error && fnName) {
    console.debug(`${fnName} FAILED: `, result.error);
    return null;
  }
  return result.result as V;
};

export const extractMultiCallResultWithThrow = <V = bigint>(
  result: MulticallResult[number],
  fnName?: string
): V => {
  if (result.error && fnName) {
    throw new Error(`${fnName} FAILED: ${result.error}`);
  }

  return result.result as V;
};
