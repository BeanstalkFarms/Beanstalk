import { Token } from "./Token";
import { TokenValue } from "../TokenValue";
import { BigNumber, Signer } from "ethers";

export class NativeToken extends Token {
  public getContract() {
    return null;
  }

  public async getBalance(account: string): Promise<TokenValue> {
    const signerOrProvider = this.getSignerOrProvider();
    let bal: BigNumber;
    if (Signer.isSigner(signerOrProvider)) {
      // This is a signer
      bal = await signerOrProvider.getBalance();
    } else {
      // This is a provider
      bal = await signerOrProvider.getBalance(account);
    }

    return TokenValue.fromBlockchain(bal, this.decimals);
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
