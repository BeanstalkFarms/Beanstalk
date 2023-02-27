import { provider } from "../setup";
import { WellsSDK, Well } from "@beanstalk/wells";

const WELL_ADDRESS = "0x0fa5B1566aA32b3dcD106af76c3a421dB6134D4D";

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const sdk = new WellsSDK({ provider });

  // get Well object
  const well: Well = await sdk.getWell(WELL_ADDRESS, { name: true });
  await well.loadWell();
  console.log(well);
}
