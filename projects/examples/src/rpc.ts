import chalk from "chalk";
import { account as _account, impersonate, sdk } from "./setup";

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const account = process.argv[3] || _account;
  console.log(`${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)}`);
  // const { sdk, stop } = await impersonate(account);

  const nonce = await sdk.provider.getTransactionCount(account);
  console.log("Nonce is ", nonce);

  // await stop();
}
