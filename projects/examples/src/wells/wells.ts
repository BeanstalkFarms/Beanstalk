import { provider } from "../setup";
import { WellsSDK } from "@beanstalk/wells";
import { Well } from "@beanstalk/wells/dist/types/lib/Well";

const WELL_ADDRESS = "0xd94a92749c0bb33c4e4ba7980c6dad0e3effb720";

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const sdk = new WellsSDK({ provider });

  // get Well object
  const well: Well = await sdk.getWell(WELL_ADDRESS);
  console.log(well);
}
