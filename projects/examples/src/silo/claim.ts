import chalk from "chalk";

import { table } from "table";

import { account as _account, impersonate } from "../setup";
main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const account = process.argv[3] || _account;
  console.log(`${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)}`);

  // Some of the claiming contract methods don't accept an (account) parameter
  // and work off of msg.sender, so we need to impersonate the passed account.
  const { sdk, stop } = await impersonate(account);

  // Mow
  const mowTx = await sdk.silo.mow(account);
  await mowTx.wait();
  console.log("Mowed!");

  // Plant
  const plantTx = await sdk.silo.plant();
  await plantTx.wait();
  console.log("Planted!");

  await stop();
}
