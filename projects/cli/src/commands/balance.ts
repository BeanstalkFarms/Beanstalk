import chalk from "chalk";
import { table } from "table";

export const balance = async (sdk, { account, symbol }) => {
  console.log(`${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)}`);
  let res = [
    [chalk.bold("Token"), chalk.bold("Internal"), chalk.bold("External"), chalk.bold("Total")]
  ];

  if (symbol) {
    res.push(await getBal(sdk, symbol, account));
  } else {
    const bals = await Promise.all(
      [
        "ETH",
        "WETH",
        "WSTETH",
        "STETH",
        "WEETH",
        "WBTC",
        "BEAN",
        "DAI",
        "USDC",
        "USDT",
        "ARB",
        "urBEAN",
        "urBEANwstETH",
        "BEANWETH",
        "BEANWSTETH",
        "BEANWEETH",
        "BEANWBTC",
        "BEANUSDC",
        "BEANUSDT"
      ].map((s) => getBal(sdk, s, account))
    );
    res.push(...bals);
  }
  console.log(table(res));
};

async function getBal(sdk, symbol: string, account: string) {
  let token = sdk.tokens[symbol];
  if (!token) {
    if (symbol === "urBEAN") token = sdk.tokens.UNRIPE_BEAN;
    if (symbol === "urBEANwstETH") token = sdk.tokens.UNRIPE_BEAN_WSTETH;
    if (symbol === "BEANWETH") token = sdk.tokens.BEAN_ETH_WELL_LP;
    if (symbol === "BEANWEETH") token = sdk.tokens.BEAN_WEETH_WELL_LP;
    if (symbol === "BEANWSTETH") token = sdk.tokens.BEAN_WSTETH_WELL_LP;
    if (symbol === "BEANWBTC") token = sdk.tokens.BEAN_WBTC_WELL_LP;
    if (symbol === "BEANUSDC") token = sdk.tokens.BEAN_USDC_WELL_LP;
    if (symbol === "BEANUSDT") token = sdk.tokens.BEAN_USDT_WELL_LP;
  }
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
