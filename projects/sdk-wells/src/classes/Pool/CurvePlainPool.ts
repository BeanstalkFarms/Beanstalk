import { CurvePlainPool__factory } from "src/constants/generated";
import { TokenValue } from "src/TokenValue";
import Pool, { Reserves } from "./Pool";

export class CurvePlainPool extends Pool {
  public getContract() {
    return CurvePlainPool__factory.connect(this.address, Pool.sdk.providerOrSigner);
  }

  public getReserves() {
    Pool.sdk.debug(`CurvePlainPool.getReserves(): ${this.address} ${this.name} on chain ${this.chainId}`);

    return this.getContract()
      .get_balances()
      .then((result) => [TokenValue.fromBlockchain(result[0], 0), TokenValue.fromBlockchain(result[1], 0)] as Reserves);
  }
}
