import { BeanstalkSDK } from "@beanstalk/sdk";
import chalk from "chalk";

export const getDeltaB = async (sdk: BeanstalkSDK) => {
  const deltaB = await sdk.bean.getDeltaB();
  console.log(`${chalk.bold.whiteBright("DeltaB: ")} ${chalk.greenBright(deltaB.toHuman())}`);
};
