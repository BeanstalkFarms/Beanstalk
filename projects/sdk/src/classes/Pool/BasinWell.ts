import { BasinWell__factory, BasinWell as BasinWellContract } from "src/constants/generated";
import { TokenValue } from "src/TokenValue";
import Pool, { Reserves } from "./Pool";
import { ERC20Token } from "../Token";

export class BasinWell extends Pool {
  public getContract() {
    return BasinWell__factory.connect(this.address, Pool.sdk.providerOrSigner);
  }

  public getReserves() {
    Pool.sdk.debug(
      `BasinWell.getReserves(): ${this.address} ${this.name} on chain ${this.chainId}`
    );

    return this.getContract()
      .getReserves()
      .then(
        (result) =>
          [
            TokenValue.fromBlockchain(result[0], 0),
            TokenValue.fromBlockchain(result[1], 0)
          ] as Reserves
      );
  }

  async getAddLiquidityOut(amounts: TokenValue[]): Promise<TokenValue> {
    return this.getContract()
      .getAddLiquidityOut(amounts.map((a) => a.toBigNumber()))
      .then((result) => this.lpToken.fromBlockchain(result));
  }

  async getRemoveLiquidityOutEqual(amount: TokenValue): Promise<TokenValue[]> {
    return this.getContract()
      .getRemoveLiquidityOut(amount.toBigNumber())
      .then((result) => this.tokens.map((token, i) => token.fromBlockchain(result[i])));
  }

  async getRemoveLiquidityOutOneToken(
    lpAmountIn: TokenValue,
    tokenOut: ERC20Token
  ): Promise<TokenValue> {
    const tokenIndex = this.tokens.findIndex((token) => token.equals(tokenOut));
    if (tokenIndex < 0) {
      throw new Error(`Token ${tokenOut.symbol} does not underly ${this.name}`);
    }

    return this.getContract()
      .getRemoveLiquidityOneTokenOut(lpAmountIn.toBigNumber(), tokenOut.address)
      .then((result) => tokenOut.fromBlockchain(result));
  }
}
