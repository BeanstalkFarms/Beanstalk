import { Address, BigInt } from "@graphprotocol/graph-ts";
import { BEAN_3CRV, BEAN_ERC20, UNRIPE_BEAN, UNRIPE_LP } from "../../../../subgraph-core/constants/BeanstalkEth";
import { BI_10 } from "../../../../subgraph-core/utils/Decimals";

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
