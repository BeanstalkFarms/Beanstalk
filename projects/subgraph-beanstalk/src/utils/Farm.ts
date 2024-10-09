import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { loadSiloAsset } from "../entities/Silo";
import { takeSiloAssetSnapshots } from "../entities/snapshots/SiloAsset";

export function updateFarmTotals(
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
