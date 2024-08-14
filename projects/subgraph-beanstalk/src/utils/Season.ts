import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { loadSeason } from "../entities/Beanstalk";
import { loadPodMarketplace } from "../entities/PodMarketplace";
import { takeMarketSnapshots } from "../entities/snapshots/Marketplace";
import { takeSiloSnapshots } from "../entities/snapshots/Silo";
import { loadSilo, loadSiloAsset } from "../entities/Silo";
import { takeSiloAssetSnapshots } from "../entities/snapshots/SiloAsset";
import { takeFieldSnapshots } from "../entities/snapshots/Field";
import { toDecimal, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { loadField } from "../entities/Field";

export function sunrise(protocol: Address, season: BigInt, block: ethereum.Block): void {
  let currentSeason = season.toI32();
  let seasonEntity = loadSeason(protocol, season);
  seasonEntity.sunriseBlock = block.number;
  seasonEntity.createdAt = block.timestamp;
  seasonEntity.save();

  // Update field metrics
  let field = loadField(protocol);

  // -- Field level totals
  field.season = currentSeason;
  field.podRate = seasonEntity.beans == ZERO_BI ? ZERO_BD : toDecimal(field.unharvestablePods, 6).div(toDecimal(seasonEntity.beans, 6));

  takeFieldSnapshots(field, protocol, block.timestamp, block.number);
  field.save();

  // Marketplace Season Update
  let market = loadPodMarketplace(protocol);
  market.season = currentSeason;
  takeMarketSnapshots(market, protocol, block.timestamp);
  market.save();

  // Create silo entities for the protocol
  let silo = loadSilo(protocol);
  takeSiloSnapshots(silo, protocol, block.timestamp);
  for (let i = 0; i < silo.whitelistedTokens.length; i++) {
    let siloAsset = loadSiloAsset(protocol, Address.fromString(silo.whitelistedTokens[i]));
    takeSiloAssetSnapshots(siloAsset, protocol, block.timestamp);
    siloAsset.save();
  }
  silo.save();
}
