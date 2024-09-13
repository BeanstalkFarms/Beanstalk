import { BigInt, Address, log } from "@graphprotocol/graph-ts";
import * as BeanstalkEth from "../../../../subgraph-core/constants/raw/BeanstalkEthConstants";
import * as BeanstalkArb from "../../../../subgraph-core/constants/raw/BeanstalkArbConstants";

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
  // ethereum
  {
    pool: BeanstalkEth.BEAN_WETH_V1,
    tokens: [BeanstalkEth.BEAN_ERC20_V1, BeanstalkEth.WETH]
  },
  {
    pool: BeanstalkEth.BEAN_3CRV_V1,
    tokens: [BeanstalkEth.BEAN_ERC20_V1, BeanstalkEth.CRV3_TOKEN]
  },
  {
    pool: BeanstalkEth.BEAN_LUSD_V1,
    tokens: [BeanstalkEth.BEAN_ERC20_V1, BeanstalkEth.LUSD]
  },
  {
    pool: BeanstalkEth.BEAN_3CRV,
    tokens: [BeanstalkEth.BEAN_ERC20, BeanstalkEth.CRV3_TOKEN]
  },
  {
    pool: BeanstalkEth.BEAN_WETH_CP2_WELL,
    tokens: [BeanstalkEth.BEAN_ERC20, BeanstalkEth.WETH]
  },
  {
    pool: BeanstalkEth.BEAN_WSTETH_CP2_WELL,
    tokens: [BeanstalkEth.BEAN_ERC20, BeanstalkEth.WSTETH]
  },
  // arbitrum
  {
    pool: BeanstalkArb.BEAN_WETH,
    tokens: [BeanstalkArb.BEAN_ERC20, BeanstalkArb.WETH]
  },
  {
    pool: BeanstalkArb.BEAN_WSTETH,
    tokens: [BeanstalkArb.BEAN_ERC20, BeanstalkArb.WSTETH]
  },
  {
    pool: BeanstalkArb.BEAN_WEETH,
    tokens: [BeanstalkArb.BEAN_ERC20, BeanstalkArb.WEETH]
  },
  {
    pool: BeanstalkArb.BEAN_WBTC,
    tokens: [BeanstalkArb.BEAN_ERC20, BeanstalkArb.WBTC]
  },
  {
    pool: BeanstalkArb.BEAN_USDC,
    tokens: [BeanstalkArb.BEAN_ERC20, BeanstalkArb.USDC]
  },
  {
    pool: BeanstalkArb.BEAN_USDT,
    tokens: [BeanstalkArb.BEAN_ERC20, BeanstalkArb.USDT]
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
  // ethereum
  {
    address: BeanstalkEth.BEAN_ERC20_V1,
    info: { name: "BEAN", decimals: BigInt.fromU32(6) }
  },
  {
    address: BeanstalkEth.BEAN_ERC20,
    info: { name: "BEAN", decimals: BigInt.fromU32(6) }
  },
  {
    address: BeanstalkEth.WETH,
    info: { name: "WETH", decimals: BigInt.fromU32(18) }
  },
  {
    address: BeanstalkEth.CRV3_TOKEN,
    info: { name: "3CRV", decimals: BigInt.fromU32(18) }
  },
  {
    address: BeanstalkEth.LUSD,
    info: { name: "LUSD", decimals: BigInt.fromU32(18) }
  },
  {
    address: BeanstalkEth.WSTETH,
    info: { name: "wstETH", decimals: BigInt.fromU32(18) }
  },
  // arbitrum
  {
    address: BeanstalkArb.BEAN_ERC20,
    info: { name: "BEAN", decimals: BigInt.fromU32(6) }
  },
  {
    address: BeanstalkArb.WETH,
    info: { name: "WETH", decimals: BigInt.fromU32(18) }
  },
  {
    address: BeanstalkArb.WSTETH,
    info: { name: "wstETH", decimals: BigInt.fromU32(18) }
  },
  {
    address: BeanstalkArb.WEETH,
    info: { name: "weETH", decimals: BigInt.fromU32(18) }
  },
  {
    address: BeanstalkArb.WBTC,
    info: { name: "WBTC", decimals: BigInt.fromU32(18) }
  },
  {
    address: BeanstalkArb.USDC,
    info: { name: "USDC", decimals: BigInt.fromU32(6) }
  },
  {
    address: BeanstalkArb.USDT,
    info: { name: "USDT", decimals: BigInt.fromU32(6) }
  }
];
