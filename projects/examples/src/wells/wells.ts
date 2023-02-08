import { provider } from "../setup";
import { WellsSDK } from "@beanstalk/wells";

const WELL_ADDRESS = "0x906b067e392e2c5f9e4f101f36c0b8cda4885ebf";

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const sdk = new WellsSDK({ provider });
  const well = sdk.getWell(WELL_ADDRESS);

  // Tokens
  const tokens = await well.tokens();
  console.log(`This well has ${tokens.length} tokens: [${tokens.map((t) => t.symbol).join(", ")}]\n`);

  // Get the Well's LP Token
  const lp = await well.getLPToken();
  console.log(`Well's LP Token`);
  console.log(lp)
  
  well.contract;
}
