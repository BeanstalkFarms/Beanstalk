import { BeanstalkSDK, ChainId, TokenValue } from "@beanstalk/sdk";
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

const FEEDS = {
  /// BTC Feeds
  WBTC_BTC: "0xfdFD9C85aD200c506Cf9e21F1FD8dd01932FBB23",

  /// ETH Data Feeds
  LDO_ETH: "0x4e844125952D32AcdF339BE976c98E22F6F318dB",
  WeETH_ETH: "0x5c9C449BbC9a6075A2c061dF312a35fd1E05fF22",

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
};

const chainlinkLookup = (feed: keyof typeof FEEDS) => async (sdk: BeanstalkSDK) => {
  const address = FEEDS[feed];
  Log.module("price").debug(
    `Fetching ${sdk.tokens.findByAddress(address)?.symbol || address} price`
  );
  const contract = PriceContract__factory.connect(address, sdk.providerOrSigner);
  const { answer } = await contract.latestRoundData();
  const decimals = await contract.decimals();

  return TokenValue.fromBlockchain(answer, decimals);
};

const multiChainlinkLookup =
  (from: keyof typeof FEEDS, to: keyof typeof FEEDS) => async (sdk: BeanstalkSDK) => {
    const [fromPrice, toPrice] = await Promise.all([
      chainlinkLookup(from)(sdk),
      chainlinkLookup(to)(sdk)
    ]);

    return toPrice.mul(fromPrice);
  };

const BEAN = async (sdk: BeanstalkSDK) => {
  Log.module("price").debug("Fetching BEAN price");
  return sdk.bean.getPrice();
};

const chainLinkWithCallback =
  (
    from: keyof typeof FEEDS,
    getMultiplier: (sdk: BeanstalkSDK) => Promise<(value: TokenValue) => TokenValue>
  ) =>
  async (sdk: BeanstalkSDK) => {
    const [fromPrice, calculate] = await Promise.all([
      chainlinkLookup(from)(sdk),
      getMultiplier(sdk)
    ]);

    return calculate(fromPrice);
  };

const getWstETHWithSteth = async (sdk: BeanstalkSDK) => {
  const amt = sdk.tokens.STETH.fromHuman("1");
  const divisor = await sdk.contracts.lido.wsteth.getWstETHByStETH(amt.toBigNumber());

  const value = sdk.tokens.WSTETH.fromBlockchain(divisor);
  return (otherValue: TokenValue) => otherValue.div(value);
};

const PRICE_EXPIRY_TIMEOUT = 60 * 5; // 5 minute cache

export const PriceLookups: Record<string, (sdk: BeanstalkSDK) => Promise<TokenValue>> = {
  BEAN: memoize(BEAN, PRICE_EXPIRY_TIMEOUT),
  ETH: memoize(chainlinkLookup("ETH_USD"), PRICE_EXPIRY_TIMEOUT),
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
  WBTC: memoize(multiChainlinkLookup("WBTC_BTC", "BTC_USD"), PRICE_EXPIRY_TIMEOUT),
  LDO: memoize(multiChainlinkLookup("LDO_ETH", "ETH_USD"), PRICE_EXPIRY_TIMEOUT),
  weETH: memoize(multiChainlinkLookup("WeETH_ETH", "ETH_USD"), PRICE_EXPIRY_TIMEOUT),
  wstETH: memoize(chainLinkWithCallback("STETH_USD", getWstETHWithSteth), PRICE_EXPIRY_TIMEOUT)
};

export const priceLookup = {
  [ChainId.ETH_MAINNET]: {
    BEAN: memoize(BEAN, PRICE_EXPIRY_TIMEOUT),
    ETH: memoize(chainlinkLookup("ETH_USD"), PRICE_EXPIRY_TIMEOUT),
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
    WBTC: memoize(multiChainlinkLookup("WBTC_BTC", "BTC_USD"), PRICE_EXPIRY_TIMEOUT),
    LDO: memoize(multiChainlinkLookup("LDO_ETH", "ETH_USD"), PRICE_EXPIRY_TIMEOUT),
    weETH: memoize(multiChainlinkLookup("WeETH_ETH", "ETH_USD"), PRICE_EXPIRY_TIMEOUT),
    wstETH: memoize(chainLinkWithCallback("STETH_USD", getWstETHWithSteth), PRICE_EXPIRY_TIMEOUT)
  }
};
