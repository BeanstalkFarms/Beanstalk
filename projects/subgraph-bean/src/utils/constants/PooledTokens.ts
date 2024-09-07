import { BigInt, Address, log } from "@graphprotocol/graph-ts";
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
} from "../../../../subgraph-core/constants/BeanstalkEth";

// Use this mapping to determine which tokens are in each pool. Pools may each follow a distinct interface,
// so a view function shouldn't be used, and a new subgraph build is already required to track a newly whitelisted asset.
export function getTokensForPool(pool: Address): Address[] {
  for (let i = 0; i < poolTokens.length; ++i) {
    if (poolTokens[i].pool == pool) {
      return poolTokens[i].tokens;
    }
  }
  throw new Error("Pool has not been configured");
}

// Name/Decimals are not guaranteed as part of the ERC20 interface, so predefined values are necessary
export function getTokenInfo(token: Address): TokenInfo {
  for (let i = 0; i < tokens.length; ++i) {
    if (tokens[i].address == token) {
      return tokens[i].info;
    }
  }
  throw new Error("Token has not been configured");
}

class PoolTokens {
  pool: Address;
  tokens: Address[];
}
// WHITELIST: Add new pools here
const poolTokens: PoolTokens[] = [
  {
    pool: BEAN_WETH_V1,
    tokens: [BEAN_ERC20_V1, WETH]
  },
  {
    pool: BEAN_3CRV_V1,
    tokens: [BEAN_ERC20_V1, CRV3_TOKEN]
  },
  {
    pool: BEAN_LUSD_V1,
    tokens: [BEAN_ERC20_V1, LUSD]
  },
  {
    pool: BEAN_3CRV,
    tokens: [BEAN_ERC20, CRV3_TOKEN]
  },
  {
    pool: BEAN_WETH_CP2_WELL,
    tokens: [BEAN_ERC20, WETH]
  },
  {
    pool: BEAN_WSTETH_CP2_WELL,
    tokens: [BEAN_ERC20, WSTETH]
  }
];

class Token {
  address: Address;
  info: TokenInfo;
}

class TokenInfo {
  name: string;
  decimals: BigInt;
}

// WHITELIST: Add new tokens here
const tokens: Token[] = [
  {
    address: BEAN_ERC20_V1,
    info: { name: "BEAN", decimals: BigInt.fromU32(6) }
  },
  {
    address: BEAN_ERC20,
    info: { name: "BEAN", decimals: BigInt.fromU32(6) }
  },
  {
    address: WETH,
    info: { name: "WETH", decimals: BigInt.fromU32(18) }
  },
  {
    address: CRV3_TOKEN,
    info: { name: "3CRV", decimals: BigInt.fromU32(18) }
  },
  {
    address: LUSD,
    info: { name: "LUSD", decimals: BigInt.fromU32(18) }
  },
  {
    address: WSTETH,
    info: { name: "wstETH", decimals: BigInt.fromU32(18) }
  }
];
