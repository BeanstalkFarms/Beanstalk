import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { takeSiloSnapshots } from "../entities/snapshots/Silo";
import { loadSilo, loadSiloAsset, loadSiloDeposit, loadWhitelistTokenSetting, updateDeposit } from "../entities/Silo";
import { takeSiloAssetSnapshots } from "../entities/snapshots/SiloAsset";
import { stemFromSeason } from "./contracts/SiloCalculations";
import { GAUGE_BIP45_BLOCK } from "../../../subgraph-core/constants/BeanstalkEth";
import { BI_10, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { loadBeanstalk, loadFarmer } from "../entities/Beanstalk";

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
      deposit.depositVersion = params.event.block.number > GAUGE_BIP45_BLOCK ? "v3.1" : "v3";
      deposit.stemV31 = params.event.block.number > GAUGE_BIP45_BLOCK ? deposit.stem! : deposit.stem!.times(BI_10.pow(6));
    }

    deposit = updateDeposit(deposit, params.amounts[i], params.bdvs![i], params.event)!;
    deposit.save();

    // Ensure that a Farmer entity is set up for this account.
    loadFarmer(params.account);

    updateDepositInSilo(
      params.event.address,
      params.account,
      params.token,
      params.amounts[i],
      params.bdvs![i],
      params.event.block.timestamp
    );
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
    updateDepositInSilo(
      params.event.address,
      params.account,
      params.token,
      params.amounts[i].neg(),
      removedBdv.neg(),
      params.event.block.timestamp
    );
  }
}

export function updateDepositInSilo(
  protocol: Address,
  account: Address,
  token: Address,
  deltaAmount: BigInt,
  deltaBdv: BigInt,
  timestamp: BigInt,
  recurs: boolean = true
): void {
  if (recurs && account != protocol) {
    updateDepositInSilo(protocol, protocol, token, deltaAmount, deltaBdv, timestamp);
  }
  let silo = loadSilo(account);
  silo.depositedBDV = silo.depositedBDV.plus(deltaBdv);

  const newSeedStalk = updateDepositInSiloAsset(protocol, account, token, deltaAmount, deltaBdv, timestamp, false);
  // Individual farmer seeds cannot be directly tracked due to seed gauge
  if (account == protocol) {
    silo.grownStalkPerSeason = silo.grownStalkPerSeason.plus(newSeedStalk);
  }
  takeSiloSnapshots(silo, protocol, timestamp);
  silo.save();
}

export function updateDepositInSiloAsset(
  protocol: Address,
  account: Address,
  token: Address,
  deltaAmount: BigInt,
  deltaBdv: BigInt,
  timestamp: BigInt,
  recurs: boolean = true
): BigInt {
  if (recurs && account != protocol) {
    updateDepositInSiloAsset(protocol, protocol, token, deltaAmount, deltaBdv, timestamp);
  }
  let asset = loadSiloAsset(account, token);

  let tokenSettings = loadWhitelistTokenSetting(token);
  let newGrownStalk = deltaBdv.times(tokenSettings.stalkEarnedPerSeason).div(BigInt.fromI32(1000000));

  asset.depositedBDV = asset.depositedBDV.plus(deltaBdv);
  asset.depositedAmount = asset.depositedAmount.plus(deltaAmount);

  takeSiloAssetSnapshots(asset, protocol, timestamp);
  asset.save();

  return newGrownStalk;
}

export function addWithdrawToSiloAsset(
  protocol: Address,
  account: Address,
  token: Address,
  deltaAmount: BigInt,
  timestamp: BigInt,
  recurs: boolean = true
): void {
  if (recurs && account != protocol) {
    addWithdrawToSiloAsset(protocol, protocol, token, deltaAmount, timestamp);
  }
  let asset = loadSiloAsset(account, token);
  asset.withdrawnAmount = asset.withdrawnAmount.plus(deltaAmount);
  takeSiloAssetSnapshots(asset, protocol, timestamp);
  asset.save();
}

export function updateStalkBalances(
  protocol: Address,
  account: Address,
  deltaStalk: BigInt,
  deltaRoots: BigInt,
  timestamp: BigInt,
  recurs: boolean = true
): void {
  if (recurs && account != protocol) {
    updateStalkBalances(protocol, protocol, deltaStalk, deltaRoots, timestamp);
  }
  let silo = loadSilo(account);
  silo.stalk = silo.stalk.plus(deltaStalk);
  silo.roots = silo.roots.plus(deltaRoots);

  takeSiloSnapshots(silo, protocol, timestamp);

  // Add account to active list if needed
  if (account !== protocol) {
    let beanstalk = loadBeanstalk(protocol);
    let farmerIndex = beanstalk.activeFarmers.indexOf(account.toHexString());
    if (farmerIndex == -1) {
      let newFarmers = beanstalk.activeFarmers;
      newFarmers.push(account.toHexString());
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

export function updateSeedsBalances(protocol: Address, account: Address, seeds: BigInt, timestamp: BigInt, recurs: boolean = true): void {
  if (recurs && account != protocol) {
    updateSeedsBalances(protocol, protocol, seeds, timestamp);
  }
  let silo = loadSilo(account);
  silo.seeds = silo.seeds.plus(seeds);
  takeSiloSnapshots(silo, protocol, timestamp);
  silo.save();
}
