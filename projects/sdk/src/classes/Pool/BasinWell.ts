import { BasinWell__factory } from "src/constants/generated";
import { TokenValue } from "src/TokenValue";
import Pool, { Reserves } from "./Pool";

export class BasinWell extends Pool {
  public getContract() {
    return BasinWell__factory.connect(this.address, Pool.sdk.providerOrSigner);
  }

  public getReserves() {
    Pool.sdk.debug(`BasinWell.getReserves(): ${this.address} ${this.name} on chain ${this.chainId}`);

    return this.getContract()
      .getReserves()
      .then((result) => [TokenValue.fromBlockchain(result[0], 0), TokenValue.fromBlockchain(result[1], 0)] as Reserves);
  }
}
