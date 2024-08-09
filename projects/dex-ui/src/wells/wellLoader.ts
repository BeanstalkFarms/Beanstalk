import { BeanstalkSDK } from "@beanstalk/sdk";
import { Aquifer } from "@beanstalk/sdk/Wells";
import memoize from "lodash/memoize";
import { Settings } from "src/settings";
import { Log } from "src/utils/logger";
import { fetchFromSubgraphRequest } from "./subgraphFetch";
import { GetWellAddressesDocument } from "src/generated/graph/graphql";

type WellAddresses = string[];

const WELL_BLACKLIST = [
  "0x875b1da8dcba757398db2bc35043a72b4b62195d".toLowerCase(),
  "0xBea0061680A2DEeBFA59076d77e0b6c769660595".toLowerCase(), // bean:wstETH duplicate
  "0xbEa00022Ee2F7E2eb222f75fE79eFE4871E655ca".toLowerCase(), // bean:wstETH duplicate
  "0xbea0009b5b96D87643DFB7392293f18af7C041F4".toLowerCase(), // bean:wstETH duplicate
  "0x5997111CbBAA0f4C613Ae678Ba4803e764140266".toLowerCase() // usdc:frax duplicate
];

const loadFromChain = async (sdk: BeanstalkSDK): Promise<WellAddresses> => {
  const aquifer = new Aquifer(sdk.wells, Settings.AQUIFER_ADDRESS);
  const contract = aquifer.contract;
  const eventFilter = contract.filters.BoreWell();

  const fromBlock = Number(Settings.WELLS_ORIGIN_BLOCK);
  const toBlock = "latest";
  const events = await contract.queryFilter(eventFilter, fromBlock, toBlock);

  const addresses = events
    .map((e) => {
      const data = e.decode?.(e.data);
      return data.well;
    })
    .filter((addr) => !WELL_BLACKLIST.includes(addr.toLowerCase()));

  return addresses;
};

const loadFromGraph = async (): Promise<WellAddresses> => {
  const data = await fetchFromSubgraphRequest(GetWellAddressesDocument, undefined);
  const results = await data();

  return results.wells.map((w) => w.id).filter((addr) => !WELL_BLACKLIST.includes(addr.toLowerCase()));
};

export const findWells = memoize(
  async (sdk: BeanstalkSDK): Promise<WellAddresses> => {
    const addresses = await Promise.any([
      loadFromChain(sdk)
        .then((res) => {
          Log.module("wells").debug("Used blockchain to load wells");
          return res;
        })
        .catch((err) => {
          Log.module("wells").error("Error loading wells from blockchain: ", err);
          throw err;
        }),
      loadFromGraph()
        .then((res) => {
          Log.module("wells").debug("Used subgraph to load wells");
          return res;
        })
        .catch((err) => {
          Log.module("wells").warn("Error loading wells from subgraph: ", err);
          throw err;
        })
    ]);
    if (addresses.length === 0) {
      throw new Error("No deployed wells found");
    }

    return addresses;
  },
  // Override the default memoize caching with just a '1'
  // so it always caches, regardless of parameter passed
  () => 1
);
