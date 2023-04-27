import { BeanstalkSDK } from "@beanstalk/sdk";
import { Aquifer } from "@beanstalk/sdk/Wells";
import memoize from "lodash/memoize";
import { Settings } from "src/settings";

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
  throw new Error("Not implemented");
};

export const getWellAddresses = memoize(
  async (sdk: BeanstalkSDK): Promise<WellAddresses> => {
    const addresses = await Promise.any([
      loadFromChain(sdk).then((res) => {
        console.log("Loaded Wells from blockchain");
        return res;
      }),
      loadFromGraph().then((res) => {
        console.log("Loaded Wells from subgraph");
        return res;
      })
    ]);
    if (addresses.length === 0) throw new Error("No deployed wells found");

    return addresses;
  },
  // Override the default memoize caching with just a '1' 
  // so it always caches, regardless of parameter passed
  () => 1 
);
