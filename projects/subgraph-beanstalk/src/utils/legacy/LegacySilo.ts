import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { loadSilo, loadSiloAsset, loadSiloWithdraw } from "../../entities/Silo";
import { takeSiloAssetSnapshots } from "../../entities/snapshots/SiloAsset";
import { loadBeanstalk } from "../../entities/Beanstalk";
import { updateStalkBalances } from "../Silo";
import { Replanted } from "../../../generated/Beanstalk-ABIs/Replanted";
import { BEAN_3CRV, BEAN_ERC20, UNRIPE_BEAN, UNRIPE_LP } from "../../../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { BI_10, ONE_BI, ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import { toAddress } from "../../../../subgraph-core/utils/Bytes";
import { takeSiloSnapshots } from "../../entities/snapshots/Silo";
import { PrevFarmerGerminatingEvent } from "../../../generated/schema";

export function updateClaimedWithdraw(account: Address, token: Address, withdrawSeason: BigInt, block: ethereum.Block): void {
  let withdraw = loadSiloWithdraw(account, token, withdrawSeason.toI32());
  withdraw.claimed = true;
  withdraw.save();

  let asset = loadSiloAsset(account, token);
  asset.withdrawnAmount = asset.withdrawnAmount.minus(withdraw.amount);
  takeSiloAssetSnapshots(asset, block);
  asset.save();
}

// Replanted -> SiloV3
// This should be run at sunrise for the previous season to update any farmers stalk/seed/roots balances from silo transfers.
export function updateStalkWithCalls(protocol: Address, block: ethereum.Block): void {
  let beanstalk = loadBeanstalk();
  let beanstalk_call = Replanted.bind(protocol);

  for (let i = 0; i < beanstalk.farmersToUpdate.length; i++) {
    let account = toAddress(beanstalk.farmersToUpdate[i]);
    let silo = loadSilo(account);
    updateStalkBalances(
      protocol,
      account,
      beanstalk_call.balanceOfStalk(account).minus(silo.stalk),
      beanstalk_call.balanceOfRoots(account).minus(silo.roots),
      block,
      false
    );
    updateSeedsBalances(protocol, account, beanstalk_call.balanceOfSeeds(account).minus(silo.seeds), block, false);
  }
  beanstalk.farmersToUpdate = [];
  beanstalk.save();
}

export function updateSeedsBalances(
  protocol: Address,
  account: Address,
  seeds: BigInt,
  block: ethereum.Block,
  recurs: boolean = true
): void {
  if (recurs && account != protocol) {
    updateSeedsBalances(protocol, protocol, seeds, block);
  }
  let silo = loadSilo(account);
  silo.seeds = silo.seeds.plus(seeds);
  takeSiloSnapshots(silo, block);
  silo.save();
}

const STEM_START_SEASON = 14210;

export function stemFromSeason(season: i32, token: Address): BigInt {
  return seasonToV3Stem(season, STEM_START_SEASON, getLegacySeedsPerToken(token));
}

// Equivalent to LibLegacyTokenSilo.seasonToStem
function seasonToV3Stem(season: i32, stemStartSeason: i32, seedsPerBdv: i32): BigInt {
  return BigInt.fromI32(season - stemStartSeason).times(BigInt.fromI32(seedsPerBdv).times(BI_10.pow(6)));
}

// Equivalent to LibLegacyTokenSilo.getLegacySeedsPerToken
function getLegacySeedsPerToken(token: Address): i32 {
  if (token == BEAN_ERC20) {
    return 2;
  } else if (token == UNRIPE_BEAN) {
    return 2;
  } else if (token == UNRIPE_LP) {
    return 4;
  } else if (token == BEAN_3CRV) {
    return 4;
  }
  return 0;
}

// (legacy bugfix adjustment)
// This is the entity that exists to resolve the issue in LibGerminate when deposits from multiple seasons
// complete their germination (the event emission itself has a bug)
export function loadPrevFarmerGerminatingEvent(account: Address): PrevFarmerGerminatingEvent {
  let savedEvent = PrevFarmerGerminatingEvent.load(account);
  if (savedEvent == null) {
    savedEvent = new PrevFarmerGerminatingEvent(account);
    savedEvent.eventBlock = ZERO_BI;
    savedEvent.logIndex = ZERO_BI;
    savedEvent.deltaGerminatingStalk = ZERO_BI;
    // No point in saving it
  }
  return savedEvent as PrevFarmerGerminatingEvent;
}

// (legacy bugfix adjustment)
export function savePrevFarmerGerminatingEvent(account: Address, event: ethereum.Event, deltaGerminatingStalk: BigInt): void {
  const savedEvent = new PrevFarmerGerminatingEvent(account);
  savedEvent.eventBlock = event.block.number;
  savedEvent.logIndex = event.logIndex;
  savedEvent.deltaGerminatingStalk = deltaGerminatingStalk;
  savedEvent.save();
}

// (legacy bugfix adjustment)
// Returns the stalk offset that should be applied to the encountered FarmerGerminatingStalkBalanceChanged event.
export function getFarmerGerminatingBugOffset(account: Address, event: ethereum.Event): BigInt {
  const prevEvent = loadPrevFarmerGerminatingEvent(account);
  if (prevEvent.eventBlock == event.block.number && prevEvent.logIndex == event.logIndex.minus(ONE_BI)) {
    return prevEvent.deltaGerminatingStalk.neg();
  }
  return ZERO_BI;
}
