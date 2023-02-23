import { Address, BigInt } from "@graphprotocol/graph-ts";
import { PodFill } from "../../generated/schema";
import { ZERO_BI } from "./Decimals";

export function loadPodFill(diamondAddress: Address, index: BigInt, hash: String): PodFill {
  let id = diamondAddress.toHexString() + "-" + index.toString() + "-" + hash;
  let fill = PodFill.load(id);
  if (fill == null) {
    fill = new PodFill(id);
    fill.podMarketplace = diamondAddress.toHexString();
    fill.createdAt = ZERO_BI;
    fill.from = "";
    fill.to = "";
    fill.amount = ZERO_BI;
    fill.index = ZERO_BI;
    fill.start = ZERO_BI;
    fill.save();
  }
  return fill;
}
