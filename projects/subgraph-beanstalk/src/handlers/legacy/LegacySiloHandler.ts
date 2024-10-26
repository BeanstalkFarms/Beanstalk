import { BigInt, log } from "@graphprotocol/graph-ts";
import { ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import {
  AddWithdrawal,
  TransferDepositsCall,
  TransferDepositCall,
  WhitelistToken as WhitelistToken_v2,
  AddDeposit as AddDeposit_v2,
  RemoveDeposit as RemoveDeposit_v2,
  RemoveDeposits as RemoveDeposits_v2
} from "../../../generated/Beanstalk-ABIs/Replanted";
import { loadBeanstalk } from "../../entities/Beanstalk";
import { addToSiloWhitelist, loadSiloWithdraw, loadWhitelistTokenSetting } from "../../entities/Silo";
import { addDeposits, addWithdrawToSiloAsset, removeDeposits } from "../../utils/Silo";
import { takeWhitelistTokenSettingSnapshots } from "../../entities/snapshots/WhitelistTokenSetting";
import { WhitelistToken as WhitelistToken_v3 } from "../../../generated/Beanstalk-ABIs/SiloV3";
import { RemoveWithdrawal, RemoveWithdrawals, SeedsBalanceChanged, WhitelistToken } from "../../../generated/Beanstalk-ABIs/SeedGauge";
import { updateClaimedWithdraw } from "../../utils/legacy/LegacySilo";
import { Bytes4_emptySelector } from "../../../../subgraph-core/utils/Bytes";
import { initLegacyUnripe } from "../../utils/legacy/LegacyWhitelist";

// Note: No silo v1 (pre-replant) handlers have been developed.

// Replant -> SiloV3
export function handleAddDeposit_v2(event: AddDeposit_v2): void {
  if (event.params.amount == ZERO_BI && event.params.bdv == ZERO_BI) {
    // During replant there is at least one such event which should be ignored
    return;
  }
  addDeposits({
    event,
    account: event.params.account,
    token: event.params.token,
    seasons: [event.params.season],
    stems: null,
    amounts: [event.params.amount],
    bdvs: [event.params.bdv],
    depositVersion: "season"
  });
}

// Replant -> SiloV3
export function handleRemoveDeposit_v2(event: RemoveDeposit_v2): void {
  removeDeposits({
    event,
    account: event.params.account,
    token: event.params.token,
    seasons: [event.params.season],
    stems: null,
    amounts: [event.params.amount],
    bdvs: null,
    depositVersion: "season"
  });
}

// Replant -> SiloV3
export function handleRemoveDeposits_v2(event: RemoveDeposits_v2): void {
  removeDeposits({
    event,
    account: event.params.account,
    token: event.params.token,
    seasons: event.params.seasons,
    stems: null,
    amounts: event.params.amounts,
    bdvs: null,
    depositVersion: "season"
  });
}

// Replant -> SiloV3
export function handleAddWithdrawal(event: AddWithdrawal): void {
  let withdraw = loadSiloWithdraw(event.params.account, event.params.token, event.params.season.toI32());
  withdraw.amount = withdraw.amount.plus(event.params.amount);
  withdraw.createdAt = withdraw.createdAt == ZERO_BI ? event.block.timestamp : withdraw.createdAt;
  withdraw.save();

  addWithdrawToSiloAsset(event.address, event.params.account, event.params.token, event.params.amount, event.block);
}

// Note: Legacy removals are still possible today, and are therefore not Legacy handlers.

// Replant -> SiloV3
export function handleTransferDepositCall(call: TransferDepositCall): void {
  let beanstalk = loadBeanstalk();
  let updateFarmers = beanstalk.farmersToUpdate;
  if (updateFarmers.indexOf(call.from) == -1) {
    updateFarmers.push(call.from);
  }
  if (updateFarmers.indexOf(call.inputs.recipient) == -1) {
    updateFarmers.push(call.inputs.recipient);
  }
  beanstalk.farmersToUpdate = updateFarmers;
  beanstalk.save();
}

// Replant -> SiloV3
export function handleTransferDepositsCall(call: TransferDepositsCall): void {
  let beanstalk = loadBeanstalk();
  let updateFarmers = beanstalk.farmersToUpdate;
  if (updateFarmers.indexOf(call.from) == -1) {
    updateFarmers.push(call.from);
  }
  if (updateFarmers.indexOf(call.inputs.recipient) == -1) {
    updateFarmers.push(call.inputs.recipient);
  }
  beanstalk.farmersToUpdate = updateFarmers;
  beanstalk.save();
}

// Replant -> SiloV3
export function handleWhitelistToken_v2(event: WhitelistToken_v2): void {
  addToSiloWhitelist(event.address, event.params.token);

  let setting = loadWhitelistTokenSetting(event.params.token);
  setting.selector = event.params.selector;
  setting.stalkIssuedPerBdv = BigInt.fromString("10000000000");
  setting.stalkEarnedPerSeason = event.params.stalk.times(BigInt.fromI32(1000000));
  initLegacyUnripe(setting);

  takeWhitelistTokenSettingSnapshots(setting, event.block);
  setting.save();
}

// SiloV3 -> SeedGauge
export function handleWhitelistToken_v3(event: WhitelistToken_v3): void {
  addToSiloWhitelist(event.address, event.params.token);

  let setting = loadWhitelistTokenSetting(event.params.token);
  setting.selector = event.params.selector;
  setting.stalkIssuedPerBdv = event.params.stalk.times(BigInt.fromI32(1_000_000));
  setting.stalkEarnedPerSeason = event.params.stalkEarnedPerSeason;

  takeWhitelistTokenSettingSnapshots(setting, event.block);
  setting.save();
}

// SeedGauge -> Reseed
export function handleWhitelistToken_v4(event: WhitelistToken): void {
  addToSiloWhitelist(event.address, event.params.token);

  let siloSettings = loadWhitelistTokenSetting(event.params.token);

  siloSettings.selector = event.params.selector;
  siloSettings.stalkEarnedPerSeason = event.params.stalkEarnedPerSeason;
  siloSettings.stalkIssuedPerBdv = event.params.stalkIssuedPerBdv;
  siloSettings.gaugePoints = event.params.gaugePoints;
  siloSettings.isGaugeEnabled = !Bytes4_emptySelector(event.params.gpSelector);
  siloSettings.optimalPercentDepositedBdv = event.params.optimalPercentDepositedBdv;
  siloSettings.updatedAt = event.block.timestamp;

  takeWhitelistTokenSettingSnapshots(siloSettings, event.block);
  siloSettings.save();
}

/// Withdrawal is a legacy feature from replant, but these events were still present until the reseed ///
// Replanted -> Reseed
export function handleRemoveWithdrawal(event: RemoveWithdrawal): void {
  updateClaimedWithdraw(event.address, event.params.account, event.params.token, event.params.season, event.block);
}

// Replanted -> Reseed
export function handleRemoveWithdrawals(event: RemoveWithdrawals): void {
  for (let i = 0; i < event.params.seasons.length; i++) {
    updateClaimedWithdraw(event.address, event.params.account, event.params.token, event.params.seasons[i], event.block);
  }
}
