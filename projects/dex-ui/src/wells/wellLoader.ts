import { BeanstalkSDK } from "@beanstalk/sdk";
import { Aquifer } from "@beanstalk/sdk/Wells";
import memoize from "lodash/memoize";

// import { Aquifer__factory } from "@beanstalk/wells";
import { AQUIFER } from "src/constants/addresses";

type WellAddresses = string[];

const loadFromChain = async (sdk: BeanstalkSDK): Promise<WellAddresses> => {
  const aquifer = new Aquifer(sdk.wells, AQUIFER);
  const contract = aquifer.contract;
  const eventFilter = contract.filters.BoreWell();

  const fromBlock = Number(import.meta.env.VITE_WELLS_START_BLOCK) || 16400000;
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
    const addresses = await Promise.any([loadFromChain(sdk), loadFromGraph()]);

    return addresses;
  },
  () => 1
);
