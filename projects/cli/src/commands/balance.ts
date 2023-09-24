import chalk from "chalk";
import { table } from "table";

export const balance = async (sdk, { account, symbol }) => {
  console.log(`${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)}`);
  let res = [[chalk.bold("Token"), chalk.bold("Internal"), chalk.bold("External"), chalk.bold("Total")]];

  if (symbol) {
    res.push(await getBal(sdk, symbol, account));
  } else {
    const bals = await Promise.all(
      [
        "ETH",
        "WETH",
        "BEAN",
        "USDT",
        "USDC",
        "DAI",
        "CRV3",
        "UNRIPE_BEAN",
        "UNRIPE_BEAN_WETH",
        "BEAN_CRV3_LP",
        "BEAN_ETH_WELL_LP",
        "ROOT"
      ].map((s) => getBal(sdk, s, account))
    );
    res.push(...bals);
  }
  console.log(table(res));
};

async function getBal(sdk, symbol: string, account: string) {
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
  } catch (e: any) {
    console.log(e.message);
    return [chalk.red(token.symbol), " -- ", " -- ", " -- "];
  }
}
