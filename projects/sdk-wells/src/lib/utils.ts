import { ERC20Token, Token, TokenValue } from "@beanstalk/sdk-core";
import { ethers } from "ethers";
import { WellsSDK } from "./WellsSDK";

export const loadToken = async (sdk: WellsSDK, address: string): Promise<ERC20Token> => {
  // First see this is a built in token provided by the SDK
  let token = sdk.tokens.findByAddress(address) as ERC20Token;

  // Otherwise build a Token instance from the address
  if (!token) {
    token = new ERC20Token(sdk.chainId, address, undefined, undefined, undefined, sdk.provider);
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

export const validateAddress = (address: string, name: string) => {
  if (!ethers.utils.isAddress(address)) {
    throw new Error(`${name} is not a valid address`);
  }
};

export const setReadOnly = (obj: any, prop: string, value: any, visible?: boolean) => {
  Object.defineProperty(obj, prop, {
    value,
    writable: false,
    configurable: false,
    enumerable: visible ?? true
  });
};
