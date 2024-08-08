import {
  BeanToMaxLpGpPerBdvRatioChange,
  GaugePointChange,
  TemperatureChange,
  UpdateAverageStalkPerBdvPerSeason,
  FarmerGerminatingStalkBalanceChanged,
  TotalGerminatingBalanceChanged,
  UpdateGaugeSettings,
  WhitelistToken,
  TotalGerminatingStalkChanged,
  TotalStalkChangedFromGermination
} from "../generated/Beanstalk-ABIs/SeedGauge";
import { handleRateChange } from "./utils/Field";
import { loadSilo, loadWhitelistTokenSetting, addToSiloWhitelist } from "./utils/Silo";
import { deleteGerminating, loadGerminating, loadOrCreateGerminating } from "./utils/Germinating";
import { BI_10, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { updateStalkBalances } from "./SiloHandler";
import { WhitelistToken as WhitelistTokenEntity } from "../generated/schema";
import { BEAN_WETH_CP2_WELL } from "../../subgraph-core/utils/Constants";
import { Bytes4_emptyToNull } from "../../subgraph-core/utils/Bytes";
import { getCurrentSeason } from "./utils/Beanstalk";
import { setHourlyCaseId, takeSiloSnapshots } from "./utils/snapshots/Silo";
import { takeWhitelistTokenSettingSnapshots } from "./utils/snapshots/WhitelistTokenSetting";

export function handleTemperatureChange(event: TemperatureChange): void {
  handleRateChange(event.address, event.block, event.params.season, event.params.caseId, event.params.absChange);
}

// SEED GAUGE SEASONAL ADJUSTMENTS //

export function handleBeanToMaxLpGpPerBdvRatioChange(event: BeanToMaxLpGpPerBdvRatioChange): void {
  let silo = loadSilo(event.address);

  if (silo.beanToMaxLpGpPerBdvRatio === null) {
    silo.beanToMaxLpGpPerBdvRatio = event.params.absChange;
  } else {
    silo.beanToMaxLpGpPerBdvRatio = silo.beanToMaxLpGpPerBdvRatio!.plus(event.params.absChange);
  }
  takeSiloSnapshots(silo, event.address, event.block.timestamp);
  setHourlyCaseId(event.params.caseId, silo, event.address);
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

  // Individual asset grown stalk is set by the UpdatedStalkPerBdvPerSeason event in SiloHandler
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

// WHITELIST / GAUGE CONFIGURATION SETTINGS //

export function handleWhitelistToken_BIP45(event: WhitelistToken): void {
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

  let id = "whitelistToken-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let rawEvent = new WhitelistTokenEntity(id);
  rawEvent.hash = event.transaction.hash.toHexString();
  rawEvent.logIndex = event.logIndex.toI32();
  rawEvent.protocol = event.address.toHexString();
  rawEvent.token = event.params.token.toHexString();
  rawEvent.blockNumber = event.block.number;
  rawEvent.createdAt = event.block.timestamp;
  rawEvent.save();
}

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
