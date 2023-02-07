import { CurveMetaPool__factory } from "src/constants/generated";
import { TokenValue } from "src/TokenValue";
import { ERC20Token, Token } from "../Token";
import Pool, { Reserves } from "./Pool";

export class CurveMetaPool extends Pool {
  // This returns the index of the input token depending if
  // it's an underlying token or not.
  // Index shapes are as follows:
  // [ BEAN, 3CRV ]
  // [ DAI, USDC, USDT ] for underlying
  public getTokenIndex(token: Token) {
    let i = this.tokens.indexOf(token as ERC20Token);
    if (i >= 0) return i;
    // not found in main tokens, check underlying
    return this.underlying.indexOf(token as ERC20Token);
  }

  public getContract() {
    return CurveMetaPool__factory.connect(this.address, Pool.sdk.providerOrSigner);
  }

  public getReserves() {
    Pool.sdk.debug(`CurveMetaPool.getReserves(): ${this.address} ${this.name} on chain ${this.chainId}`);

    return this.getContract()
      .get_balances()
      .then((result) => [TokenValue.fromBlockchain(result[0], 0), TokenValue.fromBlockchain(result[1], 0)] as Reserves);
  }
}
