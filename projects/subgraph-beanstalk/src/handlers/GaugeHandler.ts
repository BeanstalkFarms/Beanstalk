import {
  BeanToMaxLpGpPerBdvRatioChange,
  GaugePointChange,
  UpdateAverageStalkPerBdvPerSeason,
  FarmerGerminatingStalkBalanceChanged,
  TotalGerminatingBalanceChanged,
  UpdateGaugeSettings,
  TotalGerminatingStalkChanged,
  TotalStalkChangedFromGermination
} from "../../generated/Beanstalk-ABIs/SeedGauge";
import {
  deleteGerminating,
  germinationEnumCategory,
  germinationSeasonCategory,
  getFarmerGerminatingBugOffset,
  loadGerminating,
  loadOrCreateGerminating,
  savePrevFarmerGerminatingEvent
} from "../entities/Germinating";
import { BI_10, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { BEAN_WETH_CP2_WELL } from "../../../subgraph-core/utils/Constants";
import { Bytes4_emptyToNull } from "../../../subgraph-core/utils/Bytes";
import { setSiloHourlyCaseId, takeSiloSnapshots } from "../entities/snapshots/Silo";
import { loadSilo, loadWhitelistTokenSetting } from "../entities/Silo";
import { takeWhitelistTokenSettingSnapshots } from "../entities/snapshots/WhitelistTokenSetting";
import { getCurrentSeason } from "../entities/Beanstalk";
import { updateStalkBalances } from "../utils/Silo";

// SEED GAUGE SEASONAL ADJUSTMENTS //

export function handleBeanToMaxLpGpPerBdvRatioChange(event: BeanToMaxLpGpPerBdvRatioChange): void {
  let silo = loadSilo(event.address);

  if (silo.beanToMaxLpGpPerBdvRatio === null) {
    silo.beanToMaxLpGpPerBdvRatio = event.params.absChange;
  } else {
    silo.beanToMaxLpGpPerBdvRatio = silo.beanToMaxLpGpPerBdvRatio!.plus(event.params.absChange);
  }
  takeSiloSnapshots(silo, event.address, event.block.timestamp);
  setSiloHourlyCaseId(event.params.caseId, silo);
  silo.save();
}

export function handleGaugePointChange(event: GaugePointChange): void {
  let siloSettings = loadWhitelistTokenSetting(event.params.token);
  siloSettings.gaugePoints = event.params.gaugePoints;
  siloSettings.updatedAt = event.block.timestamp;

  takeWhitelistTokenSettingSnapshots(siloSettings, event.address, event.block.timestamp);
  siloSettings.save();
}

export function handleUpdateAverageStalkPerBdvPerSeason(event: UpdateAverageStalkPerBdvPerSeason): void {
  let silo = loadSilo(event.address);

  // This is not exactly accurate, the value in this event is pertaining to gauge only and does not include unripe.
  // In practice, seed values for non-gauge assets are negligible.
  // The correct approach is iterating whitelisted assets each season, multipying bdv and seeds
  silo.grownStalkPerSeason = silo.depositedBDV.times(event.params.newStalkPerBdvPerSeason);
  takeSiloSnapshots(silo, event.address, event.block.timestamp);
  silo.save();

  // Individual asset grown stalk is set by the UpdatedStalkPerBdvPerSeason event.
}

// GERMINATING STALK //

// Tracks germinating balances for individual famers
export function handleFarmerGerminatingStalkBalanceChanged(event: FarmerGerminatingStalkBalanceChanged): void {
  if (event.params.deltaGerminatingStalk == ZERO_BI) {
    return;
  }

  const currentSeason = getCurrentSeason(event.address);

  if (event.params.deltaGerminatingStalk > ZERO_BI) {
    // Germinating stalk is added. It is possible to begin germination in the prior season rather than the
    // current season when converting. See ConvertFacet._depositTokensForConvert for more information.
    // If the event's germinationState doesnt match with the current season, use the prior season.
    const germinatingSeason =
      germinationSeasonCategory(currentSeason) === germinationEnumCategory(event.params.germinationState)
        ? currentSeason
        : currentSeason - 1;

    let farmerGerminating = loadOrCreateGerminating(event.params.account, germinatingSeason, true);
    farmerGerminating.stalk = farmerGerminating.stalk.plus(event.params.deltaGerminatingStalk);
    farmerGerminating.save();
  } else {
    // Adjusts for the event's inherent bug when both even/odd germination complete in the same txn
    const bugfixStalkOffset = getFarmerGerminatingBugOffset(event.params.account, event);
    const actualDeltaGerminatingStalk = event.params.deltaGerminatingStalk.plus(bugfixStalkOffset);

    // Germinating stalk is being removed. It therefore must have created the entity already
    let farmerGerminating = loadGerminating(event.params.account, event.params.germinationState);
    farmerGerminating.stalk = farmerGerminating.stalk.plus(actualDeltaGerminatingStalk);
    if (farmerGerminating.stalk == ZERO_BI) {
      deleteGerminating(farmerGerminating);
    } else {
      farmerGerminating.save();
    }

    if (currentSeason >= farmerGerminating.season + 2) {
      // If germination finished, need to subtract stalk from system silo. This stalk was already added
      // into system stalk upon sunrise for season - 2.
      let systemSilo = loadSilo(event.address);
      systemSilo.stalk = systemSilo.stalk.plus(actualDeltaGerminatingStalk);
      takeSiloSnapshots(systemSilo, event.address, event.block.timestamp);
      systemSilo.save();
    }

    // Also for the event bug adjustment
    savePrevFarmerGerminatingEvent(event.params.account, event, event.params.deltaGerminatingStalk);
  }

  let farmerSilo = loadSilo(event.params.account);
  farmerSilo.germinatingStalk = farmerSilo.germinatingStalk.plus(event.params.deltaGerminatingStalk);
  takeSiloSnapshots(farmerSilo, event.address, event.block.timestamp);
  farmerSilo.save();
}

// Tracks the germinating balance on a token level
export function handleTotalGerminatingBalanceChanged(event: TotalGerminatingBalanceChanged): void {
  if (event.params.deltaAmount == ZERO_BI && event.params.deltaBdv == ZERO_BI) {
    return;
  }

  let tokenGerminating = loadOrCreateGerminating(event.params.token, event.params.germinationSeason.toU32(), false);
  tokenGerminating.season = event.params.germinationSeason.toU32();
  tokenGerminating.tokenAmount = tokenGerminating.tokenAmount.plus(event.params.deltaAmount);
  tokenGerminating.bdv = tokenGerminating.bdv.plus(event.params.deltaBdv);
  if (tokenGerminating.tokenAmount == ZERO_BI) {
    deleteGerminating(tokenGerminating);
  } else {
    tokenGerminating.save();
  }
}

// This occurs at the beanstalk level regardless of whether users mow their own germinating stalk into regular stalk.
// It can also occur if a user withdraws early, before the germinating period completes.
export function handleTotalGerminatingStalkChanged(event: TotalGerminatingStalkChanged): void {
  if (event.params.deltaGerminatingStalk == ZERO_BI) {
    return;
  }

  let siloGerminating = loadOrCreateGerminating(event.address, event.params.germinationSeason.toU32(), false);
  siloGerminating.season = event.params.germinationSeason.toU32();
  siloGerminating.stalk = siloGerminating.stalk.plus(event.params.deltaGerminatingStalk);
  // Don't delete this entity as the overall silo germinating stalk entity is likely to be recreated frequently.
  siloGerminating.save();

  let silo = loadSilo(event.address);
  silo.germinatingStalk = silo.germinatingStalk.plus(event.params.deltaGerminatingStalk);
  takeSiloSnapshots(silo, event.address, event.block.timestamp);
  silo.save();
}

// Germination completes, germinating stalk turns into stalk.
// The removal of Germinating stalk would have already been handled from a separate emission
export function handleTotalStalkChangedFromGermination(event: TotalStalkChangedFromGermination): void {
  updateStalkBalances(event.address, event.address, event.params.deltaStalk, event.params.deltaRoots, event.block.timestamp);
}

// GAUGE CONFIGURATION SETTINGS //

export function handleUpdateGaugeSettings(event: UpdateGaugeSettings): void {
  let siloSettings = loadWhitelistTokenSetting(event.params.token);
  siloSettings.gpSelector = Bytes4_emptyToNull(event.params.gpSelector);
  siloSettings.lwSelector = Bytes4_emptyToNull(event.params.lwSelector);
  siloSettings.optimalPercentDepositedBdv = event.params.optimalPercentDepositedBdv;
  siloSettings.updatedAt = event.block.timestamp;

  // On initial gauge deployment, there was no GaugePointChange event emitted. Need to initialize BEANETH here
  if (
    event.params.token == BEAN_WETH_CP2_WELL &&
    event.transaction.hash.toHexString().toLowerCase() == "0x299a4b93b8d19f8587b648ce04e3f5e618ea461426bb2b2337993b5d6677f6a7"
  ) {
    siloSettings.gaugePoints = BI_10.pow(20);
  }

  takeWhitelistTokenSettingSnapshots(siloSettings, event.address, event.block.timestamp);
  siloSettings.save();
}
