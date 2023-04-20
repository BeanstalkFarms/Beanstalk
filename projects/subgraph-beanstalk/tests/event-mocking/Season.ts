import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as/assembly/index";

import { AddDeposit, RemoveDeposit, RemoveDeposits } from "../../generated/Silo-Replanted/Beanstalk";
import { handleAddDeposit } from "../../src/SiloHandler";
import { BEAN_DECIMALS } from "../../src/utils/Constants";

export function createSunriseEvent(season: BigInt): void { }
export function createSeasonSnapshotEvent(season: i32, price: BigInt, supply: BigInt, stalk: BigInt, seeds: BigInt, podIndex: BigInt, harvestableIndex: BigInt): void { }
export function createIncentivizationEvent(account: string, beans: BigInt): void { }

/** ===== Replant Events ===== */

export function createRewardEvent(season: BigInt, toField: BigInt, toSilo: BigInt, toFertilizer: BigInt): void { }
export function createMetapoolOracleEvent(season: BigInt, deltaB: BigInt, balances: BigInt[]): void { }
export function createSoilEvent(season: BigInt, soil: BigInt): void { }

