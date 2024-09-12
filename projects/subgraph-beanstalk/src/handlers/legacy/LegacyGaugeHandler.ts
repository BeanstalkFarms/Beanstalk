import { Bytes4_emptyToNull } from "../../../../subgraph-core/utils/Bytes";
import { ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import {
  FarmerGerminatingStalkBalanceChanged,
  SeedGauge,
  TotalGerminatingBalanceChanged,
  UpdateGaugeSettings
} from "../../../generated/Beanstalk-ABIs/SeedGauge";
import { getCurrentSeason } from "../../entities/Beanstalk";
import {
  deleteGerminating,
  germinationEnumCategory,
  germinationSeasonCategory,
  loadGerminating,
  loadOrCreateGerminating
} from "../../entities/Germinating";
import { loadSilo, loadWhitelistTokenSetting } from "../../entities/Silo";
import { takeSiloSnapshots } from "../../entities/snapshots/Silo";
import { takeWhitelistTokenSettingSnapshots } from "../../entities/snapshots/WhitelistTokenSetting";
import { getFarmerGerminatingBugOffset, savePrevFarmerGerminatingEvent } from "../../utils/legacy/LegacySilo";
import { legacyInitGauge } from "../../utils/legacy/LegacyWhitelist";

// SeedGauge -> Reseed
// There was a bug in this event which occurred when both even and odd germination complete in
// the same transaction.
export function handleFarmerGerminatingStalkBalanceChanged_bugged(event: FarmerGerminatingStalkBalanceChanged): void {
  if (event.params.deltaGerminatingStalk == ZERO_BI) {
    return;
  }

  const currentSeason = getCurrentSeason();
  let actualDeltaGerminatingStalk = event.params.deltaGerminatingStalk;

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
    actualDeltaGerminatingStalk = event.params.deltaGerminatingStalk.plus(bugfixStalkOffset);

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
      takeSiloSnapshots(systemSilo, event.block);
      systemSilo.save();
    }

    // Also for the event bug adjustment
    savePrevFarmerGerminatingEvent(event.params.account, event, event.params.deltaGerminatingStalk);
  }

  let farmerSilo = loadSilo(event.params.account);
  farmerSilo.germinatingStalk = farmerSilo.germinatingStalk.plus(actualDeltaGerminatingStalk);
  takeSiloSnapshots(farmerSilo, event.block);
  farmerSilo.save();
}

// SeedGauge -> Reseed
// There was a bug where the germinating season number here can be incorrect/incongruent
// with the values set at s.(odd|even)Germinating.deposited[token].bdv.
// Best solution is to use view functions to determine what the correct amount should be for each.
export function handleTotalGerminatingBalanceChanged_bugged(event: TotalGerminatingBalanceChanged): void {
  if (event.params.deltaAmount == ZERO_BI && event.params.deltaBdv == ZERO_BI) {
    return;
  }

  // SeedGauge: there is a bug where the germinating season number here can be incorrect/incongruent
  // with the values set at s.(odd|even)Germinating.deposited[token].bdv.
  // Best solution is to use view functions to determine what the correct amount should be for each.
  const beanstalk_call = SeedGauge.bind(event.address);

  const evenGerminating = beanstalk_call.getEvenGerminating(event.params.token);
  let tokenGerminatingEven = loadOrCreateGerminating(event.params.token, 0, false);
  tokenGerminatingEven.tokenAmount = evenGerminating.getValue0();
  tokenGerminatingEven.bdv = evenGerminating.getValue1();
  if (tokenGerminatingEven.tokenAmount == ZERO_BI) {
    deleteGerminating(tokenGerminatingEven);
  } else {
    tokenGerminatingEven.save();
  }

  const oddGerminating = beanstalk_call.getOddGerminating(event.params.token);
  let tokenGerminatingOdd = loadOrCreateGerminating(event.params.token, 1, false);
  tokenGerminatingOdd.tokenAmount = oddGerminating.getValue0();
  tokenGerminatingOdd.bdv = oddGerminating.getValue1();
  if (tokenGerminatingOdd.tokenAmount == ZERO_BI) {
    deleteGerminating(tokenGerminatingOdd);
  } else {
    tokenGerminatingOdd.save();
  }
}

// SeedGauge -> Reseed
export function handleUpdateGaugeSettings(event: UpdateGaugeSettings): void {
  let siloSettings = loadWhitelistTokenSetting(event.params.token);
  siloSettings.gpSelector = Bytes4_emptyToNull(event.params.gpSelector);
  siloSettings.lwSelector = Bytes4_emptyToNull(event.params.lwSelector);
  siloSettings.optimalPercentDepositedBdv = event.params.optimalPercentDepositedBdv;
  siloSettings.updatedAt = event.block.timestamp;

  legacyInitGauge(event, siloSettings);

  takeWhitelistTokenSettingSnapshots(siloSettings, event.block);
  siloSettings.save();
}
