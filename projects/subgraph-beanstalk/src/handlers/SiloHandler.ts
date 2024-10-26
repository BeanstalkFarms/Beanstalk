import { addDeposits, removeDeposits, setWhitelistTokenSettings, updateDepositInSiloAsset, updateStalkBalances } from "../utils/Silo";
import { addToSiloWhitelist, loadSilo, loadWhitelistTokenSetting } from "../entities/Silo";
import { takeSiloSnapshots } from "../entities/snapshots/Silo";
import { takeWhitelistTokenSettingSnapshots } from "../entities/snapshots/WhitelistTokenSetting";
import {
  AddDeposit,
  Convert,
  DewhitelistToken,
  Plant,
  RemoveDeposit,
  RemoveDeposits,
  StalkBalanceChanged,
  UpdatedStalkPerBdvPerSeason,
  UpdateWhitelistStatus
} from "../../generated/Beanstalk-ABIs/Reseed";
import { unripeChopped } from "../utils/Barn";
import { beanDecimals, getProtocolToken, isUnripe, stalkDecimals } from "../../../subgraph-core/constants/RuntimeConstants";
import { v } from "../utils/constants/Version";
import { WhitelistToken } from "../../generated/Beanstalk-ABIs/Reseed";
import { BI_10 } from "../../../subgraph-core/utils/Decimals";

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
  if (isUnripe(v(), event.params.fromToken) && !isUnripe(v(), event.params.toToken)) {
    unripeChopped({
      event,
      type: "convert",
      account: event.params.account,
      unripeToken: event.params.fromToken,
      unripeAmount: event.params.fromAmount,
      underlyingAmount: event.params.toAmount
    });
  }
}

export function handleStalkBalanceChanged(event: StalkBalanceChanged): void {
  // Exclude BIP-24 emission of missed past events
  if (event.transaction.hash.toHexString() == "0xa89638aeb0d6c4afb4f367ea7a806a4c8b3b2a6eeac773e8cc4eda10bfa804fc") {
    return;
  }

  updateStalkBalances(event.address, event.params.account, event.params.delta, event.params.deltaRoots, event.block);
}

export function handlePlant(event: Plant): void {
  // This removes the plantable stalk for planted beans.
  // Actual stalk credit for the farmer will be handled under the StalkBalanceChanged event.

  let silo = loadSilo(event.address);
  let newPlantableStalk = event.params.beans.times(BI_10.pow(<u8>(stalkDecimals(v()) - beanDecimals())));

  // Subtract stalk since it was already added in Reward, and is about to get re-added in StalkBalanceChanged.
  silo.stalk = silo.stalk.minus(newPlantableStalk);
  silo.plantableStalk = silo.plantableStalk.minus(newPlantableStalk);
  silo.depositedBDV = silo.depositedBDV.minus(event.params.beans);

  takeSiloSnapshots(silo, event.block);
  silo.save();

  // Remove the protocol asset amount that got added in Reward event handler.
  // Will be immediately re-credited to the user/system in AddDeposit
  updateDepositInSiloAsset(
    event.address,
    event.address,
    getProtocolToken(v(), event.block.number),
    event.params.beans.neg(),
    event.params.beans.neg(),
    event.block
  );
}

export function handleWhitelistToken(event: WhitelistToken): void {
  addToSiloWhitelist(event.address, event.params.token);
  setWhitelistTokenSettings({
    token: event.params.token,
    selector: event.params.selector,
    stalkEarnedPerSeason: event.params.stalkEarnedPerSeason,
    stalkIssuedPerBdv: event.params.stalkIssuedPerBdv,
    gaugePoints: event.params.gaugePoints,
    optimalPercentDepositedBdv: event.params.optimalPercentDepositedBdv,
    block: event.block
  });
}

export function handleUpdateWhitelistStatus(event: UpdateWhitelistStatus): void {
  let siloSettings = loadWhitelistTokenSetting(event.params.token);
  siloSettings.isGaugeEnabled = event.params.isWhitelistedWell;
  takeWhitelistTokenSettingSnapshots(siloSettings, event.block);
  siloSettings.save();
}

export function handleDewhitelistToken(event: DewhitelistToken): void {
  let silo = loadSilo(event.address);
  let currentWhitelist = silo.whitelistedTokens;
  let currentDewhitelist = silo.dewhitelistedTokens;
  let index = currentWhitelist.indexOf(event.params.token);
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

  takeWhitelistTokenSettingSnapshots(siloSettings, event.block);
  siloSettings.save();
}
