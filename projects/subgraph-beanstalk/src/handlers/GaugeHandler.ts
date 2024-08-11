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
import { deleteGerminating, loadGerminating, loadOrCreateGerminating } from "../entities/Germinating";
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
  setSiloHourlyCaseId(event.params.caseId, silo, event.address);
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
    // Germinating stalk is being added in the current season
    let farmerGerminating = loadOrCreateGerminating(event.params.account, currentSeason, true);
    farmerGerminating.stalk = farmerGerminating.stalk.plus(event.params.deltaGerminatingStalk);
    farmerGerminating.save();
  } else {
    // Germinating stalk is being removed. It therefore must have created the entity already
    let farmerGerminating = loadGerminating(event.params.account, event.params.germinationState);
    farmerGerminating.stalk = farmerGerminating.stalk.plus(event.params.deltaGerminatingStalk);
    if (farmerGerminating.stalk == ZERO_BI) {
      deleteGerminating(farmerGerminating);
    } else {
      farmerGerminating.save();
    }

    // Need to subtract stalk from system silo. The finished germinating stalk was already added
    // into system stalk, and there are subsequent StalkBalanceChanged events for this transaction.
    let systemSilo = loadSilo(event.address);
    systemSilo.stalk = systemSilo.stalk.plus(event.params.deltaGerminatingStalk);
    takeSiloSnapshots(systemSilo, event.address, event.block.timestamp);
    systemSilo.save();
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