import { BigNumber } from "ethers";
import { TokenValue } from "@beanstalk/sdk-core";
import { BasinWell } from "src/classes/Pool";
import { ERC20Token } from "src/classes/Token";

export function constructWellQuotePipeCall(
  well: BasinWell,
  sellToken: ERC20Token,
  buyToken: ERC20Token,
  amount: TokenValue,
  direction: "forward" | "reverse"
) {
  const { encodeFunctionData: encode } = well.getContract().interface;

  if (direction === "forward") {
    return encode("getSwapOut", [sellToken.address, buyToken.address, amount.toBlockchain()]);
  }

  return encode("getSwapIn", [sellToken.address, buyToken.address, amount.toBlockchain()]);
}

export function decodeWellQuotePipeCall(
  well: BasinWell,
  result: string,
  direction: "forward" | "reverse"
) {
  const { decodeFunctionResult } = well.getContract().interface;

  const fnName = direction === "forward" ? "getSwapOut" : "getSwapIn";

  try {
    if (direction === "forward") {
      return BigNumber.from(decodeFunctionResult("getSwapOut", result)[0]);
    }
    return BigNumber.from(decodeFunctionResult("getSwapIn", result)[0]);
  } catch (e) {
    console.error(`Error decoding ${fnName} for ${well.name}`, e);
    throw e;
  }
}

export function getWellPairToken(well: BasinWell, token: ERC20Token) {
  if (well.tokens.length !== 2) {
    throw new Error("Cannot determine pair token for well with != 2 tokens");
  }

  if (well.tokens[0].equals(token)) {
    return well.tokens[1];
  }

  return well.tokens[0];
}
