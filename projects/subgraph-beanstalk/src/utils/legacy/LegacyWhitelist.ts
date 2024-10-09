import { BigInt } from "@graphprotocol/graph-ts";
import { BEAN_WETH_CP2_WELL, UNRIPE_BEAN, UNRIPE_LP } from "../../../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { toAddress } from "../../../../subgraph-core/utils/Bytes";
import { WhitelistTokenSetting } from "../../../generated/schema";
import { BI_10 } from "../../../../subgraph-core/utils/Decimals";
import { UpdateGaugeSettings } from "../../../generated/Beanstalk-ABIs/SeedGauge";

export function initLegacyUnripe(setting: WhitelistTokenSetting): void {
  const token = toAddress(setting.id);
  if (token == UNRIPE_BEAN) {
    setting.stalkIssuedPerBdv = BigInt.fromString("10000000000");
    setting.stalkEarnedPerSeason = BigInt.fromI32(2000000);
  } else if (token == UNRIPE_LP) {
    setting.stalkIssuedPerBdv = BigInt.fromString("10000000000");
    setting.stalkEarnedPerSeason = BigInt.fromI32(4000000);
  }
}

export function legacyInitGauge(event: UpdateGaugeSettings, setting: WhitelistTokenSetting): void {
  // On initial gauge deployment, there was no GaugePointChange event emitted. Need to initialize BEANETH here
  if (
    event.params.token == BEAN_WETH_CP2_WELL &&
    event.transaction.hash.toHexString().toLowerCase() == "0x299a4b93b8d19f8587b648ce04e3f5e618ea461426bb2b2337993b5d6677f6a7"
  ) {
    setting.gaugePoints = BI_10.pow(20);
  }
}
