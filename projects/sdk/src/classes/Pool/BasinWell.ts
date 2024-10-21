import { BasinWell__factory, BasinWell as BasinWellContract } from "src/constants/generated";
import { TokenValue } from "src/TokenValue";
import Pool, { Reserves } from "./Pool";
import { ERC20Token, Token } from "../Token";

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

  getPairToken(token: Token) {
    if (this.tokens.length !== 2) {
      throw new Error("Cannot get pair token for non-pair well");
    }

    const [token0, token1] = this.tokens;

    if (!token0.equals(token) && !token1.equals(token)) {
      throw new Error(
        `Invalid token. ${token.symbol} is not an underlying token of well ${this.name}`
      );
    }

    return token.equals(token0) ? token1 : token0;
  }

  // Ensure tokens are in the correct order
  async updateTokenIndexes() {
    const data = await this.getContract().tokens();
    if (!data || data.length !== 2) {
      throw new Error(`could not validate well tokens for ${this.name}`);
    }

    const first = data[0].toLowerCase();
    const thisFirst = this.tokens[0].address.toLowerCase();

    if (first !== thisFirst) {
      this.tokens.reverse();
    }
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

  getBeanWellTokenIndexes() {
    // assumes tokens are in correct order
    const beanIndex = this.tokens.findIndex((token) => token.equals(BasinWell.sdk.tokens.BEAN));

    if (beanIndex < 0) {
      throw new Error(`Bean token not found in well ${this.name}`);
    }

    return {
      bean: beanIndex,
      nonBean: beanIndex === 0 ? 1 : 0
    };
  }
}
