import { provider } from "../setup";
import { WellsSDK } from "@beanstalk/wells";

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const sdk = new WellsSDK({ provider });
  let t = sdk.tokens.findBySymbol('BEAN')

  console.log(t);
}
