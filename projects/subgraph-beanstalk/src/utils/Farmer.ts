import { Address } from "@graphprotocol/graph-ts";
import { Farmer } from "../../generated/schema";

export function loadFarmer(account: Address): Farmer {
  let farmer = Farmer.load(account.toHexString());
  if (farmer == null) {
    farmer = new Farmer(account.toHexString());
    farmer.save();
  }
  return farmer;
}
