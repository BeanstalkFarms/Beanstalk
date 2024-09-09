import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Farmer, Fertilizer, FertilizerBalance, FertilizerToken, FertilizerYield } from "../../generated/schema";
import { ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { SeedGauge } from "../../generated/Beanstalk-ABIs/SeedGauge";
import { v } from "../utils/constants/Version";

export function loadFertilizer(fertilizerAddress: Address): Fertilizer {
  let fertilizer = Fertilizer.load(fertilizerAddress);
  if (fertilizer == null) {
    fertilizer = new Fertilizer(fertilizerAddress);
    fertilizer.beanstalk = "beanstalk";
    fertilizer.supply = ZERO_BI;
    fertilizer.save();
  }
  return fertilizer;
}

export function loadFertilizerToken(fertilizer: Fertilizer, id: BigInt, blockNumber: BigInt): FertilizerToken {
  let fertilizerToken = FertilizerToken.load(id.toString());
  if (fertilizerToken == null) {
    const beanstalkContract = SeedGauge.bind(v().protocolAddress);
    fertilizerToken = new FertilizerToken(id.toString());
    fertilizerToken.fertilizer = fertilizer.id;
    if (blockNumber.gt(BigInt.fromString("15278963"))) {
      fertilizerToken.humidity = BigDecimal.fromString(beanstalkContract.getCurrentHumidity().toString()).div(BigDecimal.fromString("10"));
      fertilizerToken.season = beanstalkContract.season().toI32();
      fertilizerToken.startBpf = beanstalkContract.beansPerFertilizer();
    } else {
      fertilizerToken.humidity = BigDecimal.fromString("500");
      fertilizerToken.season = 6074;
      fertilizerToken.startBpf = ZERO_BI;
    }
    fertilizerToken.endBpf = id;
    fertilizerToken.supply = ZERO_BI;
    fertilizerToken.save();
  }
  return fertilizerToken;
}

export function loadFertilizerBalance(fertilizerToken: FertilizerToken, farmer: Farmer): FertilizerBalance {
  const id = `${fertilizerToken.id}-${farmer.id}`;
  let fertilizerBalance = FertilizerBalance.load(id);
  if (fertilizerBalance == null) {
    fertilizerBalance = new FertilizerBalance(id);
    fertilizerBalance.farmer = farmer.id;
    fertilizerBalance.fertilizerToken = fertilizerToken.id;
    fertilizerBalance.amount = ZERO_BI;
    fertilizerBalance.save();
  }
  return fertilizerBalance;
}

export function loadFertilizerYield(season: i32, window: i32): FertilizerYield {
  let fertilizerYield = FertilizerYield.load(season.toString() + "-" + window.toString());
  if (fertilizerYield == null) {
    fertilizerYield = new FertilizerYield(season.toString() + "-" + window.toString());
    fertilizerYield.season = season;
    fertilizerYield.humidity = ZERO_BD;
    fertilizerYield.outstandingFert = ZERO_BI;
    fertilizerYield.beansPerSeasonEMA = ZERO_BD;
    fertilizerYield.deltaBpf = ZERO_BD;
    fertilizerYield.simpleAPY = ZERO_BD;
    fertilizerYield.createdAt = ZERO_BI;

    if (window == 24) {
      fertilizerYield.emaWindow = "ROLLING_24_HOUR";
    } else if (window == 168) {
      fertilizerYield.emaWindow = "ROLLING_7_DAY";
    } else if (window == 720) {
      fertilizerYield.emaWindow = "ROLLING_30_DAY";
    }

    fertilizerYield.save();
  }
  return fertilizerYield as FertilizerYield;
}
