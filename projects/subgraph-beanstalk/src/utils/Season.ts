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
import { Reseed } from "../../generated/Beanstalk-ABIs/Reseed";
import { updateUnripeStats } from "./Barn";
import { beanDecimals, getProtocolToken, isUnripe, stalkDecimals } from "../../../subgraph-core/constants/RuntimeConstants";
import { v } from "./constants/Version";
import { toAddress } from "../../../subgraph-core/utils/Bytes";
import { updateDepositInSiloAsset } from "./Silo";

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
  field.podRate = seasonEntity.beans == ZERO_BI ? ZERO_BD : toDecimal(field.unharvestablePods).div(toDecimal(seasonEntity.beans));

  takeFieldSnapshots(field, block);
  field.save();

  // Marketplace Season Update
  let market = loadPodMarketplace();
  market.season = currentSeason;
  takeMarketSnapshots(market, block);
  market.save();

  // Create silo entities for the protocol
  let silo = loadSilo(protocol);
  takeSiloSnapshots(silo, block);
  silo.save();

  // Update all whitelisted/dewhitelisted token info
  const siloTokens = silo.whitelistedTokens.concat(silo.dewhitelistedTokens);
  for (let i = 0; i < siloTokens.length; i++) {
    const token = toAddress(siloTokens[i]);

    let siloAsset = loadSiloAsset(protocol, token);
    takeSiloAssetSnapshots(siloAsset, block);
    siloAsset.save();

    let whitelistTokenSetting = loadWhitelistTokenSetting(token);
    takeWhitelistTokenSettingSnapshots(whitelistTokenSetting, block);
    whitelistTokenSetting.save();
    setTokenBdv(token, protocol, whitelistTokenSetting);

    if (isUnripe(v(), token)) {
      updateUnripeStats(token, protocol, block);
    }
  }
}

export function siloReceipt(amount: BigInt, block: ethereum.Block): void {
  let silo = loadSilo(v().protocolAddress);
  let newPlantableStalk = amount.times(BI_10.pow(<u8>(stalkDecimals(v()) - beanDecimals())));

  silo.beanMints = silo.beanMints.plus(amount);
  silo.stalk = silo.stalk.plus(newPlantableStalk);
  silo.plantableStalk = silo.plantableStalk.plus(newPlantableStalk);
  silo.depositedBDV = silo.depositedBDV.plus(amount);

  takeSiloSnapshots(silo, block);
  silo.save();

  updateDepositInSiloAsset(v().protocolAddress, v().protocolAddress, getProtocolToken(v(), block.number), amount, amount, block);
}

function setTokenBdv(token: Address, protocol: Address, whitelistTokenSetting: WhitelistTokenSetting): void {
  // Get bdv if the bdv function is available onchain (not available prior to BIP-16)
  const beanstalk_call = Reseed.bind(protocol);
  const bdvResult = beanstalk_call.try_bdv(token, BI_10.pow(<u8>whitelistTokenSetting.decimals));
  if (bdvResult.reverted) {
    return;
  }
  setBdv(bdvResult.value, whitelistTokenSetting);
}
