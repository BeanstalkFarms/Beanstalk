import { v } from "../utils/constants/Version";
import { Sunrise } from "../../generated/Basin-ABIs/Beanstalk";
import { checkForSnapshot } from "../utils/Well";
import { getAquifer } from "../../../subgraph-core/constants/RuntimeConstants";
import { toAddress } from "../../../subgraph-core/utils/Bytes";
import { loadOrCreateAquifer } from "../entities/WellComponents";

export function handleSunrise(event: Sunrise): void {
  // Right now this is a manual list of aquifers that are checked for deployments and wells updated
  // Keeping this manual is reasonable as each aquifer has to be defined as a datasource in subgraph.yaml

  const aquifer = loadOrCreateAquifer(getAquifer(v()));
  const wells = aquifer.wells.load();

  for (let i = 0; i < wells.length; i++) {
    checkForSnapshot(toAddress(wells[i].id), event.block);
  }
}
