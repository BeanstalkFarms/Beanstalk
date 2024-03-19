import { TokenValue } from "@beanstalk/sdk-core";
import { account as _account, impersonate, chain } from "./setup";
import { defaultAbiCoder } from "ethers/lib/utils";

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const account = process.argv[3] || _account;
  const { sdk, stop } = await impersonate(account);
  sdk.DEBUG = false;

  let deltaB = await sdk.bean.getDeltaB();

  if (deltaB.gte(TokenValue.ZERO)) {
    await chain.setPriceUnder1();
  } else {
    await chain.setPriceOver1();
  }
  // chain.mine()
  deltaB = await sdk.bean.getDeltaB();
  console.log("New DeltaB: ", deltaB.toHuman());
}
