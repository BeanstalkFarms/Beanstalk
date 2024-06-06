import { BeanstalkSDK, ERC20Token } from "@beanstalk/sdk";
import { Aquifer, WellFunction, Pump } from "@beanstalk/sdk-wells";

import { getBytesHexString } from "src/utils/bytes";

/**
 * Prepare the parameters for a Aquifer.boreWell call
 */
const prepareBoreWellParameters = async (
  aquifer: Aquifer,
  implementation: string,
  tokens: ERC20Token[], // we assume that these tokens are sorted already
  wellFunction: WellFunction,
  pumps: Pump | Pump[],
  name: string,
  symbol: string,
  salt?: number
) => {
  const immutableData = Aquifer.getEncodedWellImmutableData(
    aquifer.address,
    tokens,
    wellFunction,
    Array.isArray(pumps) ? pumps : [pumps]
  );

  const initFunctionCall = await Aquifer.getEncodedWellInitFunctionData(name, symbol);

  const saltBytes32 = getBytesHexString(salt || 0, 32);

  return [implementation, immutableData, initFunctionCall, saltBytes32] as [
    string,
    Uint8Array,
    Uint8Array,
    string
  ];
};

/**
 * Decode the result of a boreWell wrapped in a advancedPipe callto get the well address
 */
const decodeBoreWellPipeCall = (sdk: BeanstalkSDK, aquifer: Aquifer, pipeResult: string[]) => {
  if (!pipeResult.length) return;
  const pipeDecoded = sdk.contracts.pipeline.interface.decodeFunctionResult(
    "advancedPipe",
    pipeResult[0]
  );

  if (!pipeDecoded?.length || !pipeDecoded[0]?.length) return;
  const boreWellDecoded = aquifer.contract.interface.decodeFunctionResult(
    "boreWell",
    pipeDecoded[0][0]
  );
  if (!boreWellDecoded?.length) return;
  return boreWellDecoded[0] as string;
};

/**
 * Sorts the tokens in the following manner:
 *  - if tokens includes BEAN, BEAN is first
 *  - if tokens includes WETH, WETH is last
 * - otherwise, the token order is preserved
 *
 * this is so that pairs with BEAN are BEAN:X
 * and pairs with WETH are X:WETH
 *
 * TODO: do this with wStETH
 */
const prepareTokenOrderForBoreWell = (sdk: BeanstalkSDK, tokens: ERC20Token[]) => {
  if (tokens.length < 2) {
    throw new Error("2 Tokens are required");
  }

  const wethAddress = sdk.tokens.WETH.address.toLowerCase();
  const beanAddress = sdk.tokens.BEAN.address.toLowerCase();

  return tokens.sort((a, b) => {
    const addressA = a.address.toLowerCase();
    const addressB = b.address.toLowerCase();
    if (addressA === beanAddress || addressB === wethAddress) return -1;
    if (addressB === beanAddress || addressA === wethAddress) return 1;
    return 0;
  });
};

const BoreWellUtils = {
  prepareBoreWellParameters,
  decodeBoreWellPipeCall,
  prepareTokenOrderForBoreWell
};

export default BoreWellUtils;
