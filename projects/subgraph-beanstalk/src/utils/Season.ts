import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { loadSeason } from "../entities/Beanstalk";
import { loadPodMarketplace } from "../entities/PodMarketplace";
import { takeMarketSnapshots } from "../entities/snapshots/Marketplace";
import { takeSiloSnapshots } from "../entities/snapshots/Silo";
import { loadSilo, loadSiloAsset, loadWhitelistTokenSetting } from "../entities/Silo";
import { takeSiloAssetSnapshots } from "../entities/snapshots/SiloAsset";
import { takeFieldSnapshots } from "../entities/snapshots/Field";
import { BI_10, toDecimal, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { loadField } from "../entities/Field";
import { setBdv, takeWhitelistTokenSettingSnapshots } from "../entities/snapshots/WhitelistTokenSetting";
import { WhitelistTokenSetting } from "../../generated/schema";
import { SeedGauge } from "../../generated/Beanstalk-ABIs/SeedGauge";
import { updateUnripeStats } from "./Barn";
import { isUnripe } from "../../../subgraph-core/constants/RuntimeConstants";
import { v } from "./constants/Version";

export function sunrise(protocol: Address, season: BigInt, block: ethereum.Block): void {
  let currentSeason = season.toI32();
  let seasonEntity = loadSeason(season);
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
  silo.save();

  // Update all whitelisted/dewhitelisted token info
  const siloTokens = silo.whitelistedTokens.concat(silo.dewhitelistedTokens);
  for (let i = 0; i < siloTokens.length; i++) {
    const token = Address.fromString(siloTokens[i]);

    let siloAsset = loadSiloAsset(protocol, token);
    takeSiloAssetSnapshots(siloAsset, protocol, block.timestamp);
    siloAsset.save();

    let whitelistTokenSetting = loadWhitelistTokenSetting(token);
    takeWhitelistTokenSettingSnapshots(whitelistTokenSetting, protocol, block.timestamp);
    whitelistTokenSetting.save();
    setTokenBdv(token, protocol, whitelistTokenSetting);

    if (isUnripe(v(), token)) {
      updateUnripeStats(token, protocol, block);
    }
  }
}

function setTokenBdv(token: Address, protocol: Address, whitelistTokenSetting: WhitelistTokenSetting): void {
  // Get bdv if the bdv function is available onchain (not available prior to BIP-16)
  const beanstalk_call = SeedGauge.bind(protocol);
  const bdvResult = beanstalk_call.try_bdv(token, BI_10.pow(<u8>whitelistTokenSetting.decimals));
  if (bdvResult.reverted) {
    return;
  }
  setBdv(bdvResult.value, whitelistTokenSetting);
}
