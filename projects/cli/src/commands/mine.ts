import { BeanstalkSDK } from "@beanstalk/sdk";
import chalk from "chalk";
import { table } from "table";

export const mineBlocks = async (sdk: BeanstalkSDK, amount) => {
  const numBlocks = amount === "50000" ? 1 : amount;

  async function mineBlocks(blockNumber) {
    while (blockNumber > 0) {
      blockNumber--;
      await sdk.provider.send("evm_mine", []);
    }
  }

  await mineBlocks(numBlocks);

  console.log(`${chalk.bold.whiteBright("Mined ")} ${chalk.greenBright(numBlocks)} block(s)`);
};
