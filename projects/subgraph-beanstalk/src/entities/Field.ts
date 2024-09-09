import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Field, Plot } from "../../generated/schema";
import { ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { ADDRESS_ZERO } from "../../../subgraph-core/utils/Bytes";
import { v } from "../utils/constants/Version";

export function loadField(account: Address): Field {
  let field = Field.load(account);
  if (field == null) {
    field = new Field(account);
    field.beanstalk = "beanstalk";
    if (account !== v().protocolAddress) {
      field.farmer = account;
    }
    field.season = 1;
    field.temperature = 1;
    field.realRateOfReturn = ZERO_BD;
    field.numberOfSowers = 0;
    field.numberOfSows = 0;
    field.sownBeans = ZERO_BI;
    field.plotIndexes = [];
    field.unharvestablePods = ZERO_BI;
    field.harvestablePods = ZERO_BI;
    field.harvestedPods = ZERO_BI;
    field.soil = ZERO_BI;
    field.podIndex = ZERO_BI;
    field.podRate = ZERO_BD;
    field.save();
  }
  return field;
}

export function loadPlot(diamondAddress: Address, index: BigInt): Plot {
  let plot = Plot.load(index.toString());
  if (plot == null) {
    plot = new Plot(index.toString());
    plot.field = diamondAddress;
    plot.farmer = ADDRESS_ZERO;
    plot.source = "SOW"; // Should be overwritten in case of a transfer creating a new plot
    plot.sourceHash = "";
    plot.season = 0;
    plot.creationHash = "";
    plot.createdAt = ZERO_BI;
    plot.updatedAt = ZERO_BI;
    plot.updatedAtBlock = ZERO_BI;
    plot.index = index;
    plot.pods = ZERO_BI;
    plot.beansPerPod = ZERO_BI;
    plot.harvestablePods = ZERO_BI;
    plot.harvestedPods = ZERO_BI;
    plot.fullyHarvested = false;
    plot.save();

    let field = loadField(diamondAddress);
    field.plotIndexes.push(plot.index);
    field.save();
  }
  return plot;
}
