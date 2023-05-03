import { BeanstalkSDK } from "@beanstalk/sdk";
import { Aquifer } from "@beanstalk/sdk/Wells";
import memoize from "lodash/memoize";
import { Settings } from "src/settings";
import { Log } from "src/utils/logger";
import { fetchFromSubgraphRequest } from "./subgraphFetch";
import { GetWellAddressesDocument } from "src/generated/graphql";

type WellAddresses = string[];

const loadFromChain = async (sdk: BeanstalkSDK): Promise<WellAddresses> => {
  const aquifer = new Aquifer(sdk.wells, Settings.AQUIFER_ADDRESS);
  const contract = aquifer.contract;
  const eventFilter = contract.filters.BoreWell();

  const fromBlock = Number(Settings.WELLS_ORIGIN_BLOCK);
  const toBlock = "latest";
  const events = await contract.queryFilter(eventFilter, fromBlock, toBlock);

  const addresses = events.map((e) => {
    const data = e.decode?.(e.data);
    return data.well;
  });

  return addresses;
};

const loadFromGraph = async (): Promise<WellAddresses> => {
  const data = await fetchFromSubgraphRequest(GetWellAddressesDocument, undefined);
  const results = await data();

  return results.wells.map((w) => w.id);
};

export const getWellAddresses = memoize(
  async (sdk: BeanstalkSDK): Promise<WellAddresses> => {
    const addresses = await Promise.any([
      loadFromChain(sdk)
        .then((res) => {
          Log.module("wells").debug("Loaded well addresses from blockchain");
          return res;
        })
        .catch((err) => {
          Log.module("wells").error("Error loading wells from blockchain: ", err);
          throw err;
        }),
      loadFromGraph()
        .then((res) => {
          Log.module("wells").debug("Loaded wells addresses from subgraph");
          return res;
        })
        .catch((err) => {
          Log.module("wells").error("Error loading wells from subgraph: ", err);
          throw err;
        })
    ]);
    if (addresses.length === 0) throw new Error("No deployed wells found");

    return addresses;
  },
  // Override the default memoize caching with just a '1'
  // so it always caches, regardless of parameter passed
  () => 1
);
