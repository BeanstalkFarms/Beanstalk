import { Address, BigDecimal, BigInt, ethereum, store } from "@graphprotocol/graph-ts";
import { ONE_BI, toDecimal, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { Germinating, PrevFarmerGerminatingEvent } from "../../generated/schema";

export function loadOrCreateGerminating(address: Address, season: i32, isFarmer: boolean): Germinating {
  const type = germinationSeasonCategory(season);
  const id = address.toHexString() + "-" + type;
  let germinating = Germinating.load(id);
  if (germinating == null) {
    germinating = new Germinating(id);
    germinating.address = address.toHexString();
    germinating.type = type;
    germinating.isFarmer = isFarmer;
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

export function getGerminatingBdvs(address: Address): Array<BigDecimal> {
  const germinatingState = tryLoadBothGerminating(address);
  return [
    germinatingState[0] !== null ? toDecimal(germinatingState[0]!.bdv) : ZERO_BD,
    germinatingState[1] !== null ? toDecimal(germinatingState[1]!.bdv) : ZERO_BD
  ];
}

export function deleteGerminating(germinating: Germinating): void {
  store.remove("Germinating", germinating.id);
}

// This is the entity that exists to resolve the issue in LibGerminate when deposits from multiple seasons
// complete their germination (the event emission itself has a bug)
export function loadPrevFarmerGerminatingEvent(account: Address): PrevFarmerGerminatingEvent {
  let savedEvent = PrevFarmerGerminatingEvent.load(account);
  if (savedEvent == null) {
    savedEvent = new PrevFarmerGerminatingEvent(account);
    savedEvent.eventBlock = ZERO_BI;
    savedEvent.logIndex = ZERO_BI;
    savedEvent.deltaGerminatingStalk = ZERO_BI;
    // No point in saving it
  }
  return savedEvent as PrevFarmerGerminatingEvent;
}

export function savePrevFarmerGerminatingEvent(account: Address, event: ethereum.Event, deltaGerminatingStalk: BigInt): void {
  const savedEvent = new PrevFarmerGerminatingEvent(account);
  savedEvent.eventBlock = event.block.number;
  savedEvent.logIndex = event.logIndex;
  savedEvent.deltaGerminatingStalk = deltaGerminatingStalk;
  savedEvent.save();
}

// Returns the stalk offset that should be applied to the encountered FarmerGerminatingStalkBalanceChanged event.
export function getFarmerGerminatingBugOffset(account: Address, event: ethereum.Event): BigInt {
  const prevEvent = loadPrevFarmerGerminatingEvent(account);
  if (prevEvent.eventBlock == event.block.number && prevEvent.logIndex == event.logIndex.minus(ONE_BI)) {
    return prevEvent.deltaGerminatingStalk.neg();
  }
  return ZERO_BI;
}

function germinationSeasonCategory(season: i32): string {
  return season % 2 == 0 ? "EVEN" : "ODD";
}

function germinationEnumCategory(enumValue: i32): string {
  return enumValue == 0 ? "ODD" : "EVEN";
}
