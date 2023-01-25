import { BeanstalkSDK, Token } from "@beanstalk/sdk";
import chalk from "chalk";

export const sunrise = async (sdk, chain, { force }) => {
  const localSeason = await sdk.contracts.beanstalk.season();
  const seasonTime = await sdk.contracts.beanstalk.seasonTime();
  const diff = seasonTime - localSeason;

  if (force) {
    if (diff <= 0) {
      await fastForward(sdk);
    }
  } else if (localSeason === seasonTime) {
    console.log(`No need, ${chalk.bold.yellowBright(localSeason)} is the current season.`);
    return;
  }

  await callSunrise(sdk);

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
    console.log(`sunrise() call failed: ${err.reason}`);
  }
}

async function fastForward(sdk: BeanstalkSDK) {
  console.log("Fast forwarding time to next season...");
  try {
    const block = await sdk.provider.send("eth_getBlockByNumber", ["latest", false]);
    const blockTs = parseInt(block.timestamp, 16);
    const blockDate = new Date(blockTs * 1000);
    const secondsTillNextHour = (3600000 - (blockDate.getTime() % 3600000)) / 1000;

    await sdk.provider.send("evm_increaseTime", [secondsTillNextHour]);
    await sdk.provider.send("evm_mine", []);
    await forceBlock(sdk);
  } catch (err: any) {
    console.log(`Fast forwarding time failed`);
    console.log(err);
  }
}

async function forceBlock(sdk: BeanstalkSDK) {
  await sdk.provider.send("evm_increaseTime", [12]);
  await sdk.provider.send("evm_mine", []);
}
