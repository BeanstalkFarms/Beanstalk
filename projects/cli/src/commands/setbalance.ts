import { Token } from "@beanstalk/sdk";
import chalk from "chalk";

export const setbalance = async (sdk, chain, { account, symbol, amount }) => {
  console.log(
    `Set balance for ${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)} - ${chalk.bold.whiteBright(
      symbol ?? "ALL Tokens"
    )}:${chalk.bold.greenBright(amount)}`
  );

  if (!symbol) {
    await chain.setAllBalances(account, amount);
  } else {
    const symbols = [
      "ETH",
      "WETH",
      "WSTETH",
      "WEETH",
      "WBTC",
      "BEAN",
      "DAI",
      "USDC",
      "USDT",
      "urBEAN",
      "urBEANwstETH",
      "BEANWETH",
      "BEANWSTETH",
      "BEANWEETH",
      "BEANWBTC",
      "BEANUSDC",
      "BEANUSDT"
    ];
    if (!symbols.includes(symbol)) {
      console.log(
        `${chalk.bold.red("Error")} - ${chalk.bold.white(symbol)} is not a valid token. Valid options are: `
      );
      console.log(symbols.map((s) => chalk.green(s)).join(", "));
      process.exit(-1);
    }
    let t = sdk.tokens[symbol] as Token;
    if (!t) {
      if (symbol === "urBEAN") t = sdk.tokens.UNRIPE_BEAN;
      if (symbol === "urBEANwstETH") t = sdk.tokens.UNRIPE_BEAN_WSTETH;
      if (symbol === "BEANWETH") t = sdk.tokens.BEAN_ETH_WELL_LP;
      if (symbol === "BEANWEETH") t = sdk.tokens.BEAN_WEETH_WELL_LP;
      if (symbol === "BEANWSTETH") t = sdk.tokens.BEAN_WSTETH_WELL_LP;
      if (symbol === "BEANWBTC") t = sdk.tokens.BEAN_WBTC_WELL_LP;
      if (symbol === "BEANUSDC") t = sdk.tokens.BEAN_USDC_WELL_LP;
      if (symbol === "BEANUSDT") t = sdk.tokens.BEAN_USDT_WELL_LP;
    }
    if (typeof chain[`set${symbol}Balance`] !== "function")
      throw new Error(`${symbol} is not a valid token or the method ${chalk.bold.whiteBright("")}`);

    await chain[`set${symbol}Balance`](account, t.amount(amount));
  }
};
