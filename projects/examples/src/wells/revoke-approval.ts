import { WellsSDK } from "@beanstalk/wells";
import { TestUtils } from "@beanstalk/sdk";
import { signer, account, sdk as bsdk } from "../setup";
import { TokenValue } from "@beanstalk/sdk-core";

const WELL_ADDRESS = process.env.WELL_ADDRESS!;

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const sdk = new WellsSDK({ signer });
  const forkUtils = new TestUtils.BlockchainUtils(bsdk);

  const BEAN = sdk.tokens.BEAN;
  const WETH = sdk.tokens.WETH;

  const well = await sdk.getWell(WELL_ADDRESS);

  await BEAN.approve(well.address, TokenValue.ZERO);
  await WETH.approve(well.address, TokenValue.ZERO);

  const allowanceBean = await BEAN.getAllowance(account, well.address);
  const allowanceWeth = await WETH.getAllowance(account, well.address);

  console.log("Revoked allownace");
  console.log(`Current BEAN allowance: ${allowanceBean}`);
  console.log(`Current WETH allowance: ${allowanceWeth}`);
}
