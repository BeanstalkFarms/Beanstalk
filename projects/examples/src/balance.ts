import { sdk, account as _account } from "./setup";
import { table } from "table";
import chalk from "chalk";
import { TokenValue } from "@beanstalk/sdk";

let account: string = _account;

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const arg = process.argv[3];
  let symbol: string | undefined = undefined;

  if (arg) {
    if (arg.startsWith("0x")) {
      account = arg;
    } else {
      symbol = arg;
    }
  }
  console.log(`${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)}`);
  let res = [[chalk.bold("Token"), chalk.bold("Internal"), chalk.bold("External"), chalk.bold("Total")]];

  if (symbol) {
    res.push(await getBal(symbol, account));
  } else {
    const bals = await Promise.all(
      ["ETH", "WETH", "BEAN", "USDT", "USDC", "DAI", "CRV3", "UNRIPE_BEAN", "UNRIPE_BEAN_CRV3", "BEAN_CRV3_LP", "ROOT"].map((s) =>
        getBal(s, account)
      )
    );
    res.push(...bals);
  }
  console.log(table(res));
}

async function getBal(symbol: string, account: string) {
  const token = sdk.tokens[symbol];
  if (!token) throw new Error(`No token found: ${symbol}`);

  try {
    const bal = await sdk.tokens.getBalance(token, account);
    return [
      chalk.grey(token.symbol),
      chalk.green(bal.internal.toHuman()),
      chalk.green(bal.external.toHuman()),
      chalk.greenBright(bal.total.toHuman())
    ];
  } catch (e) {
    return [chalk.red(token.symbol), " -- ", " -- ", " -- "];
  }
}
