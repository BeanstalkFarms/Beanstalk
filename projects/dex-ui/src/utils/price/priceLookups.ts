import { BeanstalkSDK, TokenValue } from "@beanstalk/sdk";
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

const ETH_USD = "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419";
const USDC_USD = "0x8fffffd4afb6115b954bd326cbe7b4ba576818f6";
const DAI_USD = "0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9";

const chainlinkLookup = (address: string) => async (sdk: BeanstalkSDK) => {
  Log.module("price").debug(`Fetching ${sdk.tokens.findByAddress(address)?.symbol || address} price`);
  const contract = PriceContract__factory.connect(address, sdk.providerOrSigner);
  const { answer } = await contract.latestRoundData();
  const decimals = await contract.decimals();

  return TokenValue.fromBlockchain(answer, decimals);
};

const BEAN = async (sdk: BeanstalkSDK) => {
  Log.module("price").debug("Fetching BEAN price");
  return sdk.bean.getPrice();
};

const PRICE_EXPIRY_TIMEOUT = 60 * 5; // 5 minute cache

export const PriceLookups: Record<string, (sdk: BeanstalkSDK) => Promise<TokenValue>> = {
  BEAN: memoize(BEAN, PRICE_EXPIRY_TIMEOUT),
  ETH: memoize(chainlinkLookup(ETH_USD), PRICE_EXPIRY_TIMEOUT),
  WETH: memoize(chainlinkLookup(ETH_USD), PRICE_EXPIRY_TIMEOUT),
  USDC: memoize(chainlinkLookup(USDC_USD), PRICE_EXPIRY_TIMEOUT),
  DAI: memoize(chainlinkLookup(DAI_USD), PRICE_EXPIRY_TIMEOUT)
};
