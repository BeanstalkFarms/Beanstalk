import { Token } from "@beanstalk/sdk";
import chalk from "chalk";
import { sdk, account as _account, chain } from "./setup";

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  let token = process.argv[3];
  let amount = process.argv[4] || "30000";
  let account = process.argv[5] || _account;
  console.log(process.argv.length);

  if (process.argv.length === 3) {
    console.log(`${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)}`);
    console.log(`Setting ${chalk.bold("All Balances")} to ${chalk.greenBright(amount)}`);

    await chain.setAllBalances(account, amount);
  } else if (process.argv.length === 4) {
    let account = process.argv[3];
    console.log(`${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)}`);
    console.log(`Setting ${chalk.bold("All Balances")} to ${chalk.greenBright(amount)}`);

    await chain.setAllBalances(account, amount);
  } else if (process.argv.length >= 5) {
    console.log(`${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)}`);
    console.log(`Setting ${chalk.bold(token)} to ${chalk.greenBright(amount)}`);

    let t = sdk.tokens[token] as Token;
    if (token === "urBEAN") t = sdk.tokens.UNRIPE_BEAN;
    if (token === "urBEAN3CRV") t = sdk.tokens.UNRIPE_BEAN_CRV3;
    if (token === "BEAN3CRV") t = sdk.tokens.BEAN_CRV3_LP;

    await chain[`set${token}Balance`](account, t.amount(amount));
  } else {
    console.log(chalk.yellow("Usage:"));
    console.log(chalk.white("yarn x src/setbalances.ts"), chalk.blue("- set all balances to 50,000"));
    console.log(
      chalk.white("yarn x src/setbalances.ts TOKEN AMOUNT [0xAddress]"),
      chalk.blue("- set balance of TOKEN to AMOUNT, optionally for 0xADDRESS")
    );
  }
}
