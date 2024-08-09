import { BigInt, log } from "@graphprotocol/graph-ts";
import {
  BEAN_ERC20,
  BEAN_ERC20_V1,
  WETH,
  CRV3_TOKEN,
  LUSD,
  BEAN_WETH_V1,
  BEAN_3CRV_V1,
  BEAN_LUSD_V1,
  BEAN_3CRV,
  BEAN_WETH_CP2_WELL,
  BEAN_WSTETH_CP2_WELL,
  WSTETH
} from "../../../subgraph-core/utils/Constants";

// Use this mapping to determine which tokens are in each pool. Pools may each follow a distinct interface,
// so a view function shouldn't be used, and a new subgraph build is already required to track a newly whitelisted asset.
export function getTokensForPool(pool: string): string[] {
  for (let i = 0; i < poolTokens.length; ++i) {
    if (poolTokens[i].pool == pool) {
      return poolTokens[i].tokens;
    }
  }
  throw new Error("Pool has not been configured");
}

// Name/Decimals are not guaranteed as part of the ERC20 interface, so predefined values are necessary
export function getTokenInfo(token: string): TokenInfo {
  for (let i = 0; i < tokens.length; ++i) {
    if (tokens[i].address == token) {
      return tokens[i].info;
    }
  }
  throw new Error("Token has not been configured");
}

class PoolTokens {
  pool: string;
  tokens: string[];
}
// WHITELIST: Add new pools here
const poolTokens: PoolTokens[] = [
  {
    pool: BEAN_WETH_V1.toHexString(),
    tokens: [BEAN_ERC20_V1.toHexString(), WETH.toHexString()]
  },
  {
    pool: BEAN_3CRV_V1.toHexString(),
    tokens: [BEAN_ERC20_V1.toHexString(), CRV3_TOKEN.toHexString()]
  },
  {
    pool: BEAN_LUSD_V1.toHexString(),
    tokens: [BEAN_ERC20_V1.toHexString(), LUSD.toHexString()]
  },
  {
    pool: BEAN_3CRV.toHexString(),
    tokens: [BEAN_ERC20.toHexString(), CRV3_TOKEN.toHexString()]
  },
  {
    pool: BEAN_WETH_CP2_WELL.toHexString(),
    tokens: [BEAN_ERC20.toHexString(), WETH.toHexString()]
  },
  {
    pool: BEAN_WSTETH_CP2_WELL.toHexString(),
    tokens: [BEAN_ERC20.toHexString(), WSTETH.toHexString()]
  }
];

class Token {
  address: string;
  info: TokenInfo;
}

class TokenInfo {
  name: string;
  decimals: BigInt;
}

// WHITELIST: Add new tokens here
const tokens: Token[] = [
  {
    address: BEAN_ERC20_V1.toHexString(),
    info: { name: "BEAN", decimals: BigInt.fromU32(6) }
  },
  {
    address: BEAN_ERC20.toHexString(),
    info: { name: "BEAN", decimals: BigInt.fromU32(6) }
  },
  {
    address: WETH.toHexString(),
    info: { name: "WETH", decimals: BigInt.fromU32(18) }
  },
  {
    address: CRV3_TOKEN.toHexString(),
    info: { name: "3CRV", decimals: BigInt.fromU32(18) }
  },
  {
    address: LUSD.toHexString(),
    info: { name: "LUSD", decimals: BigInt.fromU32(18) }
  },
  {
    address: WSTETH.toHexString(),
    info: { name: "wstETH", decimals: BigInt.fromU32(18) }
  }
];
