import { Address, Bytes, log } from "@graphprotocol/graph-ts";
import { BoreWell } from "../../generated/Aquifer/Aquifer";
import { ERC20 } from "../../generated/Aquifer/ERC20";
import { Well } from "../../generated/templates";
import { loadOrCreateAquifer } from "../utils/Aquifer";
import { loadOrCreatePump } from "../utils/Pump";
import { loadOrCreateToken } from "../utils/Token";
import { createWell, loadOrCreateWellFunction } from "../utils/Well";

export function handleBoreWell(event: BoreWell): void {
  if (event.params.well == Address.fromString("0x875b1da8dcba757398db2bc35043a72b4b62195d")) {
    // Ignore well with incorrect price function
    return;
  }
  let aquifer = loadOrCreateAquifer(event.address);

  Well.create(event.params.well);

  let well = createWell(event.params.well, event.params.implementation, event.params.tokens);
  well.aquifer = event.address;

  const tokens: Bytes[] = [];
  for (let i = 0; i < event.params.tokens.length; i++) {
    tokens.push(loadOrCreateToken(event.params.tokens[i]).id);
  }
  well.tokens = tokens;
  well.tokenOrder = tokens;

  for (let i = 0; i < event.params.pumps.length; i++) {
    loadOrCreatePump(event.params.pumps[i], event.params.well);
  }

  loadOrCreateWellFunction(event.params.wellFunction, event.params.well);

  well.implementation = event.params.implementation;
  well.createdTimestamp = event.block.timestamp;
  well.createdBlockNumber = event.block.number;
  well.save();

  let wells = aquifer.wells;
  wells.push(event.params.well);
  aquifer.wells = wells;
  aquifer.save();
}
