import { BeanstalkSDK, ChainId, TokenValue } from "@beanstalk/sdk";
import { ChainResolver } from "@beanstalk/sdk-core";

import { PriceContract__factory } from "src/generated/types";
import { memoize } from "src/utils/memoize";

import { Log } from "../logger";

/*
 * Price lookup methods
 *
 * For Chainlink, we get contract address from:
 * https://data.chain.link/ethereum/mainnet
 * Docs: https://docs.chain.link/data-feeds/price-feeds
 *
 */

const FEEDS: Record<number, Record<string, string>> = {
  [ChainId.ETH_MAINNET]: {
    /// BTC Feeds
    WBTC_BTC: "0xfdFD9C85aD200c506Cf9e21F1FD8dd01932FBB23",

    /// ETH Data Feeds
    LDO_ETH: "0x4e844125952D32AcdF339BE976c98E22F6F318dB",
    weETH_ETH: "0x5c9C449BbC9a6075A2c061dF312a35fd1E05fF22",

    /// USD Data Feeds
    ETH_USD: "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
    USDC_USD: "0x8fffffd4afb6115b954bd326cbe7b4ba576818f6",
    DAI_USD: "0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9",
    USDT_USD: "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
    BTC_USD: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
    BNB_USD: "0x14e613AC84a31f709eadbdF89C6CC390fDc9540A",
    ARB_USD: "0x31697852a68433DbCc2Ff612c516d69E3D9bd08F",
    AMPL_USD: "0xe20CA8D7546932360e37E9D72c1a47334af57706",
    AAVE_USD: "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9",
    CRV_USD: "0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f",
    FRAX_USD: "0xB9E1E3A9feFf48998E45Fa90847ed4D467E8BcfD",
    LINK_USD: "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
    LUSD_USD: "0x3D7aE7E594f2f2091Ad8798313450130d0Aba3a0",
    STETH_USD: "0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8",
    UNI_USD: "0x553303d460EE0afB37EdFf9bE42922D8FF63220e"
  },
  [ChainId.ARBITRUM_MAINNET]: {
    ETH_USD: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
    WBTC_USD: "0xd0C7101eACbB49F3deCcCc166d238410D6D46d57",
    BTC_USD: "0x6ce185860a4963106506C203335A2910413708e9",
    WBTC_BTC: "0x0017abAc5b6f291F9164e35B1234CA1D697f9CF4",
    USDC_USD: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3",
    USDT_USD: "0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7",
    wstETH_ETH: "0xb523AE262D20A936BC152e6023996e46FDC2A95D",
    weETH_ETH: "0xE141425bc1594b8039De6390db1cDaf4397EA22b"
  }
};

type FeedId = keyof (typeof FEEDS)[keyof typeof FEEDS];

const chainlinkLookup = (feed: FeedId) => async (sdk: BeanstalkSDK) => {
  const chainId = ChainResolver.resolveToMainnetChainId(sdk.chainId);
  const chainFeed = FEEDS[chainId];
  const address = chainFeed[feed as unknown as keyof typeof chainFeed];
  if (!chainFeed || !address) {
    Log.module("price").debug(
      `Unable to fetch price. No Chainlink lookup for feed: ${feed} on chainId: ${chainId}`
    );
    return null;
  }
  Log.module("price").debug(
    `Fetching ${sdk.tokens.findByAddress(address)?.symbol || address} price`
  );
  const contract = PriceContract__factory.connect(address, sdk.providerOrSigner);
  const { answer } = await contract.latestRoundData();
  const decimals = await contract.decimals();

  return TokenValue.fromBlockchain(answer, decimals);
};

const multiChainlinkLookup = (from: FeedId, to: FeedId) => async (sdk: BeanstalkSDK) => {
  const [fromPrice, toPrice] = await Promise.all([
    chainlinkLookup(from)(sdk),
    chainlinkLookup(to)(sdk)
  ]);

  if (fromPrice && toPrice) {
    return toPrice.mul(fromPrice);
  }

  return null;
};

const chainLinkWithCallback =
  (
    from: FeedId,
    getMultiplier: (sdk: BeanstalkSDK) => Promise<(value: TokenValue) => TokenValue>
  ) =>
  async (sdk: BeanstalkSDK) => {
    const [fromPrice, calculate] = await Promise.all([
      chainlinkLookup(from)(sdk),
      getMultiplier(sdk)
    ]);

    return calculate(fromPrice || TokenValue.ZERO);
  };

const getWstETHWithSteth = async (sdk: BeanstalkSDK) => {
  const amt = sdk.tokens.STETH.fromHuman("1");
  const divisor = await sdk.contracts.lido.wsteth.getWstETHByStETH(amt.toBigNumber());

  const value = sdk.tokens.WSTETH.fromBlockchain(divisor);
  return (otherValue: TokenValue) => {
    if (otherValue.eq(0) || value.eq(0)) {
      return TokenValue.ZERO;
    }
    return otherValue.div(value);
  };
};

const BEAN = async (sdk: BeanstalkSDK) => {
  Log.module("price").debug("Fetching BEAN price");
  return sdk.bean.getPrice();
};

const WSTETH = async (sdk: BeanstalkSDK) => {
  const chainId = ChainResolver.resolveToMainnetChainId(sdk.chainId);
  if (ChainResolver.isL1Chain(chainId)) {
    return chainLinkWithCallback("STETH_USD", getWstETHWithSteth)(sdk);
  }
  return multiChainlinkLookup("wstETH_ETH", "ETH_USD")(sdk);
};

const WBTC = async (sdk: BeanstalkSDK) => {
  const chainId = ChainResolver.resolveToMainnetChainId(sdk.chainId);
  if (ChainResolver.isL1Chain(chainId)) {
    return multiChainlinkLookup("WBTC_BTC", "BTC_USD")(sdk);
  }

  return chainlinkLookup("WBTC_USD")(sdk);
};

const PRICE_EXPIRY_TIMEOUT = 60 * 5; // 5 minute cache

// cache should automatically update when sdk instance is updated
export const PriceLookups: Record<string, (sdk: BeanstalkSDK) => Promise<TokenValue>> = {
  BEAN: memoize(BEAN, PRICE_EXPIRY_TIMEOUT),
  ETH: memoize(chainlinkLookup("ETH_USD")),
  WETH: memoize(chainlinkLookup("ETH_USD"), PRICE_EXPIRY_TIMEOUT),
  USDC: memoize(chainlinkLookup("USDC_USD"), PRICE_EXPIRY_TIMEOUT),
  DAI: memoize(chainlinkLookup("DAI_USD"), PRICE_EXPIRY_TIMEOUT),
  USDT: memoize(chainlinkLookup("USDT_USD"), PRICE_EXPIRY_TIMEOUT),
  BNB: memoize(chainlinkLookup("BNB_USD"), PRICE_EXPIRY_TIMEOUT),
  ARB: memoize(chainlinkLookup("ARB_USD"), PRICE_EXPIRY_TIMEOUT),
  AMPL: memoize(chainlinkLookup("AMPL_USD"), PRICE_EXPIRY_TIMEOUT),
  AAVE: memoize(chainlinkLookup("AAVE_USD"), PRICE_EXPIRY_TIMEOUT),
  CRV: memoize(chainlinkLookup("CRV_USD"), PRICE_EXPIRY_TIMEOUT),
  FRAX: memoize(chainlinkLookup("FRAX_USD"), PRICE_EXPIRY_TIMEOUT),
  LINK: memoize(chainlinkLookup("LINK_USD"), PRICE_EXPIRY_TIMEOUT),
  LUSD: memoize(chainlinkLookup("LUSD_USD"), PRICE_EXPIRY_TIMEOUT),
  STETH: memoize(chainlinkLookup("STETH_USD"), PRICE_EXPIRY_TIMEOUT),
  UNI: memoize(chainlinkLookup("UNI_USD"), PRICE_EXPIRY_TIMEOUT),
  BTC: memoize(chainlinkLookup("BTC_USD"), PRICE_EXPIRY_TIMEOUT),
  WBTC: memoize(WBTC, PRICE_EXPIRY_TIMEOUT),
  LDO: memoize(multiChainlinkLookup("LDO_ETH", "ETH_USD"), PRICE_EXPIRY_TIMEOUT),
  weETH: memoize(multiChainlinkLookup("weETH_ETH", "ETH_USD"), PRICE_EXPIRY_TIMEOUT),
  wstETH: memoize(WSTETH, PRICE_EXPIRY_TIMEOUT)
};
