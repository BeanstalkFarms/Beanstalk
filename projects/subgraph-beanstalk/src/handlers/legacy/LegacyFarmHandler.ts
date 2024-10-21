import { InternalBalanceChanged } from "../../../generated/Beanstalk-ABIs/SeedGauge";
import { loadFarmer } from "../../entities/Beanstalk";
import { updateFarmTotals } from "../../utils/Farm";

// Replanted -> Reseed
export function handleInternalBalanceChanged(event: InternalBalanceChanged): void {
  loadFarmer(event.params.user);
  updateFarmTotals(event.address, event.params.user, event.params.token, event.params.delta, event.block);
}
