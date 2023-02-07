import { Token } from "./Token";
import { TokenValue } from "../TokenValue";

export class NativeToken extends Token {
  public getContract() {
    return null;
  }

  public getBalance(account: string): Promise<TokenValue> {
    return Token.sdk.provider.getBalance(account).then((result) => TokenValue.fromBlockchain(result, this.decimals));
  }

  public getAllowance(): Promise<TokenValue | undefined> {
    return Promise.resolve(TokenValue.MAX_UINT256);
  }

  public hasEnoughAllowance(): boolean {
    return true;
  }

  public getTotalSupply() {
    return undefined;
  }

  public equals(other: NativeToken): boolean {
    return this.chainId === other.chainId;
  }
}
