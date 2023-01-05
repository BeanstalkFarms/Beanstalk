import { BigNumber, ContractTransaction } from "ethers";
import { ERC20__factory } from "src/constants/generated";
import { PromiseOrValue } from "src/constants/generated/common";
import { ERC20Permit } from "src/constants/generated/ERC20Permit";
import { ERC20Permit__factory } from "src/constants/generated/factories/ERC20Permit__factory";
import { Token } from "./Token";
import { TokenValue } from "src/classes/TokenValue";

export class ERC20Token extends Token {
  public contract: ERC20Permit;

  //////////////////////// Contract Instance ////////////////////////

  public getContract() {
    if (!this.contract) {
      this.contract = ERC20Permit__factory.connect(this.address, Token.sdk.providerOrSigner);
    }
    return this.contract;
  }

  //////////////////////// On-chain Configuration ////////////////////////

  /** @fixme */
  public async getName() {
    if (this.name) return this.name;
    this.name = await this.getContract().name();
    return this.name;
  }

  /** @fixme */
  static getName(tokenAddress: string) {
    const tok = ERC20__factory.connect(tokenAddress, this.sdk.provider);
    return tok.name();
  }

  /**
   * Get the on-chain `.decimals()` for an ERC-20 token.
   * @todo make this work with ERC-1155 (does it already?)
   * @note stored onchain in hex format, need to decode.
   */
  static getDecimals(tokenAddress: string) {
    const tok = ERC20__factory.connect(tokenAddress, this.sdk.provider);
    return tok.decimals();
  }

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

  public approveBeanstalk(amount: TokenValue | BigNumber): Promise<ContractTransaction> {
    return this.approve(Token.sdk.contracts.beanstalk.address, amount);
  }
}
