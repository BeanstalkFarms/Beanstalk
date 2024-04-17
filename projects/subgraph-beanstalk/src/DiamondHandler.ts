import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { DiamondCut } from "../generated/Diamond/Beanstalk";
import { loadBeanstalk } from "./utils/Beanstalk";
import { TOKEN_YIELD_14_000 } from "./utils/HistoricYield";
import { loadTokenYield } from "./utils/SiloEntities";

export function handleDiamondCut(event: DiamondCut): void {
  let beanstalk = loadBeanstalk(event.address);

  // Load the historical vAPY figures in bulk at start
  if (beanstalk.lastUpgrade == ZERO_BI) {
    for (let i = 0; i < TOKEN_YIELD_14_000.length; i++) {
      let tokenYield = loadTokenYield(Address.fromString(TOKEN_YIELD_14_000[i][0]), <i32>parseInt(TOKEN_YIELD_14_000[i][1]));
      tokenYield.beanAPY = BigDecimal.fromString(TOKEN_YIELD_14_000[i][2]);
      tokenYield.stalkAPY = BigDecimal.fromString(TOKEN_YIELD_14_000[i][3]);
      tokenYield.createdAt = BigInt.fromString(TOKEN_YIELD_14_000[i][4]);
      tokenYield.save();
    }
  }

  beanstalk.lastUpgrade = event.block.timestamp;
  beanstalk.save();
}
