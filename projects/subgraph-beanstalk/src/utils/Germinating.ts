import { Address, BigInt, store } from "@graphprotocol/graph-ts";
import { ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { Germinating } from "../../generated/schema";

export function loadOrCreateGerminating(address: Address, season: i32): Germinating {
  const id = address.toHexString() + "-" + germinationSeasonCategory(season);
  let germinating = Germinating.load(id);
  if (germinating == null) {
    germinating = new Germinating(id);
    germinating.season = season;
    germinating.stalk = ZERO_BI;
    germinating.tokenAmount = ZERO_BI;
    germinating.bdv = ZERO_BI;
    germinating.save();
  }
  return germinating as Germinating;
}

export function loadGerminating(address: Address, enumValue: i32): Germinating {
  const id = address.toHexString() + "-" + germinationEnumCategory(enumValue);
  let germinating = Germinating.load(id);
  return germinating as Germinating;
}

export function tryLoadBothGerminating(address: Address): Array<Germinating | null> {
  return [Germinating.load(address.toHexString() + "-ODD"), Germinating.load(address.toHexString() + "-EVEN")];
}

export function deleteGerminating(germinating: Germinating): void {
  store.remove("Germinating", germinating.id);
}

function germinationSeasonCategory(season: i32): string {
  return season % 2 == 0 ? "EVEN" : "ODD";
}

function germinationEnumCategory(enumValue: i32): string {
  return enumValue == 0 ? "ODD" : "EVEN";
}
