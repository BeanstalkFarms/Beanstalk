import { BigNumber, ContractTransaction } from "ethers";
import { ERC20Permit, ERC20Permit__factory } from "src/constants/generated";
import { PromiseOrValue } from "src/constants/generated/common";
import { Token } from "./Token";
import { TokenValue } from "src/lib/TokenValue";

export class ERC20Token extends Token {
  private contract: ERC20Permit;

  public getContract() {
    if (!this.contract) {
      // Make this.contract "invisible" to console.log
      Object.defineProperty(this, "contract", {
        enumerable: false,
        configurable: false,
        writable: true,
        value: ERC20Permit__factory.connect(this.address, this.getSignerOrProvider())
      });
    }
    return this.contract;
  }

  public async getName() {
    if (this.name) return this.name;
    this.name = await this.getContract().name();
    return this.name;
  }

  public async loadFromChain() {
    const contract = this.getContract();
    const name = await contract.name();
    this.decimals = await contract.decimals();
    this.symbol = await contract.symbol();

    if (name) {
      this.name = name;
      if (this.displayName === "Unknown Token") this.displayName = name;
    }
  }

  public getBalance(account: string) {
    return this.getContract()
      .balanceOf(account)
      .then((result) => TokenValue.fromBlockchain(result, this.decimals))
      .catch((err: Error) => {
        console.error(`[ERC20Token] ${this.symbol} failed to call balanceOf(${account})`, err);
        throw err;
      });
  }

  public getAllowance(account: string, spender: string): Promise<TokenValue> {
    return this.getContract()
      .allowance(account, spender)
      .then((result) => TokenValue.fromBlockchain(result, this.decimals));
  }

  public async hasEnoughAllowance(account: string, spender: string, amount: TokenValue | BigNumber): Promise<boolean> {
    const allowance = await this.getAllowance(account, spender);
    return allowance.toBigNumber().gte(amount instanceof TokenValue ? amount.toBigNumber() : amount);
  }

  public getTotalSupply(): Promise<TokenValue> {
    return this.getContract()
      .totalSupply()
      .then((result) => TokenValue.fromBlockchain(result, this.decimals));
  }

  public approve(spenderContract: PromiseOrValue<string>, amount: TokenValue | BigNumber): Promise<ContractTransaction> {
    if (!this.getContract().signer) {
      throw new Error(`A signer is required to call .approve() - ${this.symbol}`);
    }

    return this.getContract().approve(spenderContract, amount instanceof TokenValue ? amount.toBigNumber() : amount);
  }
}
