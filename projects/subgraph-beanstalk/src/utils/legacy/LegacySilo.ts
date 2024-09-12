import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { loadSilo, loadSiloAsset, loadSiloWithdraw } from "../../entities/Silo";
import { takeSiloAssetSnapshots } from "../../entities/snapshots/SiloAsset";
import { loadBeanstalk } from "../../entities/Beanstalk";
import { updateStalkBalances } from "../Silo";
import { Replanted } from "../../../generated/Beanstalk-ABIs/Replanted";
import { BEAN_3CRV, BEAN_ERC20, UNRIPE_BEAN, UNRIPE_LP } from "../../../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { BI_10 } from "../../../../subgraph-core/utils/Decimals";
import { toAddress } from "../../../../subgraph-core/utils/Bytes";
import { takeSiloSnapshots } from "../../entities/snapshots/Silo";

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
  // FIXME stalk decimals
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
