import { DataSource, Token, TokenValue } from "@beanstalk/sdk";
import chalk from "chalk";
import { table } from "table";

import { sdk, account as _account } from "../setup";
main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const account = process.argv[3] || _account;
  console.log(`${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)}`);

  await showSummary(account);
  await showSiloBalances(account);
}

async function showSummary(account: string) {
  const price = await sdk.bean.getPrice();
  console.log(`${chalk.bold.whiteBright("BEAN price:")} ${chalk.greenBright(price.toHuman())}`);
  const total = await getUSDTotalDeposits(account, price);
  const stalk = (await sdk.silo.getStalk(account)).toHuman();
  const seeds = (await sdk.silo.getSeeds(account)).toHuman();
  const earnedBeans = (await sdk.silo.getEarnedBeans(account)).toHuman();
  const earnedStalk = (await sdk.silo.getEarnedStalk(account)).toHuman();
  const plantableSeeds = (await sdk.silo.getPlantableSeeds(account)).toHuman();
  const grownStalk = (await sdk.silo.getGrownStalk(account)).toHuman();
  const revStalk = "not-implemented"; //(await sdk.silo.getRevitalizedStalk(account)).toHuman();
  const revSeeds = "not-implemented"; //(await sdk.silo.getRevitalizedSeeds(account)).toHuman();

  const earned = [
    ["Current Balances", "", "", "", "", ""],
    ["Total Deposits", "", "Stalk", "", "Seeds", ""],
    [total.toHuman(), "", stalk, "", seeds, ""],
    ["Earnings", "", "", "", "", ""],
    ["Earned Beans", "Earned Stalk", "Plantable Seeds", "Grown Stalk", "Revitalized Stalk", "Revitalized Seeds"],
    [earnedBeans, earnedStalk, plantableSeeds, grownStalk, revStalk, revSeeds]
  ];

  console.log(
    table(earned, {
      spanningCells: [
        { col: 0, row: 0, colSpan: 6, alignment: "center" },
        { col: 0, row: 3, colSpan: 6, alignment: "center" },
        { col: 0, row: 1, colSpan: 2 },
        { col: 2, row: 1, colSpan: 2 },
        { col: 4, row: 1, colSpan: 2 },
        { col: 0, row: 2, colSpan: 2 },
        { col: 2, row: 2, colSpan: 2 },
        { col: 4, row: 2, colSpan: 2 }
      ]
    })
  );
}

async function showSiloBalances(account: string) {
  const tokenBalances = await sdk.silo.getBalances(account, { source: DataSource.LEDGER });
  const t: any[] = [];
  t.push(["SILO Balances", "", "", "", ""]);
  t.push(["TOKEN", "TYPE", "AMOUNT", "BDV", "# of CRATES"]);
  for (const [token, balance] of tokenBalances) {
    // console.log(`${token.symbol}`);
    const deposited = {
      amount: balance.deposited.amount.toHuman(),
      bdv: balance.deposited.bdv.toHuman(),
      crates: balance.deposited.crates
    };
    const withdrawn = {
      amount: balance.withdrawn.amount.toHuman(),
      crates: balance.withdrawn.crates
    };
    const claimable = {
      amount: balance.claimable.amount.toHuman(),
      crates: balance.claimable.crates
    };

    t.push([chalk.green(token.symbol), "deposited", deposited.amount, deposited.bdv, deposited.crates.length]);
    t.push(["", "withdrawn", withdrawn.amount, "", withdrawn.crates.length]);
    t.push(["", "claimable", claimable.amount, "", claimable.crates.length]);
  }
  console.log(table(t, { spanningCells: [{ col: 0, row: 0, colSpan: 5, alignment: "center" }] }));
}

async function getUSDTotalDeposits(_account: string, price: TokenValue) {
  const tokenBalances = await sdk.silo.getBalances(_account);
  let total = TokenValue.ZERO;

  // get LP supply and liquididyt
  const supply = await sdk.tokens.BEAN_CRV3_LP.getTotalSupply();
  let liquidity;
  const { ps } = await sdk.contracts.beanstalkPrice.price();
  for (const item of ps) {
    if (item.pool.toLowerCase() === sdk.contracts.curve.pools.beanCrv3.address.toLowerCase()) {
      liquidity = TokenValue.fromBlockchain(item.liquidity, sdk.tokens.BEAN.decimals);
      continue;
    }
  }

  for (const [token, balance] of tokenBalances) {
    let amountToAdd;
    // Handle unrip tokens
    if (token.isUnripe) {
      const { chopRate } = await sdk.bean.getChopRate(token);
      if (token.symbol === "urBEAN") {
        amountToAdd = balance.deposited.amount.mul(chopRate).mul(price);
        // console.log(`${token.symbol}: Adding ${amountToAdd.toHuman()} USD`);
        continue;
      } else if (token.symbol === "urBEAN3CRV") {
        const choppedLPAmount = balance.deposited.amount.mul(chopRate);
        amountToAdd = choppedLPAmount.div(supply).mul(liquidity);
        // console.log(`${token.symbol}: Adding ${amountToAdd.toHuman()} USD`);
      } else {
        throw new Error(`Unknown unrip token: ${token.symbol}`);
      }
    }
    // handle normal tokens
    else {
      if (token.symbol === "BEAN") {
        amountToAdd = balance.deposited.bdv.mul(price);
        // console.log(`${token.symbol}: Adding ${amountToAdd.toHuman()} USD`);
      } else if (token.symbol === "BEAN3CRV") {
        amountToAdd = balance.deposited.amount.div(supply).mul(liquidity);
        // console.log(`${token.symbol}: Adding ${amountToAdd.toHuman()} USD`);
      } else {
        throw new Error(`Unknown unrip token: ${token.symbol}`);
      }
    }
    // add to running total
    total = total.add(amountToAdd);
  }
  return total;
}
