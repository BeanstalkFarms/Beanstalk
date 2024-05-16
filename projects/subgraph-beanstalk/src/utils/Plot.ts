import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Plot } from "../../generated/schema";
import { ADDRESS_ZERO } from "../../../subgraph-core/utils/Constants";
import { ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { loadField } from "./Field";

export function loadPlot(diamondAddress: Address, index: BigInt): Plot {
  let plot = Plot.load(index.toString());
  if (plot == null) {
    plot = new Plot(index.toString());
    plot.field = diamondAddress.toHexString();
    plot.farmer = ADDRESS_ZERO.toHexString();
    plot.source = "SOW"; // Should be overwritten in case of a transfer creating a new plot
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
    plot.internalUseOnly = "";
    plot.save();

    let field = loadField(diamondAddress);
    field.plotIndexes.push(plot.index);
    field.save();
  }
  return plot;
}
