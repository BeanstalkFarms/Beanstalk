import { BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { Transfer } from "../../generated/Beanstalk-ABIs/ERC20";
import { loadBeanstalk, loadSeason } from "../entities/Beanstalk";
import { ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { ADDRESS_ZERO } from "../../../subgraph-core/utils/Bytes";

export function handleTransfer(event: Transfer): void {
  if (event.params.from == ADDRESS_ZERO || event.params.to == ADDRESS_ZERO) {
    let beanstalk = loadBeanstalk();
    let season = loadSeason(BigInt.fromI32(beanstalk.lastSeason));

    if (event.params.from == ADDRESS_ZERO) {
      season.deltaBeans = season.deltaBeans.plus(event.params.value);
      season.beans = season.beans.plus(event.params.value);
    } else {
      season.deltaBeans = season.deltaBeans.minus(event.params.value);
      season.beans = season.beans.minus(event.params.value);
    }
    season.save();
  }
}

export function handleExploit(block: ethereum.Block): void {
  let beanstalk = loadBeanstalk();
  let season = loadSeason(BigInt.fromI32(beanstalk.lastSeason));
  season.deltaBeans = ZERO_BI;
  season.beans = ZERO_BI;
  season.price = BigDecimal.fromString("1.022");
  season.save();
  return;
}
