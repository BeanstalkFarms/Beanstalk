import { Address, BigInt } from "@graphprotocol/graph-ts";
import { InternalBalanceChanged } from "../../generated/Beanstalk-ABIs/SeedGauge";
import { takeSiloAssetSnapshots } from "../entities/snapshots/SiloAsset";
import { loadSiloAsset } from "../entities/Silo";
import { loadFarmer } from "../entities/Beanstalk";

export function handleInternalBalanceChanged(event: InternalBalanceChanged): void {
  loadFarmer(event.params.user);
  updateFarmTotals(event.address, event.params.user, event.params.token, event.params.delta, event.block.timestamp);
}

function updateFarmTotals(
  protocol: Address,
  account: Address,
  token: Address,
  deltaAmount: BigInt,
  timestamp: BigInt,
  recursive: boolean = true
): void {
  if (recursive && account != protocol) {
    updateFarmTotals(protocol, protocol, token, deltaAmount, timestamp);
  }
  let asset = loadSiloAsset(account, token);
  asset.farmAmount = asset.farmAmount.plus(deltaAmount);
  takeSiloAssetSnapshots(asset, protocol, timestamp);
  asset.save();
}
