import { ERC20Token, Token, TokenValue } from "@beanstalk/sdk-core";
import { ethers } from "ethers";
import { WellsSDK } from "./WellsSDK";
import { Call } from "src/types";

export const loadToken = async (sdk: WellsSDK, address: string): Promise<ERC20Token> => {
  // First see this is a built in token provided by the SDK
  let token = sdk.tokens.findByAddress(address) as ERC20Token;

  // Otherwise build a Token instance from the address
  if (!token) {
    token = new ERC20Token(sdk.chainId, address, undefined, undefined, undefined, sdk.providerOrSigner);
    await token.loadFromChain();
  }

  return token;
};

export const validateToken = (token: Token, name: string) => {
  if (!(token instanceof ERC20Token)) {
    throw new Error(`${name} is not an instance of ERC20Token`);
  }

  validateAddress(token.address, name);
};

export const validateAmount = (value: TokenValue, name: string) => {
  if (!(value instanceof TokenValue)) {
    throw new Error(`${name} is not an instance of TokenValue`);
  }
  if (value.lte(TokenValue.ZERO)) {
    throw new Error(`${name} must be greater than zero`);
  }
  if (value.gte(TokenValue.MAX_UINT256)) {
    throw new Error(`${name} must be less than MAX_UINT256`);
  }
};

export const validateAtleastOneNonZeroAmount = (values: TokenValue[]) => {
  if (values.length === 0) {
    throw new Error("Must have at least one non-zero amount");
  }
  let atleastOneNonZero = false;
  for (const value of values) {
    if (value.gt(TokenValue.ZERO)) {
      atleastOneNonZero = true;
      break;
    }
  }
  if (!atleastOneNonZero) {
    throw new Error("Must have at least one non-zero amount");
  }
};

export const validateAddress = (address: string, name: string) => {
  if (!ethers.utils.isAddress(address)) {
    throw new Error(`${name} is not a valid address`);
  }
};

export const validateDeadline = (deadline?: number) => {
  if (deadline !== null && deadline !== undefined && deadline <= 0) {
    throw new Error("Deadline must be greater than 0");
  }
};

export const deadlineSecondsToBlockchain = (deadlineSecondsFromNow: number) => {
  const deadlineDate = new Date();
  deadlineDate.setSeconds(deadlineDate.getSeconds() + deadlineSecondsFromNow);
  return deadlineDate.getTime();
};

export const setReadOnly = (obj: any, prop: string, value: any, visible?: boolean) => {
  Object.defineProperty(obj, prop, {
    value,
    writable: false,
    configurable: false,
    enumerable: visible ?? true
  });
};

export function encodeWellImmutableData(_aquifer: string, _tokens: string[], _wellFunction: Call, _pumps: Call[]): Uint8Array {
  let packedPumps: Uint8Array[] = [];
  for (let i = 0; i < _pumps.length; i++) {
    packedPumps.push(
      ethers.utils.arrayify(
        ethers.utils.solidityPack(["address", "uint256", "bytes"], [_pumps[i].target, _pumps[i].data.length, _pumps[i].data])
      )
    );
  }

  const immutableData = ethers.utils.solidityPack(
    ["address", "uint256", "address", "uint256", "uint256", "address[]", "bytes", "bytes"],
    [
      _aquifer,
      _tokens.length,
      _wellFunction.target,
      _wellFunction.data.length,
      _pumps.length,
      _tokens,
      _wellFunction.data,
      ethers.utils.concat(packedPumps)
    ]
  );

  return ethers.utils.arrayify(immutableData);
}

export async function encodeWellInitFunctionCall(name: string, symbol: string): Promise<Uint8Array> {
  const wellInitInterface = new ethers.utils.Interface(["function init(string,string)"]);
  const initFunctionCall = wellInitInterface.encodeFunctionData("init", [name, symbol]);
  return ethers.utils.arrayify(initFunctionCall);
}
