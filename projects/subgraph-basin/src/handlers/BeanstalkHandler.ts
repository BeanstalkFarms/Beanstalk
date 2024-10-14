import { v } from "../utils/constants/Version";
import { Sunrise } from "../../generated/Basin-ABIs/Beanstalk";
import { loadOrCreateAquifer } from "../entities/Aquifer";
import { checkForSnapshot } from "../utils/Well";
import { getAquifer } from "../../../subgraph-core/constants/RuntimeConstants";
import { toAddress } from "../../../subgraph-core/utils/Bytes";

export function handleSunrise(event: Sunrise): void {
  // Right now this is a manual list of aquifers that are checked for deployments and wells updated
  // Keeping this manual is reasonable as each aquifer has to be defined as a datasource in subgraph.yaml

  let aquifer = loadOrCreateAquifer(getAquifer(v()));

  for (let i = 0; i < aquifer.wells.length; i++) {
    checkForSnapshot(toAddress(aquifer.wells[i]), event.block);
  }
}
