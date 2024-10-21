import { NativeToken, ERC20Token, Token } from "src/classes/Token";


export function isERC20Token(token: Token): token is ERC20Token {
  return token instanceof ERC20Token;
}

export function isNativeToken(token: Token): token is NativeToken {
  return isNativeToken(token);
}