import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { Transfer as LegacyTransfer } from "../generated/Bean/ERC20";
import { Transfer } from "../generated/Bean-Replanted/ERC20";
import { Beanstalk } from "../generated/schema";
import { ADDRESS_ZERO, BEANSTALK } from "./utils/Constants";
import { loadField } from "./utils/Field";
import { loadSeason } from "./utils/Season";
import { toDecimal, ZERO_BI } from "./utils/Decimals";
import { loadBeanstalk } from "./utils/Beanstalk";

export function handleLegacyTransfer(event: LegacyTransfer): void {
  if (event.block.number > BigInt.fromI32(14603000)) {
    return;
  }

  if (event.block.number > BigInt.fromI32(14602789)) {
    let beanstalk = loadBeanstalk(BEANSTALK);
    let season = loadSeason(BEANSTALK, BigInt.fromI32(beanstalk.lastSeason));
    season.deltaBeans = ZERO_BI;
    season.beans = ZERO_BI;
    season.price = BigDecimal.fromString("1.022");
    season.save();
    return;
  }

  if (event.params.from == ADDRESS_ZERO || event.params.to == ADDRESS_ZERO) {
    let beanstalk = loadBeanstalk(BEANSTALK);
    let season = loadSeason(BEANSTALK, BigInt.fromI32(beanstalk.lastSeason));

    log.debug("\nBeanSupply: ============\nBeanSupply: Starting Supply - {}\n", [season.beans.toString()]);

    if (event.params.from == ADDRESS_ZERO) {
      season.deltaBeans = season.deltaBeans.plus(event.params.value);
      season.beans = season.beans.plus(event.params.value);
      log.debug("\nBeanSupply: Beans Minted - {}\nBeanSupply: Season - {}\nBeanSupply: Total Supply - {}\n", [
        event.params.value.toString(),
        season.season.toString(),
        season.beans.toString()
      ]);
    } else {
      season.deltaBeans = season.deltaBeans.minus(event.params.value);
      season.beans = season.beans.minus(event.params.value);
      log.debug("\nBeanSupply: Beans Burned - {}\nBeanSupply: Season - {}\nBeanSupply: Total Supply - {}\n", [
        event.params.value.toString(),
        season.season.toString(),
        season.beans.toString()
      ]);
    }
    season.save();
  }
}

export function handleTransfer(event: Transfer): void {
  if (event.params.from == ADDRESS_ZERO || event.params.to == ADDRESS_ZERO) {
    let beanstalk = loadBeanstalk(BEANSTALK);
    let season = loadSeason(BEANSTALK, BigInt.fromI32(beanstalk.lastSeason));

    log.debug("\nBeanSupply: ============\nBeanSupply: Starting Supply - {}\n", [toDecimal(season.beans).toString()]);

    if (event.params.from == ADDRESS_ZERO) {
      season.deltaBeans = season.deltaBeans.plus(event.params.value);
      season.beans = season.beans.plus(event.params.value);
      log.debug("\nBeanSupply: Beans Minted - {}\nBeanSupply: Season - {}\nBeanSupply: Total Supply - {}\n", [
        toDecimal(event.params.value).toString(),
        season.season.toString(),
        toDecimal(season.beans).toString()
      ]);
    } else {
      season.deltaBeans = season.deltaBeans.minus(event.params.value);
      season.beans = season.beans.minus(event.params.value);
      log.debug("\nBeanSupply: Beans Burned - {}\nBeanSupply: Season - {}\nBeanSupply: Total Supply - {}\n", [
        toDecimal(event.params.value).toString(),
        season.season.toString(),
        toDecimal(season.beans).toString()
      ]);
    }
    season.save();
  }
}
