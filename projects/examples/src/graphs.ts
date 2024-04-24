import chalk from "chalk";
import { account as _account, impersonate, chain } from "./setup";

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const account = process.argv[3] || _account;
  console.log(`${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)}`);
  const { sdk, stop } = await impersonate(account);

  console.log("--- SWAP ---");
  sdk.swap.getGraph();

  console.log("\n\n--- DEPOSIT ----");
  // @ts-ignore
  sdk.silo.depositBuilder.getGraph();
  await stop();
}
