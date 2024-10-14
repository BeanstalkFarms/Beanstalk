import { Bytes } from "@graphprotocol/graph-ts";
import { BoreWell } from "../../generated/Basin-ABIs/Aquifer";
import { Well } from "../../generated/templates";
import { loadOrCreatePump } from "../entities/Pump";
import { loadOrCreateAquifer } from "../entities/Aquifer";
import { createWell, loadOrCreateWellFunction } from "../entities/Well";
import { loadOrCreateToken } from "../entities/Token";
import { getActualWell } from "../utils/UpgradeableMapping";

export function handleBoreWell(event: BoreWell): void {
  let aquifer = loadOrCreateAquifer(event.address);

  // Accounts for well proxies here
  const actualAddress = getActualWell(event.params.well);
  Well.create(actualAddress);

  // TODO: loadOrCreate (if is upgrade, will already exist)
  let well = createWell(actualAddress, event.params.tokens);
  well.aquifer = event.address;

  const tokens: Bytes[] = [];
  for (let i = 0; i < event.params.tokens.length; i++) {
    tokens.push(loadOrCreateToken(event.params.tokens[i]).id);
  }
  well.tokens = tokens;
  well.tokenOrder = tokens;

  for (let i = 0; i < event.params.pumps.length; i++) {
    loadOrCreatePump(event.params.pumps[i], actualAddress);
  }

  // TODO: what if the same well function has different data for different wells?
  // - data should be a field on the well and also included in WellUpgradeHistory
  const wellFn = loadOrCreateWellFunction(event.params.wellFunction.target);
  wellFn.data = event.params.wellFunction.data;
  wellFn.save();

  well.wellFunction = event.params.wellFunction.target;
  well.implementation = event.params.implementation;
  // TODO: avoid re setting these on update
  well.createdTimestamp = event.block.timestamp;
  well.createdBlockNumber = event.block.number;
  well.save();

  let wells = aquifer.wells;
  // TODO: only push if is new well
  wells.push(actualAddress);
  aquifer.wells = wells;
  aquifer.save();
}
