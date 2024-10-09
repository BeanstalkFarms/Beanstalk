import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { takeSiloSnapshots } from "../entities/snapshots/Silo";
import { loadSilo, loadSiloAsset, loadSiloDeposit, loadWhitelistTokenSetting, updateDeposit } from "../entities/Silo";
import { takeSiloAssetSnapshots } from "../entities/snapshots/SiloAsset";
import { BI_10, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { loadBeanstalk, loadFarmer } from "../entities/Beanstalk";
import { stemFromSeason } from "./legacy/LegacySilo";
import { beanDecimals, isGaugeDeployed } from "../../../subgraph-core/constants/RuntimeConstants";
import { v } from "./constants/Version";

class AddRemoveDepositsParams {
  event: ethereum.Event;
  account: Address;
  token: Address;
  seasons: BigInt[] | null; // Seasons not present in v3+
  stems: BigInt[] | null; // Stems not present in v2
  amounts: BigInt[];
  bdvs: BigInt[] | null; // bdv not present in v2 removal
  depositVersion: String;
}

export function addDeposits(params: AddRemoveDepositsParams): void {
  for (let i = 0; i < params.amounts.length; ++i) {
    let deposit = loadSiloDeposit({
      account: params.account,
      token: params.token,
      depositVersion: params.depositVersion,
      season: params.seasons != null ? params.seasons![i] : null,
      stem: params.stems != null ? params.stems![i] : null
    });

    // Set granular deposit version type
    if (params.depositVersion == "season") {
      deposit.depositVersion = "season";
      // Fill stem according to legacy conversion
      deposit.stemV31 = stemFromSeason(params.seasons![i].toI32(), params.token);
    } else {
      deposit.depositVersion = isGaugeDeployed(v(), params.event.block.number) ? "v3.1" : "v3";
      deposit.stemV31 = isGaugeDeployed(v(), params.event.block.number) ? deposit.stem! : deposit.stem!.times(BI_10.pow(6));
    }

    deposit = updateDeposit(deposit, params.amounts[i], params.bdvs![i], params.event)!;
    deposit.save();

    // Ensure that a Farmer entity is set up for this account.
    loadFarmer(params.account);

    updateDepositInSilo(params.event.address, params.account, params.token, params.amounts[i], params.bdvs![i], params.event.block);
  }
}

export function removeDeposits(params: AddRemoveDepositsParams): void {
  for (let i = 0; i < params.amounts.length; ++i) {
    let deposit = loadSiloDeposit({
      account: params.account,
      token: params.token,
      depositVersion: params.depositVersion,
      season: params.seasons != null ? params.seasons![i] : null,
      stem: params.stems != null ? params.stems![i] : null
    });

    // Use bdv if it was provided (v2 events dont provide bdv), otherwise infer
    let removedBdv = params.bdvs != null ? params.bdvs![i] : params.amounts[i].times(deposit.depositedBDV).div(deposit.depositedAmount);

    // If the amount goes to zero, the deposit is deleted and not returned
    const updatedDeposit = updateDeposit(deposit, params.amounts[i].neg(), removedBdv.neg(), params.event);
    if (updatedDeposit !== null) {
      updatedDeposit.save();
    }

    // Update protocol totals
    updateDepositInSilo(params.event.address, params.account, params.token, params.amounts[i].neg(), removedBdv.neg(), params.event.block);
  }
}

export function updateDepositInSilo(
  protocol: Address,
  account: Address,
  token: Address,
  deltaAmount: BigInt,
  deltaBdv: BigInt,
  block: ethereum.Block,
  recurs: boolean = true
): void {
  if (recurs && account != protocol) {
    updateDepositInSilo(protocol, protocol, token, deltaAmount, deltaBdv, block);
  }
  let silo = loadSilo(account);
  silo.depositedBDV = silo.depositedBDV.plus(deltaBdv);

  const newSeedStalk = updateDepositInSiloAsset(protocol, account, token, deltaAmount, deltaBdv, block, false);
  // Individual farmer seeds cannot be directly tracked due to seed gauge
  if (account == protocol) {
    silo.grownStalkPerSeason = silo.grownStalkPerSeason.plus(newSeedStalk);
  }
  takeSiloSnapshots(silo, block);
  silo.save();
}

export function updateDepositInSiloAsset(
  protocol: Address,
  account: Address,
  token: Address,
  deltaAmount: BigInt,
  deltaBdv: BigInt,
  block: ethereum.Block,
  recurs: boolean = true
): BigInt {
  if (recurs && account != protocol) {
    updateDepositInSiloAsset(protocol, protocol, token, deltaAmount, deltaBdv, block);
  }
  let asset = loadSiloAsset(account, token);

  let tokenSettings = loadWhitelistTokenSetting(token);
  let newGrownStalk = deltaBdv.times(tokenSettings.stalkEarnedPerSeason).div(BI_10.pow(<u8>beanDecimals()));

  asset.depositedBDV = asset.depositedBDV.plus(deltaBdv);
  asset.depositedAmount = asset.depositedAmount.plus(deltaAmount);

  takeSiloAssetSnapshots(asset, block);
  asset.save();

  return newGrownStalk;
}

export function addWithdrawToSiloAsset(
  protocol: Address,
  account: Address,
  token: Address,
  deltaAmount: BigInt,
  block: ethereum.Block,
  recurs: boolean = true
): void {
  if (recurs && account != protocol) {
    addWithdrawToSiloAsset(protocol, protocol, token, deltaAmount, block);
  }
  let asset = loadSiloAsset(account, token);
  asset.withdrawnAmount = asset.withdrawnAmount.plus(deltaAmount);
  takeSiloAssetSnapshots(asset, block);
  asset.save();
}

export function updateStalkBalances(
  protocol: Address,
  account: Address,
  deltaStalk: BigInt,
  deltaRoots: BigInt,
  block: ethereum.Block,
  recurs: boolean = true
): void {
  if (recurs && account != protocol) {
    updateStalkBalances(protocol, protocol, deltaStalk, deltaRoots, block);
  }
  let silo = loadSilo(account);
  silo.stalk = silo.stalk.plus(deltaStalk);
  silo.roots = silo.roots.plus(deltaRoots);

  takeSiloSnapshots(silo, block);

  // Add account to active list if needed
  if (account !== protocol) {
    let beanstalk = loadBeanstalk();
    let farmerIndex = beanstalk.activeFarmers.indexOf(account);
    if (farmerIndex == -1) {
      let newFarmers = beanstalk.activeFarmers;
      newFarmers.push(account);
      beanstalk.activeFarmers = newFarmers;
      beanstalk.save();
      silo.activeFarmers += 1;
    } else if (silo.stalk == ZERO_BI) {
      let newFarmers = beanstalk.activeFarmers;
      newFarmers.splice(farmerIndex, 1);
      beanstalk.activeFarmers = newFarmers;
      beanstalk.save();
      silo.activeFarmers -= 1;
    }
  }
  silo.save();
}
