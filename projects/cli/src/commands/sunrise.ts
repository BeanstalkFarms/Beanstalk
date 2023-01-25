import { BeanstalkSDK, Token } from "@beanstalk/sdk";
import chalk from "chalk";

export const sunrise = async (sdk, chain, {}) => {
  const localSeason = await sdk.contracts.beanstalk.season();
  const seasonTime = await sdk.contracts.beanstalk.seasonTime();

  if (localSeason === seasonTime) {
    console.log(`No need, ${chalk.bold.yellowBright(localSeason)} is the current season.`);
    process.exit(0);
  }

  const diff = seasonTime - localSeason;
  callSunrise(sdk);
  if (diff > 1) {
    console.log(`You are still behind by ${diff - 1} seasons. May need to call it again.`);
  }
};

async function callSunrise(sdk: BeanstalkSDK) {
  try {
    const res = await sdk.contracts.beanstalk.sunrise();
    await res.wait();
    const season = await sdk.contracts.beanstalk.season();
    console.log(`${chalk.bold.greenBright("sunrise()")} called. New season is ${chalk.bold.yellowBright(season)}`);
  } catch (err: any) {
    console.log(err);
  }
}
