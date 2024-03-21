import { BeanstalkSDK } from "@beanstalk/sdk";
import { BlockchainUtils } from "@beanstalk/sdk/dist/types/utils/TestUtils";
import chalk from "chalk";
import { table } from "table";

export const setDeltaB = async (sdk: BeanstalkSDK, chain: BlockchainUtils, direction: string, amount) => {
  const multiplier = amount === "50000" ? 2 : amount;
  if (direction === "down") {
    await chain.setPriceUnder1(multiplier);
  } else if (direction === "up") {
    await chain.setPriceOver1(multiplier);
  } else {
    console.log(`unknown input: ${direction}. Expected "up", or "down"`);
  }

  const deltaB = await sdk.bean.getDeltaB();
  console.log(`${chalk.bold.whiteBright("New DeltaB: ")} ${chalk.greenBright(deltaB.toHuman())}`);
};
