import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { InternalBalanceChanged } from "../../generated/Beanstalk-ABIs/Reseed";
import { takeSiloAssetSnapshots } from "../entities/snapshots/SiloAsset";
import { loadSiloAsset } from "../entities/Silo";
import { loadFarmer } from "../entities/Beanstalk";

export function handleInternalBalanceChanged(event: InternalBalanceChanged): void {
  loadFarmer(event.params.user);
  updateFarmTotals(event.address, event.params.user, event.params.token, event.params.delta, event.block);
}

function updateFarmTotals(
  protocol: Address,
  account: Address,
  token: Address,
  deltaAmount: BigInt,
  block: ethereum.Block,
  recursive: boolean = true
): void {
  if (recursive && account != protocol) {
    updateFarmTotals(protocol, protocol, token, deltaAmount, block);
  }
  let asset = loadSiloAsset(account, token);
  asset.farmAmount = asset.farmAmount.plus(deltaAmount);
  takeSiloAssetSnapshots(asset, block);
  asset.save();
}
