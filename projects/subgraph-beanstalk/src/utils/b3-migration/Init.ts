import { ethereum } from "@graphprotocol/graph-ts";
import { v } from "../constants/Version";
import { loadField } from "../../entities/Field";
import {
  FIELD_INITIAL_VALUES,
  POD_MARKETPLACE_INITIAL_VALUES,
  SEASON_INITIAL,
  UNRIPE_TOKENS_INITIAL_VALUES
} from "../../../cache-builder/results/B3Migration_arb";
import { clearFieldDeltas, takeFieldSnapshots } from "../../entities/snapshots/Field";
import { loadPodMarketplace } from "../../entities/PodMarketplace";
import { clearMarketDeltas, takeMarketSnapshots } from "../../entities/snapshots/Marketplace";
import { loadSilo, loadSiloAsset, loadUnripeToken, loadWhitelistTokenSetting } from "../../entities/Silo";
import { getUnripeBeanAddr, getUnripeLpAddr, isUnripe } from "../../../../subgraph-core/constants/RuntimeConstants";
import { clearUnripeTokenDeltas, takeUnripeTokenSnapshots } from "../../entities/snapshots/UnripeToken";
import { loadBeanstalk } from "../../entities/Beanstalk";
import { clearSiloDeltas } from "../../entities/snapshots/Silo";
import { clearSiloAssetDeltas } from "../../entities/snapshots/SiloAsset";
import { clearWhitelistTokenSettingDeltas } from "../../entities/snapshots/WhitelistTokenSetting";
import { toAddress } from "../../../../subgraph-core/utils/Bytes";

export function init(block: ethereum.Block): void {
  let beanstalk = loadBeanstalk();
  beanstalk.lastSeason = SEASON_INITIAL;
  beanstalk.save();
}

// Carries over cumulative data from L1 -> L2 subgraph. See cache-builder/beanstalk3.js for the input source.
// This function should be executed after all of the Migration events are handled, at which point
// the snapshots will be set with nonsensical deltas. The strategy is to take all of those snapshots,
// and then zero-out all of the deltas here.
export function preUnpause(block: ethereum.Block): void {
  let field = loadField(v().protocolAddress);
  field.numberOfSowers = FIELD_INITIAL_VALUES.numberOfSowers;
  field.numberOfSows = FIELD_INITIAL_VALUES.numberOfSows;
  field.sownBeans = FIELD_INITIAL_VALUES.sownBeans;
  field.harvestedPods = FIELD_INITIAL_VALUES.harvestedPods;
  takeFieldSnapshots(field, block);
  field.save();

  let podMarketplace = loadPodMarketplace();
  podMarketplace.filledListedPods = POD_MARKETPLACE_INITIAL_VALUES.filledListedPods;
  podMarketplace.expiredListedPods = POD_MARKETPLACE_INITIAL_VALUES.expiredListedPods;
  podMarketplace.cancelledListedPods = POD_MARKETPLACE_INITIAL_VALUES.cancelledListedPods;
  podMarketplace.filledOrderBeans = POD_MARKETPLACE_INITIAL_VALUES.filledOrderBeans;
  podMarketplace.filledOrderedPods = POD_MARKETPLACE_INITIAL_VALUES.filledOrderedPods;
  podMarketplace.cancelledOrderBeans = POD_MARKETPLACE_INITIAL_VALUES.cancelledOrderBeans;
  podMarketplace.podVolume = POD_MARKETPLACE_INITIAL_VALUES.podVolume;
  podMarketplace.beanVolume = POD_MARKETPLACE_INITIAL_VALUES.beanVolume;
  takeMarketSnapshots(podMarketplace, block);
  podMarketplace.save();

  for (let i = 0; i < UNRIPE_TOKENS_INITIAL_VALUES.length; ++i) {
    let unripe = loadUnripeToken(UNRIPE_TOKENS_INITIAL_VALUES[i].tokenType === "urbean" ? getUnripeBeanAddr(v()) : getUnripeLpAddr(v()));
    unripe.totalChoppedAmount = UNRIPE_TOKENS_INITIAL_VALUES[i].totalChoppedAmount;
    unripe.totalChoppedBdv = UNRIPE_TOKENS_INITIAL_VALUES[i].totalChoppedBdv;
    unripe.totalChoppedBdvReceived = UNRIPE_TOKENS_INITIAL_VALUES[i].totalChoppedBdvReceived;
    takeUnripeTokenSnapshots(unripe, block);
    unripe.save();

    clearUnripeTokenDeltas(unripe, block);
  }

  // Zero out all deltas for all snapshots. Unripe cleared above
  clearFieldDeltas(field, block);
  clearMarketDeltas(podMarketplace, block);
  const silo = loadSilo(v().protocolAddress);
  clearSiloDeltas(silo, block);
  // No need to clear silo assets/whitelisted tokens, since all of these are technically new to the silo
}
