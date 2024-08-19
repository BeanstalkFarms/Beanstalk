import { BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { Transfer } from "../../generated/Beanstalk-ABIs/ERC20";
import { ADDRESS_ZERO, BEANSTALK } from "../../../subgraph-core/utils/Constants";
import { loadBeanstalk, loadSeason } from "../entities/Beanstalk";
import { getTokenProtocol } from "../utils/Constants";
import { ZERO_BI } from "../../../subgraph-core/utils/Decimals";

export function handleTransfer(event: Transfer): void {
  if (event.params.from == ADDRESS_ZERO || event.params.to == ADDRESS_ZERO) {
    let beanstalk = loadBeanstalk(getTokenProtocol(event.address));
    let season = loadSeason(getTokenProtocol(event.address), BigInt.fromI32(beanstalk.lastSeason));

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
  let beanstalk = loadBeanstalk(BEANSTALK);
  let season = loadSeason(BEANSTALK, BigInt.fromI32(beanstalk.lastSeason));
  season.deltaBeans = ZERO_BI;
  season.beans = ZERO_BI;
  season.price = BigDecimal.fromString("1.022");
  season.save();
  return;
}
