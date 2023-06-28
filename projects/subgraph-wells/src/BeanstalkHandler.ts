import { Address } from "@graphprotocol/graph-ts";
import { AQUIFER } from "../../subgraph-core/utils/Constants";
import { Sunrise } from "../generated/Beanstalk/Beanstalk";
import { loadOrCreateAquifer } from "./utils/Aquifer";
import { checkForSnapshot } from "./utils/Well";

export function handleSunrise(event: Sunrise): void {
  // Right now this is a manual list of aquifers that are checked for deployments and wells updated
  // Keeping this manual is reasonable as each aquifer has to be defined as a datasource in subgraph.yaml

  let aquifer = loadOrCreateAquifer(AQUIFER);

  for (let i = 0; i < aquifer.wells.length; i++) {
    checkForSnapshot(Address.fromBytes(aquifer.wells[i]), event.block.timestamp, event.block.number);
  }
}
