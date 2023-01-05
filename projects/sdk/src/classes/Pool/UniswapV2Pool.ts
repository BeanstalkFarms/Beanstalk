import { UniswapV2Pair__factory } from "src/constants/generated";
import { TokenValue } from "src/TokenValue";
import Pool, { Reserves } from "./Pool";

export class UniswapV2Pool extends Pool {
  public getContract() {
    return UniswapV2Pair__factory.connect(this.address, Pool.sdk.providerOrSigner);
  }

  public getReserves() {
    Pool.sdk.debug(`UniswapV2Pool.getReserves(): ${this.address} ${this.name} on chain ${this.chainId}`);

    return this.getContract()
      .getReserves()
      .then((result) => [TokenValue.fromBlockchain(result._reserve0, 0), TokenValue.fromBlockchain(result._reserve1, 0)] as Reserves);
  }
}
