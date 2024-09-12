import { Bytes4_emptyToNull } from "../../../../subgraph-core/utils/Bytes";
import { UpdateGaugeSettings } from "../../../generated/Beanstalk-ABIs/SeedGauge";
import { loadWhitelistTokenSetting } from "../../entities/Silo";
import { takeWhitelistTokenSettingSnapshots } from "../../entities/snapshots/WhitelistTokenSetting";
import { legacyInitGauge } from "../../utils/legacy/LegacyWhitelist";

// SeedGauge -> Reseed
export function handleUpdateGaugeSettings(event: UpdateGaugeSettings): void {
  let siloSettings = loadWhitelistTokenSetting(event.params.token);
  siloSettings.gpSelector = Bytes4_emptyToNull(event.params.gpSelector);
  siloSettings.lwSelector = Bytes4_emptyToNull(event.params.lwSelector);
  siloSettings.optimalPercentDepositedBdv = event.params.optimalPercentDepositedBdv;
  siloSettings.updatedAt = event.block.timestamp;

  legacyInitGauge(event, siloSettings);

  takeWhitelistTokenSettingSnapshots(siloSettings, event.block);
  siloSettings.save();
}
