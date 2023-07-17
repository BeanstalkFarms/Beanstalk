import { WellsSDK } from "@beanstalk/sdk-wells";
import { BeanstalkSDK, TestUtils } from "@beanstalk/sdk";
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

  const A = sdk.tokens.WETH;
  const B = sdk.tokens.BEAN;

  const amountA = A.amount(1);
  const amountB = B.amount(3000);

  // get Well object
  const well = await sdk.getWell(WELL_ADDRESS);

  // give user tokens and set allowances
  await forkUtils.setBalance(A.address, account, amountA);
  await A.approve(well.address, amountA);

  // await forkUtils.setBalance(B.address, account, amountB);
  // await B.approve(well.address, TokenValue.MAX_UINT256);

  // Swap From : A => B
  const quoteFrom = await well.swapFromQuote(A, B, amountA);
  console.log(`Quote: ${amountA.toHuman()} ${A.symbol} returns ${quoteFrom.toHuman()} ${B.symbol}`);
  // const tx = await well.swapFrom(A, B, amountA, quoteFrom.subSlippage(0.1), account, 300, {});
  // await tx.wait();

  // const p = [
  //   A.address,
  //   B.address,
  //   amountA.toBigNumber(),
  //   quoteFrom.subSlippage(1).toBigNumber(),
  //   account,
  //   300,
  //   {}
  // ];
  // console.log(p);

  const tx2 = await well.contract.swapFrom(
    A.address,
    B.address,
    amountA.toBigNumber(),
    quoteFrom.subSlippage(1).toBigNumber(),
    account,
    1680830458489,
    {}
  );
  await tx2.wait();
  console.log("dones");
}
