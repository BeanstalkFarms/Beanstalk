import { BoreWell } from "../../generated/Aquifer/Aquifer";
import { Well } from "../../generated/templates";
import { loadOrCreateAquifer } from "../utils/Aquifer";
import { loadOrCreatePump } from "../utils/Pump";
import { loadOrCreateToken } from "../utils/Token";
import { createWell, loadOrCreateWellFunction } from "../utils/Well";

export function handleBoreWell(event: BoreWell): void {
  loadOrCreateAquifer(event.address);

  Well.create(event.params.well);

  let well = createWell(event.params.well, event.params.implementation, event.params.tokens);
  let wellToken = loadOrCreateToken(event.params.well);

  well.aquifer = event.address;
  well.name = wellToken.name;
  well.symbol = wellToken.symbol;

  // A bit crude, but it works

  for (let i = 0; i < event.params.tokens.length; i++) {
    loadOrCreateToken(event.params.tokens[i]);
  }

  if (event.params.tokens.length == 2) {
    well.tokens = [event.params.tokens[0], event.params.tokens[1]];
  } else if (event.params.tokens.length == 3) {
    well.tokens = [event.params.tokens[0], event.params.tokens[1], event.params.tokens[2]];
  } else if (event.params.tokens.length == 4) {
    well.tokens = [event.params.tokens[0], event.params.tokens[1], event.params.tokens[2], event.params.tokens[3]];
  }

  for (let i = 0; i < event.params.pumps.length; i++) {
    loadOrCreatePump(event.params.pumps[i], event.params.well);
  }

  loadOrCreateWellFunction(event.params.wellFunction, event.params.well);

  well.implementation = event.params.implementation;
  well.createdTimestamp = event.block.timestamp;
  well.createdBlockNumber = event.block.number;
  well.save();
}
