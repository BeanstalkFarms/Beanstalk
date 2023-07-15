import { BeanstalkSDK } from "@beanstalk/sdk";
import { Aquifer, Well } from "@beanstalk/sdk/Wells";

export const getWellsFromAquifer = async (sdk: BeanstalkSDK, address: string): Promise<Well[]> => {
  const aquifer = new Aquifer(sdk.wells, address);
  const contract = aquifer.contract;
  const eventFilter = contract.filters.BoreWell();

  const fromBlock = 17138465;
  const toBlock = "latest";
  const events = await contract.queryFilter(eventFilter, fromBlock, toBlock);

  const wells = Promise.all(
    events.map((e) => {
      const data = e.decode?.(e.data);
      return sdk.wells.getWell(data.well);
    })
  );

  return wells;
};

export const getWell = async (token1, token2, wells) => {
  for await (const well of wells) {
    const tokens = wells.tokens || (await well.getTokens());
    const symbols = tokens.map((t) => t.symbol);

    if (symbols.includes(token1.symbol) && symbols.includes(token2.symbol)) {
      return well;
    }
  }
};
