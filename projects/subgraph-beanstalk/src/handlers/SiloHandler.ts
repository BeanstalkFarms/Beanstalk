import { BigInt, log } from "@graphprotocol/graph-ts";
import { addDeposits, removeDeposits, updateDepositInSiloAsset, updateSeedsBalances, updateStalkBalances } from "../utils/Silo";
import { addToSiloWhitelist, loadSilo, loadWhitelistTokenSetting } from "../entities/Silo";
import { takeSiloSnapshots } from "../entities/snapshots/Silo";
import { takeWhitelistTokenSettingSnapshots } from "../entities/snapshots/WhitelistTokenSetting";
import { Bytes4_emptyToNull } from "../../../subgraph-core/utils/Bytes";
import {
  AddDeposit,
  Convert,
  DewhitelistToken,
  Plant,
  RemoveDeposit,
  RemoveDeposits,
  RemoveWithdrawal,
  RemoveWithdrawals,
  SeedsBalanceChanged,
  StalkBalanceChanged,
  UpdatedStalkPerBdvPerSeason,
  WhitelistToken
} from "../../generated/Beanstalk-ABIs/SeedGauge";
import { updateClaimedWithdraw } from "../utils/legacy/LegacySilo";
import { getProtocolToken, isUnripe } from "../utils/Constants";
import { chopConvert } from "../utils/Barn";

export function handleAddDeposit(event: AddDeposit): void {
  addDeposits({
    event,
    account: event.params.account,
    token: event.params.token,
    seasons: null,
    stems: [event.params.stem],
    amounts: [event.params.amount],
    bdvs: [event.params.bdv],
    depositVersion: "stem"
  });
}

export function handleRemoveDeposit(event: RemoveDeposit): void {
  removeDeposits({
    event,
    account: event.params.account,
    token: event.params.token,
    seasons: null,
    stems: [event.params.stem],
    amounts: [event.params.amount],
    bdvs: [event.params.bdv],
    depositVersion: "stem"
  });
}

export function handleRemoveDeposits(event: RemoveDeposits): void {
  removeDeposits({
    event,
    account: event.params.account,
    token: event.params.token,
    seasons: null,
    stems: event.params.stems,
    amounts: event.params.amounts,
    bdvs: event.params.bdvs,
    depositVersion: "stem"
  });
}

export function handleConvert(event: Convert): void {
  if (isUnripe(event.params.fromToken) && !isUnripe(event.params.toToken)) {
    chopConvert(event);
  }
}

export function handleStalkBalanceChanged(event: StalkBalanceChanged): void {
  // Exclude BIP-24 emission of missed past events
  if (event.transaction.hash.toHexString() == "0xa89638aeb0d6c4afb4f367ea7a806a4c8b3b2a6eeac773e8cc4eda10bfa804fc") {
    return;
  }

  updateStalkBalances(event.address, event.params.account, event.params.delta, event.params.deltaRoots, event.block.timestamp);
}

export function handleSeedsBalanceChanged(event: SeedsBalanceChanged): void {
  // Exclude BIP-24 emission of missed past events
  if (event.transaction.hash.toHexString() == "0xa89638aeb0d6c4afb4f367ea7a806a4c8b3b2a6eeac773e8cc4eda10bfa804fc") {
    return;
  }

  updateSeedsBalances(event.address, event.params.account, event.params.delta, event.block.timestamp);
}

export function handlePlant(event: Plant): void {
  // This removes the plantable stalk for planted beans.
  // Actual stalk credit for the farmer will be handled under the StalkBalanceChanged event.

  let silo = loadSilo(event.address);
  let newPlantableStalk = event.params.beans.times(BigInt.fromI32(10000));

  // Subtract stalk since it was already added in Reward, and is about to get re-added in StalkBalanceChanged.
  silo.stalk = silo.stalk.minus(newPlantableStalk);
  silo.plantableStalk = silo.plantableStalk.minus(newPlantableStalk);
  silo.depositedBDV = silo.depositedBDV.minus(event.params.beans);

  takeSiloSnapshots(silo, event.address, event.block.timestamp);
  silo.save();

  // Remove the asset-only amount that got added in Reward event handler.
  // Will be immediately re-credited to the user/system in AddDeposit
  updateDepositInSiloAsset(
    event.address,
    event.address,
    getProtocolToken(event.address),
    event.params.beans,
    event.params.beans,
    event.block.timestamp
  );
}

export function handleWhitelistToken(event: WhitelistToken): void {
  addToSiloWhitelist(event.address, event.params.token);

  let siloSettings = loadWhitelistTokenSetting(event.params.token);

  siloSettings.selector = event.params.selector;
  siloSettings.stalkEarnedPerSeason = event.params.stalkEarnedPerSeason;
  siloSettings.stalkIssuedPerBdv = event.params.stalkIssuedPerBdv;
  siloSettings.gaugePoints = event.params.gaugePoints;
  siloSettings.gpSelector = Bytes4_emptyToNull(event.params.gpSelector);
  siloSettings.lwSelector = Bytes4_emptyToNull(event.params.lwSelector);
  siloSettings.optimalPercentDepositedBdv = event.params.optimalPercentDepositedBdv;
  siloSettings.updatedAt = event.block.timestamp;

  takeWhitelistTokenSettingSnapshots(siloSettings, event.address, event.block.timestamp);
  siloSettings.save();
}

export function handleDewhitelistToken(event: DewhitelistToken): void {
  let silo = loadSilo(event.address);
  let currentWhitelist = silo.whitelistedTokens;
  let currentDewhitelist = silo.dewhitelistedTokens;
  let index = currentWhitelist.indexOf(event.params.token.toHexString());
  if (index >= 0) {
    currentDewhitelist.push(currentWhitelist.splice(index, 1)[0]);
    silo.whitelistedTokens = currentWhitelist;
    silo.dewhitelistedTokens = currentDewhitelist;
    silo.save();
  }
}

export function handleUpdatedStalkPerBdvPerSeason(event: UpdatedStalkPerBdvPerSeason): void {
  let siloSettings = loadWhitelistTokenSetting(event.params.token);
  siloSettings.milestoneSeason = event.params.season.toI32();
  siloSettings.stalkEarnedPerSeason = event.params.stalkEarnedPerSeason;
  siloSettings.updatedAt = event.block.timestamp;

  takeWhitelistTokenSettingSnapshots(siloSettings, event.address, event.block.timestamp);
  siloSettings.save();
}

// Withdrawal is a legacy feature from replant, but these events are still present
export function handleRemoveWithdrawal(event: RemoveWithdrawal): void {
  updateClaimedWithdraw(event.address, event.params.account, event.params.token, event.params.season, event.block.timestamp);
}

export function handleRemoveWithdrawals(event: RemoveWithdrawals): void {
  for (let i = 0; i < event.params.seasons.length; i++) {
    updateClaimedWithdraw(event.address, event.params.account, event.params.token, event.params.seasons[i], event.block.timestamp);
  }
}
