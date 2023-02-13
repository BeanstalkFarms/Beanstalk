import { provider } from "../setup";
import { WellsSDK } from "@beanstalk/wells";

const WELL_ADDRESS = "0xd94a92749c0bb33c4e4ba7980c6dad0e3effb720";

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const sdk = new WellsSDK({ provider });

  // get Well object
  const well = sdk.getWell(WELL_ADDRESS);

  // const name = await well.getName();
  // const lp = await well.getLPToken();
  // const tokens = await well.getTokens();
  // const wellFunction = await well.getWellFunction();
  // const auger = await well.getAuger();
  // const pumps = await well.getPumps();

  await well.loadWell()

  console.log(well);

}
