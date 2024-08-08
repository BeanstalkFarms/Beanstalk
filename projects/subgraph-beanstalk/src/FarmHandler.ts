import { Address, BigInt } from "@graphprotocol/graph-ts";
import { InternalBalanceChanged } from "../generated/Beanstalk-ABIs/MarketV2";
import { loadFarmer } from "./utils/Beanstalk";
import { loadSiloAsset } from "./utils/Silo";
import { takeSiloAssetSnapshots } from "./utils/snapshots/Silo";

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
    updateFarmTotals(protocol, account, token, deltaAmount, timestamp);
  }
  let asset = loadSiloAsset(account, token);
  asset.farmAmount = asset.farmAmount.plus(deltaAmount);
  takeSiloAssetSnapshots(asset, protocol, timestamp);
  asset.save();
}
