import { BigNumber, ContractTransaction } from "ethers";
import { ERC20Permit, ERC20Permit__factory } from "src/constants/generated";
import { PromiseOrValue } from "src/constants/generated/common";
import { Token } from "./Token";
import { TokenValue } from "src/classes/TokenValue";

export class ERC20Token extends Token {
  private static contract: ERC20Permit;

  //////////////////////// Contract Instance ////////////////////////

  public getContract() {
    if (!ERC20Token.contract) {
      ERC20Token.contract = ERC20Permit__factory.connect(this.address, this.getProvider());
    }
    return ERC20Token.contract;
  }

  //////////////////////// On-chain Configuration ////////////////////////

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

  // /**
  //  * Get the on-chain `.decimals()` for an ERC-20 token.
  //  * @todo make this work with ERC-1155 (does it already?)
  //  * @note stored onchain in hex format, need to decode.
  //  */
  // static getDecimals(tokenAddress: string) {
  //   const tok = ERC20__factory.connect(tokenAddress, this.getProvider());
  //   return tok.decimals();
  // }

  //////////////////////// Contract Method Extensions ////////////////////////

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
    return this.getContract().approve(spenderContract, amount instanceof TokenValue ? amount.toBigNumber() : amount);
  }
}
