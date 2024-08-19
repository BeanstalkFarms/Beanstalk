import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import { loadSilo, loadSiloAsset, loadSiloWithdraw } from "../../entities/Silo";
import { takeSiloAssetSnapshots } from "../../entities/snapshots/SiloAsset";
import { loadBeanstalk } from "../../entities/Beanstalk";
import { updateSeedsBalances, updateStalkBalances } from "../Silo";
import { Replanted } from "../../../generated/Beanstalk-ABIs/Replanted";

export function updateClaimedWithdraw(
  protocol: Address,
  account: Address,
  token: Address,
  withdrawSeason: BigInt,
  timestamp: BigInt
): void {
  let withdraw = loadSiloWithdraw(account, token, withdrawSeason.toI32());
  withdraw.claimed = true;
  withdraw.save();

  let asset = loadSiloAsset(account, token);
  asset.withdrawnAmount = asset.withdrawnAmount.minus(withdraw.amount);
  takeSiloAssetSnapshots(asset, protocol, timestamp);
  asset.save();
}

// Replanted -> SiloV3
// This should be run at sunrise for the previous season to update any farmers stalk/seed/roots balances from silo transfers.
export function updateStalkWithCalls(protocol: Address, timestamp: BigInt): void {
  let beanstalk = loadBeanstalk(protocol);
  let beanstalk_call = Replanted.bind(protocol);

  for (let i = 0; i < beanstalk.farmersToUpdate.length; i++) {
    let account = Address.fromString(beanstalk.farmersToUpdate[i]);
    let silo = loadSilo(account);
    updateStalkBalances(
      protocol,
      account,
      beanstalk_call.balanceOfStalk(account).minus(silo.stalk),
      beanstalk_call.balanceOfRoots(account).minus(silo.roots),
      timestamp,
      false
    );
    updateSeedsBalances(protocol, account, beanstalk_call.balanceOfSeeds(account).minus(silo.seeds), timestamp, false);
  }
  beanstalk.farmersToUpdate = [];
  beanstalk.save();
}
