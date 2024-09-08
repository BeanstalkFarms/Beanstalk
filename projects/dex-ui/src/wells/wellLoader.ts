import memoize from "lodash/memoize";

import { BeanstalkSDK, ChainId } from "@beanstalk/sdk";
import { Address } from "@beanstalk/sdk-core";
import { Aquifer } from "@beanstalk/sdk-wells";

import { GetWellAddressesDocument } from "src/generated/graph/graphql";
import { Settings } from "src/settings";
import { getChainIdOrFallbackChainId } from "src/utils/chain";
import { Log } from "src/utils/logger";

import { fetchFromSubgraphRequest } from "./subgraphFetch";

type WellAddresses = string[];

const WELL_BLACKLIST: Record<number, WellAddresses> = {
  [ChainId.ETH_MAINNET]: [
    "0x875b1da8dcba757398db2bc35043a72b4b62195d".toLowerCase(),
    "0xBea0061680A2DEeBFA59076d77e0b6c769660595".toLowerCase(), // bean:wstETH duplicate
    "0xbEa00022Ee2F7E2eb222f75fE79eFE4871E655ca".toLowerCase(), // bean:wstETH duplicate
    "0xbea0009b5b96D87643DFB7392293f18af7C041F4".toLowerCase(), // bean:wstETH duplicate
    "0x5997111CbBAA0f4C613Ae678Ba4803e764140266".toLowerCase() // usdc:frax duplicate
  ],
  [ChainId.ARBITRUM_MAINNET]: [
    "0x0adf75da6980fee8f848d52a7af1f8d6f34a8169".toLowerCase(), // bean:WETH duplicate,
    "0xb968de36ce9c61371a82a78b715af660c2209d11".toLowerCase(), // bean:wstETH duplicate
    "0x8d74ff8e729b4e78898488775b619c05d1ecb5e5".toLowerCase(), // bean:weETH duplicate
    "0x370062BE2d6Fc8d02948fEA75fAfe471F74854CF".toLowerCase(), // bean:WBTC duplicate
    "0x157219b5D112F2D8aaFD3c7F3bA5D4c73343cc96".toLowerCase(), // bean:USDC duplicate
    "0xF3e4FC5c53D5500989e68F81d070094525caC240".toLowerCase() // bean:USDT duplicate
  ]
};

const loadFromChain = async (sdk: BeanstalkSDK, aquifer: Aquifer): Promise<WellAddresses> => {
  const chainId = getChainIdOrFallbackChainId(sdk.chainId);

  const contract = aquifer.contract;
  const eventFilter = contract.filters.BoreWell();

  const fromBlock = Number(Settings.WELLS_ORIGIN_BLOCK);
  const toBlock = "latest";
  const events = await contract.queryFilter(eventFilter, fromBlock, toBlock);

  const blacklist = WELL_BLACKLIST[chainId];

  const addresses = events
    .map((e) => {
      const data = e.decode?.(e.data);
      return data.well;
    })
    .filter((addr) => !blacklist.includes(addr.toLowerCase()));

  return addresses;
};

const loadFromGraph = async (_chainId: ChainId): Promise<WellAddresses> => {
  const data = await fetchFromSubgraphRequest(GetWellAddressesDocument, undefined);
  const results = await data();

  const chainId = getChainIdOrFallbackChainId(_chainId);
  const blacklist = WELL_BLACKLIST[chainId];

  return results.wells.map((w) => w.id).filter((addr) => !blacklist.includes(addr.toLowerCase()));
};

export const findWells = memoize(
  async (sdk: BeanstalkSDK, aquifer: Aquifer): Promise<WellAddresses> => {
    const result = await Promise.any([
      loadFromChain(sdk, aquifer)
        .then((res) => {
          Log.module("wells").debug("Used blockchain to load wells");
          return res;
        })
        .catch((err) => {
          Log.module("wells").error("Error loading wells from blockchain: ", err);
          throw err;
        })

      // BS3TODO: Fix me when subgraph endpoints are updated
      // loadFromGraph(sdk.chainId)
      //   .then((res) => {
      //     Log.module("wells").debug("Used subgraph to load wells");
      //     return res;
      //   })
      //   .catch((err) => {
      //     Log.module("wells").warn("Error loading wells from subgraph: ", err);
      //     throw err;
      //   })
    ]);

    const wellLPAddresses = sdk.pools.getWells().map((w) => w.address.toLowerCase());
    const resultAddresses = result.map((r) => r.toLowerCase());
    const addresses = new Set([...wellLPAddresses, ...resultAddresses]);

    if (!addresses.size) {
      throw new Error("No deployed wells found");
    }

    return [...addresses];
  },
  // Override the default memoize caching with just a '1'
  // so it always caches, regardless of parameter passed
  (sdk) => sdk.chainId?.toString() || "no-chain-id"
);
