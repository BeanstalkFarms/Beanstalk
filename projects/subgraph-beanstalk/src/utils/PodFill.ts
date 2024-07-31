import { Address, BigInt } from "@graphprotocol/graph-ts";
import { PodFill } from "../../generated/schema";
import { ZERO_BI } from "../../../subgraph-core/utils/Decimals";

export function loadPodFill(diamondAddress: Address, index: BigInt, hash: String): PodFill {
  let id = diamondAddress.toHexString() + "-" + index.toString() + "-" + hash;
  let fill = PodFill.load(id);
  if (fill == null) {
    fill = new PodFill(id);
    fill.podMarketplace = diamondAddress.toHexString();
    fill.createdAt = ZERO_BI;
    fill.fromFarmer = "";
    fill.toFarmer = "";
    fill.placeInLine = ZERO_BI;
    fill.amount = ZERO_BI;
    fill.index = ZERO_BI;
    fill.start = ZERO_BI;
    fill.costInBeans = ZERO_BI;
    fill.save();
  }
  return fill;
}
