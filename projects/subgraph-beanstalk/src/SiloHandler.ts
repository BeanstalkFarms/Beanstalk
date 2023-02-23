import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import {
  AddDeposit,
  StalkBalanceChanged,
  AddWithdrawal,
  RemoveDeposit,
  RemoveDeposits,
  RemoveWithdrawal,
  RemoveWithdrawals,
  Plant,
  WhitelistToken,
  DewhitelistToken
} from "../generated/Silo-Replanted/Beanstalk";
import { Beanstalk, TransferDepositCall, TransferDepositsCall } from "../generated/Silo-Calls/Beanstalk";
import { ZERO_BI } from "./utils/Decimals";
import { loadFarmer } from "./utils/Farmer";
import { loadSilo, loadSiloDailySnapshot, loadSiloHourlySnapshot } from "./utils/Silo";
import { loadSiloAsset as loadSiloAsset, loadSiloAssetDailySnapshot, loadSiloAssetHourlySnapshot } from "./utils/SiloAsset";
import { loadSiloDeposit } from "./utils/SiloDeposit";
import { loadSiloWithdraw } from "./utils/SiloWithdraw";
import {
  AddDeposit as AddDepositEntity,
  RemoveDeposit as RemoveDepositEntity,
  WhitelistToken as WhitelistTokenEntity,
  DewhitelistToken as DewhitelistTokenEntity,
  SeedChange,
  StalkChange
} from "../generated/schema";
import { loadBeanstalk } from "./utils/Beanstalk";
import { BEANSTALK, BEAN_ERC20, UNRIPE_BEAN, UNRIPE_BEAN_3CRV } from "./utils/Constants";

export function handleAddDeposit(event: AddDeposit): void {
  let deposit = loadSiloDeposit(event.params.account, event.params.token, event.params.season);
  deposit.amount = deposit.amount.plus(event.params.amount);
  deposit.depositedAmount = deposit.depositedAmount.plus(event.params.amount);
  deposit.bdv = deposit.bdv.plus(event.params.bdv);
  deposit.depositedBDV = deposit.depositedBDV.plus(event.params.bdv);
  let depositHashes = deposit.hashes;
  depositHashes.push(event.transaction.hash.toHexString());
  deposit.hashes = depositHashes;
  deposit.createdAt = deposit.createdAt == ZERO_BI ? event.block.timestamp : deposit.createdAt;
  deposit.updatedAt = event.block.timestamp;
  deposit.save();

  // Use the current season of beanstalk for updating silo and farmer totals
  let beanstalk = loadBeanstalk(event.address);

  // Update overall silo totals
  addDepositToSilo(event.address, beanstalk.lastSeason, event.params.bdv, event.block.timestamp, event.block.number);
  addDepositToSiloAsset(
    event.address,
    event.params.token,
    beanstalk.lastSeason,
    event.params.bdv,
    event.params.amount,
    event.block.timestamp,
    event.block.number
  );

  // Ensure that a Farmer entity is set up for this account.
  loadFarmer(event.params.account);

  // Update farmer silo totals
  addDepositToSilo(event.params.account, beanstalk.lastSeason, event.params.bdv, event.block.timestamp, event.block.number);
  addDepositToSiloAsset(
    event.params.account,
    event.params.token,
    beanstalk.lastSeason,
    event.params.bdv,
    event.params.amount,
    event.block.timestamp,
    event.block.number
  );

  let id = "addDeposit-" + event.transaction.hash.toHexString() + "-" + event.transactionLogIndex.toString();
  let add = new AddDepositEntity(id);
  add.hash = event.transaction.hash.toHexString();
  add.logIndex = event.transactionLogIndex.toI32();
  add.protocol = event.address.toHexString();
  add.account = event.params.account.toHexString();
  add.token = event.params.token.toHexString();
  add.season = event.params.season.toI32();
  add.amount = event.params.amount;
  add.bdv = event.params.bdv;
  add.blockNumber = event.block.number;
  add.createdAt = event.block.timestamp;
  add.save();
}

export function handleRemoveDeposit(event: RemoveDeposit): void {
  let beanstalk = loadBeanstalk(event.address); // get current season
  let deposit = loadSiloDeposit(event.params.account, event.params.token, event.params.season);

  let withdrawnBDV = deposit.amount == ZERO_BI ? ZERO_BI : event.params.amount.times(deposit.bdv).div(deposit.amount);

  // Update deposit
  deposit.withdrawnBDV = deposit.withdrawnBDV.plus(withdrawnBDV);
  deposit.bdv = deposit.bdv.minus(withdrawnBDV);
  deposit.withdrawnAmount = deposit.withdrawnAmount.plus(event.params.amount);
  deposit.amount = deposit.amount.minus(event.params.amount);
  deposit.save();

  // Update protocol totals
  removeDepositFromSilo(event.address, beanstalk.lastSeason, withdrawnBDV, event.block.timestamp, event.block.number);
  removeDepositFromSiloAsset(
    event.address,
    event.params.token,
    beanstalk.lastSeason,
    withdrawnBDV,
    event.params.amount,
    event.block.timestamp,
    event.block.number
  );

  // Update farmer totals
  removeDepositFromSilo(event.params.account, beanstalk.lastSeason, withdrawnBDV, event.block.timestamp, event.block.number);
  removeDepositFromSiloAsset(
    event.params.account,
    event.params.token,
    beanstalk.lastSeason,
    withdrawnBDV,
    event.params.amount,
    event.block.timestamp,
    event.block.number
  );

  let id = "removeDeposit-" + event.transaction.hash.toHexString() + "-" + event.transactionLogIndex.toString();
  let removal = new RemoveDepositEntity(id);
  removal.hash = event.transaction.hash.toHexString();
  removal.logIndex = event.transactionLogIndex.toI32();
  removal.protocol = event.address.toHexString();
  removal.account = event.params.account.toHexString();
  removal.token = event.params.token.toHexString();
  removal.season = event.params.season.toI32();
  removal.amount = event.params.amount;
  removal.blockNumber = event.block.number;
  removal.createdAt = event.block.timestamp;
  removal.save();
}

export function handleRemoveDeposits(event: RemoveDeposits): void {
  let beanstalk = loadBeanstalk(event.address); // get current season

  for (let i = 0; i < event.params.seasons.length; i++) {
    let deposit = loadSiloDeposit(event.params.account, event.params.token, event.params.seasons[i]);

    let withdrawnBDV = deposit.amount == ZERO_BI ? ZERO_BI : event.params.amounts[i].times(deposit.bdv).div(deposit.amount);

    // Update deposit
    deposit.withdrawnBDV = deposit.withdrawnBDV.plus(withdrawnBDV);
    deposit.bdv = deposit.bdv.minus(withdrawnBDV);
    deposit.withdrawnAmount = deposit.withdrawnAmount.plus(event.params.amounts[i]);
    deposit.amount = deposit.amount.minus(event.params.amounts[i]);
    deposit.save();

    // Update protocol totals
    removeDepositFromSilo(event.address, beanstalk.lastSeason, withdrawnBDV, event.block.timestamp, event.block.number);
    removeDepositFromSiloAsset(
      event.address,
      event.params.token,
      beanstalk.lastSeason,
      withdrawnBDV,
      event.params.amounts[i],
      event.block.timestamp,
      event.block.number
    );

    // Update farmer totals
    removeDepositFromSilo(event.params.account, beanstalk.lastSeason, withdrawnBDV, event.block.timestamp, event.block.number);
    removeDepositFromSiloAsset(
      event.params.account,
      event.params.token,
      beanstalk.lastSeason,
      withdrawnBDV,
      event.params.amounts[i],
      event.block.timestamp,
      event.block.number
    );

    let id = "removeDeposit-" + event.transaction.hash.toHexString() + "-" + event.transactionLogIndex.toString() + "-" + i.toString();
    let removal = new RemoveDepositEntity(id);
    removal.hash = event.transaction.hash.toHexString();
    removal.logIndex = event.transactionLogIndex.toI32();
    removal.protocol = event.address.toHexString();
    removal.account = event.params.account.toHexString();
    removal.token = event.params.token.toHexString();
    removal.season = event.params.seasons[i].toI32();
    removal.amount = event.params.amounts[i];
    removal.blockNumber = event.block.number;
    removal.createdAt = event.block.timestamp;
    removal.save();
  }
}

export function handleAddWithdrawal(event: AddWithdrawal): void {
  let withdraw = loadSiloWithdraw(event.params.account, event.params.token, event.params.season.toI32());
  withdraw.amount = event.params.amount;
  let withdrawHashes = withdraw.hashes;
  withdrawHashes.push(event.transaction.hash.toHexString());
  withdraw.hashes = withdrawHashes;
  withdraw.createdAt = event.block.timestamp;
  withdraw.save();

  addWithdrawToSiloAsset(
    event.address,
    event.params.token,
    event.params.season.toI32(),
    event.params.amount,
    event.block.timestamp,
    event.block.number
  );
  addWithdrawToSiloAsset(
    event.params.account,
    event.params.token,
    event.params.season.toI32(),
    event.params.amount,
    event.block.timestamp,
    event.block.number
  );
}

export function handleRemoveWithdrawal(event: RemoveWithdrawal): void {
  updateClaimedWithdraw(event.params.account, event.params.token, event.params.season);
}

export function handleRemoveWithdrawals(event: RemoveWithdrawals): void {
  for (let i = 0; i < event.params.seasons.length; i++) {
    updateClaimedWithdraw(event.params.account, event.params.token, event.params.seasons[i]);
  }
}

export function handleStalkBalanceChanged(event: StalkBalanceChanged): void {
  // Exclude BIP-24 emission of missed past events
  if (event.transaction.hash.toHexString() == "0xa89638aeb0d6c4afb4f367ea7a806a4c8b3b2a6eeac773e8cc4eda10bfa804fc") return;

  let beanstalk = loadBeanstalk(event.address); // get current season
  updateStalkBalances(
    event.address,
    beanstalk.lastSeason,
    event.params.delta,
    event.params.deltaRoots,
    event.block.timestamp,
    event.block.number
  );
  updateStalkBalances(
    event.params.account,
    beanstalk.lastSeason,
    event.params.delta,
    event.params.deltaRoots,
    event.block.timestamp,
    event.block.number
  );

  let id = "stalkChange-" + event.transaction.hash.toHexString() + "-" + event.transactionLogIndex.toString();
  let removal = new StalkChange(id);
  removal.hash = event.transaction.hash.toHexString();
  removal.logIndex = event.transactionLogIndex.toI32();
  removal.protocol = event.address.toHexString();
  removal.account = event.params.account.toHexString();
  removal.delta = event.params.delta;
  removal.season = beanstalk.lastSeason;
  removal.blockNumber = event.block.number;
  removal.createdAt = event.block.timestamp;
  removal.save();
}

export function handleSeedsBalanceChanged(event: StalkBalanceChanged): void {
  // Exclude BIP-24 emission of missed past events
  if (event.transaction.hash.toHexString() == "0xa89638aeb0d6c4afb4f367ea7a806a4c8b3b2a6eeac773e8cc4eda10bfa804fc") return;

  let beanstalk = loadBeanstalk(event.address); // get current season
  updateSeedsBalances(event.address, beanstalk.lastSeason, event.params.delta, event.block.timestamp, event.block.number);
  updateSeedsBalances(event.params.account, beanstalk.lastSeason, event.params.delta, event.block.timestamp, event.block.number);

  let id = "seedChange-" + event.transaction.hash.toHexString() + "-" + event.transactionLogIndex.toString();
  let removal = new SeedChange(id);
  removal.hash = event.transaction.hash.toHexString();
  removal.logIndex = event.transactionLogIndex.toI32();
  removal.protocol = event.address.toHexString();
  removal.account = event.params.account.toHexString();
  removal.delta = event.params.delta;
  removal.season = beanstalk.lastSeason;
  removal.blockNumber = event.block.number;
  removal.createdAt = event.block.timestamp;
  removal.save();
}

export function handlePlant(event: Plant): void {
  // This removes the plantable stalk for planted beans.
  // Actual stalk credit for the farmer will be handled under the StalkBalanceChanged event.

  let beanstalk = loadBeanstalk(event.address);
  let silo = loadSilo(event.address);
  let siloHourly = loadSiloHourlySnapshot(event.address, beanstalk.lastSeason, event.block.timestamp);
  let siloDaily = loadSiloDailySnapshot(event.address, event.block.timestamp);
  let newPlantableStalk = event.params.beans.times(BigInt.fromI32(10000));

  silo.plantableStalk = silo.plantableStalk.minus(newPlantableStalk);
  silo.depositedBDV = silo.depositedBDV.minus(event.params.beans);
  silo.save();

  siloHourly.plantableStalk = silo.plantableStalk;
  siloHourly.depositedBDV = silo.depositedBDV;
  siloHourly.deltaPlantableStalk = siloHourly.deltaPlantableStalk.minus(newPlantableStalk);
  siloHourly.deltaDepositedBDV = siloHourly.deltaDepositedBDV.minus(event.params.beans);
  siloHourly.updatedAt = event.block.timestamp;
  siloHourly.save();

  siloDaily.plantableStalk = silo.plantableStalk;
  siloDaily.depositedBDV = silo.depositedBDV;
  siloDaily.deltaPlantableStalk = siloDaily.deltaPlantableStalk.minus(newPlantableStalk);
  siloDaily.deltaDepositedBDV = siloDaily.deltaDepositedBDV.minus(event.params.beans);
  siloDaily.updatedAt = event.block.timestamp;
  siloDaily.save();

  removeDepositFromSiloAsset(
    event.address,
    BEAN_ERC20,
    beanstalk.lastSeason,
    event.params.beans,
    event.params.beans,
    event.block.timestamp,
    event.block.number
  );
}

export function handleTransferDepositCall(call: TransferDepositCall): void {
  let beanstalk = loadBeanstalk(BEANSTALK);
  let updateFarmers = beanstalk.farmersToUpdate;
  if (updateFarmers.indexOf(call.from.toHexString()) == -1) updateFarmers.push(call.from.toHexString());
  if (updateFarmers.indexOf(call.inputs.recipient.toHexString()) == -1) updateFarmers.push(call.inputs.recipient.toHexString());
  beanstalk.farmersToUpdate = updateFarmers;
  beanstalk.save();
}

export function handleTransferDepositsCall(call: TransferDepositsCall): void {
  let beanstalk = loadBeanstalk(BEANSTALK);
  let updateFarmers = beanstalk.farmersToUpdate;
  if (updateFarmers.indexOf(call.from.toHexString()) == -1) updateFarmers.push(call.from.toHexString());
  if (updateFarmers.indexOf(call.inputs.recipient.toHexString()) == -1) updateFarmers.push(call.inputs.recipient.toHexString());
  beanstalk.farmersToUpdate = updateFarmers;
  beanstalk.save();
}

function addDepositToSilo(account: Address, season: i32, bdv: BigInt, timestamp: BigInt, blockNumber: BigInt): void {
  let silo = loadSilo(account);
  let siloHourly = loadSiloHourlySnapshot(account, season, timestamp);
  let siloDaily = loadSiloDailySnapshot(account, timestamp);

  silo.depositedBDV = silo.depositedBDV.plus(bdv);
  silo.save();

  siloHourly.deltaDepositedBDV = siloHourly.deltaDepositedBDV.plus(bdv);
  siloHourly.depositedBDV = silo.depositedBDV;
  siloHourly.updatedAt = timestamp;
  siloHourly.save();

  siloDaily.season = season;
  siloDaily.deltaDepositedBDV = siloDaily.deltaDepositedBDV.plus(bdv);
  siloDaily.depositedBDV = silo.depositedBDV;
  siloDaily.updatedAt = timestamp;
  siloDaily.save();
}

function removeDepositFromSilo(account: Address, season: i32, bdv: BigInt, timestamp: BigInt, blockNumber: BigInt): void {
  let silo = loadSilo(account);
  let siloHourly = loadSiloHourlySnapshot(account, season, timestamp);
  let siloDaily = loadSiloDailySnapshot(account, timestamp);

  silo.depositedBDV = silo.depositedBDV.minus(bdv);
  silo.save();

  siloHourly.deltaDepositedBDV = siloHourly.deltaDepositedBDV.minus(bdv);
  siloHourly.depositedBDV = silo.depositedBDV;
  siloHourly.updatedAt = timestamp;
  siloHourly.save();

  siloDaily.season = season;
  siloDaily.deltaDepositedBDV = siloDaily.deltaDepositedBDV.minus(bdv);
  siloDaily.depositedBDV = silo.depositedBDV;
  siloDaily.updatedAt = timestamp;
  siloDaily.save();
}

export function addDepositToSiloAsset(
  account: Address,
  token: Address,
  season: i32,
  bdv: BigInt,
  amount: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  let asset = loadSiloAsset(account, token);
  let assetHourly = loadSiloAssetHourlySnapshot(account, token, season, timestamp);
  let assetDaily = loadSiloAssetDailySnapshot(account, token, timestamp);

  asset.depositedBDV = asset.depositedBDV.plus(bdv);
  asset.depositedAmount = asset.depositedAmount.plus(amount);
  asset.save();

  assetHourly.deltaDepositedBDV = assetHourly.deltaDepositedBDV.plus(bdv);
  assetHourly.depositedBDV = asset.depositedBDV;
  assetHourly.deltaDepositedAmount = assetHourly.deltaDepositedAmount.plus(amount);
  assetHourly.depositedAmount = asset.depositedAmount;
  assetHourly.updatedAt = timestamp;
  assetHourly.save();

  assetDaily.season = season;
  assetDaily.deltaDepositedBDV = assetDaily.deltaDepositedBDV.plus(bdv);
  assetDaily.depositedBDV = asset.depositedBDV;
  assetDaily.deltaDepositedAmount = assetDaily.deltaDepositedAmount.plus(amount);
  assetDaily.depositedAmount = asset.depositedAmount;
  assetDaily.updatedAt = timestamp;
  assetDaily.save();
}

function removeDepositFromSiloAsset(
  account: Address,
  token: Address,
  season: i32,
  bdv: BigInt,
  amount: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  let asset = loadSiloAsset(account, token);
  let assetHourly = loadSiloAssetHourlySnapshot(account, token, season, timestamp);
  let assetDaily = loadSiloAssetDailySnapshot(account, token, timestamp);

  asset.depositedBDV = asset.depositedBDV.minus(bdv);
  asset.depositedAmount = asset.depositedAmount.minus(amount);
  asset.save();

  assetHourly.deltaDepositedBDV = assetHourly.deltaDepositedBDV.minus(bdv);
  assetHourly.depositedBDV = asset.depositedBDV;
  assetHourly.deltaDepositedAmount = assetHourly.deltaDepositedAmount.minus(amount);
  assetHourly.depositedAmount = asset.depositedAmount;
  assetHourly.updatedAt = timestamp;
  assetHourly.save();

  assetDaily.season = season;
  assetDaily.deltaDepositedBDV = assetDaily.deltaDepositedBDV.minus(bdv);
  assetDaily.depositedBDV = asset.depositedBDV;
  assetDaily.deltaDepositedAmount = assetDaily.deltaDepositedAmount.minus(amount);
  assetDaily.depositedAmount = asset.depositedAmount;
  assetDaily.updatedAt = timestamp;
  assetDaily.save();
}

function addWithdrawToSiloAsset(
  account: Address,
  token: Address,
  season: i32,
  amount: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  let assetHourly = loadSiloAssetHourlySnapshot(account, token, season, timestamp);
  let assetDaily = loadSiloAssetDailySnapshot(account, token, timestamp);

  assetHourly.deltaWithdrawnAmount = assetHourly.deltaWithdrawnAmount.plus(amount);
  assetHourly.updatedAt = timestamp;
  assetHourly.save();

  assetDaily.season = season;
  assetDaily.deltaWithdrawnAmount = assetDaily.deltaWithdrawnAmount.plus(amount);
  assetDaily.updatedAt = timestamp;
  assetDaily.save();
}

function updateStalkBalances(account: Address, season: i32, stalk: BigInt, roots: BigInt, timestamp: BigInt, blockNumber: BigInt): void {
  let silo = loadSilo(account);
  let siloHourly = loadSiloHourlySnapshot(account, season, timestamp);
  let siloDaily = loadSiloDailySnapshot(account, timestamp);

  silo.stalk = silo.stalk.plus(stalk);
  silo.roots = silo.roots.plus(roots);
  silo.save();

  siloHourly.stalk = silo.stalk;
  siloHourly.roots = silo.roots;
  siloHourly.deltaStalk = siloHourly.deltaStalk.plus(stalk);
  siloHourly.deltaRoots = siloHourly.deltaRoots.plus(roots);
  siloHourly.updatedAt = timestamp;
  siloHourly.save();

  siloDaily.season = season;
  siloDaily.stalk = silo.stalk;
  siloDaily.roots = silo.roots;
  siloDaily.deltaStalk = siloDaily.deltaStalk.plus(stalk);
  siloDaily.deltaRoots = siloDaily.deltaRoots.plus(roots);
  siloDaily.updatedAt = timestamp;
  siloDaily.save();

  // Add account to active list if needed
  if (account !== BEANSTALK) {
    let beanstalk = loadBeanstalk(BEANSTALK);
    let farmerIndex = beanstalk.activeFarmers.indexOf(account.toHexString());
    if (farmerIndex == -1) {
      let newFarmers = beanstalk.activeFarmers;
      newFarmers.push(account.toHexString());
      beanstalk.activeFarmers = newFarmers;
      beanstalk.save();

      incrementProtocolFarmers(season, timestamp);
    } else if (silo.stalk == ZERO_BI) {
      let newFarmers = beanstalk.activeFarmers;
      newFarmers.splice(farmerIndex, 1);
      beanstalk.activeFarmers = newFarmers;

      decrementProtocolFarmers(season, timestamp);
    }
  }
}

function updateSeedsBalances(account: Address, season: i32, seeds: BigInt, timestamp: BigInt, blockNumber: BigInt): void {
  let silo = loadSilo(account);
  let siloHourly = loadSiloHourlySnapshot(account, season, timestamp);
  let siloDaily = loadSiloDailySnapshot(account, timestamp);

  silo.seeds = silo.seeds.plus(seeds);
  silo.save();

  siloHourly.seeds = silo.seeds;
  siloHourly.deltaSeeds = siloHourly.deltaSeeds.plus(seeds);
  siloHourly.updatedAt = timestamp;
  siloHourly.save();

  siloDaily.season = season;
  siloDaily.seeds = silo.seeds;
  siloDaily.deltaSeeds = siloDaily.deltaSeeds.plus(seeds);
  siloDaily.updatedAt = timestamp;
  siloDaily.save();
}

function updateClaimedWithdraw(account: Address, token: Address, season: BigInt): void {
  let withdraw = loadSiloWithdraw(account, token, season.toI32());
  withdraw.claimed = true;
  withdraw.save();
}

function incrementProtocolFarmers(season: i32, timestamp: BigInt): void {
  let silo = loadSilo(BEANSTALK);
  let siloHourly = loadSiloHourlySnapshot(BEANSTALK, season, timestamp);
  let siloDaily = loadSiloDailySnapshot(BEANSTALK, timestamp);

  silo.activeFarmers += 1;
  siloHourly.activeFarmers += 1;
  siloHourly.deltaActiveFarmers += 1;
  siloDaily.activeFarmers += 1;
  siloDaily.deltaActiveFarmers += 1;
  silo.save();
  siloHourly.save();
  siloDaily.save();
}

function decrementProtocolFarmers(season: i32, timestamp: BigInt): void {
  let silo = loadSilo(BEANSTALK);
  let siloHourly = loadSiloHourlySnapshot(BEANSTALK, season, timestamp);
  let siloDaily = loadSiloDailySnapshot(BEANSTALK, timestamp);

  silo.activeFarmers -= 1;
  siloHourly.activeFarmers -= 1;
  siloHourly.deltaActiveFarmers -= 1;
  siloDaily.activeFarmers -= 1;
  siloDaily.deltaActiveFarmers -= 1;
  silo.save();
  siloHourly.save();
  siloDaily.save();
}

export function updateStalkWithCalls(season: i32, timestamp: BigInt, blockNumber: BigInt): void {
  // This should be run at sunrise for the previous season to update any farmers stalk/seed/roots balances from silo transfers.

  let beanstalk = loadBeanstalk(BEANSTALK);
  let beanstalk_call = Beanstalk.bind(BEANSTALK);

  for (let i = 0; i < beanstalk.farmersToUpdate.length; i++) {
    let account = Address.fromString(beanstalk.farmersToUpdate[i]);
    let silo = loadSilo(account);
    updateStalkBalances(
      account,
      season,
      beanstalk_call.balanceOfStalk(account).minus(silo.stalk),
      beanstalk_call.balanceOfRoots(account).minus(silo.roots),
      timestamp,
      blockNumber
    );
    updateSeedsBalances(account, season, beanstalk_call.balanceOfSeeds(account).minus(silo.seeds), timestamp, blockNumber);
  }
  beanstalk.farmersToUpdate = [];
  beanstalk.save();
}

export function handleWhitelistToken(event: WhitelistToken): void {
  let silo = loadSilo(event.address);
  let currentList = silo.whitelistedTokens;
  if (currentList.length == 0) {
    // Push unripe bean and unripe bean:3crv upon the initial whitelisting.
    currentList.push(UNRIPE_BEAN.toHexString());
    currentList.push(UNRIPE_BEAN_3CRV.toHexString());
  }
  currentList.push(event.params.token.toHexString());
  silo.whitelistedTokens = currentList;
  silo.save();

  let id = "whitelistToken-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let rawEvent = new WhitelistTokenEntity(id);
  rawEvent.hash = event.transaction.hash.toHexString();
  rawEvent.logIndex = event.logIndex.toI32();
  rawEvent.protocol = event.address.toHexString();
  rawEvent.token = event.params.token.toHexString();
  rawEvent.stalk = event.params.stalk;
  rawEvent.seeds = event.params.seeds;
  rawEvent.selector = event.params.selector.toHexString();
  rawEvent.blockNumber = event.block.number;
  rawEvent.createdAt = event.block.timestamp;
  rawEvent.save();
}

export function handleDewhitelistToken(event: DewhitelistToken): void {
  let silo = loadSilo(event.address);
  let currentList = silo.whitelistedTokens;
  let index = currentList.indexOf(event.params.token.toHexString());
  currentList.splice(index, 1);
  silo.whitelistedTokens = currentList;
  silo.save();

  let id = "dewhitelistToken-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let rawEvent = new DewhitelistTokenEntity(id);
  rawEvent.hash = event.transaction.hash.toHexString();
  rawEvent.logIndex = event.logIndex.toI32();
  rawEvent.protocol = event.address.toHexString();
  rawEvent.token = event.params.token.toHexString();
  rawEvent.blockNumber = event.block.number;
  rawEvent.createdAt = event.block.timestamp;
  rawEvent.save();
}
