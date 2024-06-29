import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { loadSiloYield, loadTokenYield } from "../utils/SiloEntities";

export function loadSiloCache(SILO_YIELD: string[][]): void {
  for (let i = 0; i < SILO_YIELD.length; i++) {
    let season = <i32>parseInt(SILO_YIELD[i][0]);
    let window = <i32>parseInt(SILO_YIELD[i][5]);
    let siloYield = loadSiloYield(season, window);

    siloYield.beta = BigDecimal.fromString(SILO_YIELD[i][1]);
    siloYield.u = <i32>parseInt(SILO_YIELD[i][2]);
    siloYield.beansPerSeasonEMA = BigDecimal.fromString(SILO_YIELD[i][3]);
    siloYield.createdAt = BigInt.fromString(SILO_YIELD[i][4]);
    siloYield.save();
  }
}

export function loadTokenCache(TOKEN_YIELD: string[][]): void {
  for (let i = 0; i < TOKEN_YIELD.length; i++) {
    let tokenYield = loadTokenYield(
      Address.fromString(TOKEN_YIELD[i][0]),
      <i32>parseInt(TOKEN_YIELD[i][1]),
      <i32>parseInt(TOKEN_YIELD[i][5])
    );
    tokenYield.beanAPY = BigDecimal.fromString(TOKEN_YIELD[i][2]);
    tokenYield.stalkAPY = BigDecimal.fromString(TOKEN_YIELD[i][3]);
    tokenYield.createdAt = BigInt.fromString(TOKEN_YIELD[i][4]);
    tokenYield.save();
  }
}
