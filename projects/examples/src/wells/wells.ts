import { provider } from "../setup";
import { WellsSDK, Well } from "@beanstalk/wells";

const WELL_ADDRESS = process.env.WELL_ADDRESS!;

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const sdk = new WellsSDK({ provider });

  // get Well object
  console.log(WELL_ADDRESS);
  const well: Well = await sdk.getWell(WELL_ADDRESS);
  console.log(well);
}
