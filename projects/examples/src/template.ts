import chalk from "chalk";
import { account as _account, impersonate } from "./setup";

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const account = process.argv[3] || _account;
  console.log(`${chalk.bold.whiteBright("Account:")} ${chalk.greenBright(account)}`);
  const { sdk, stop } = await impersonate(account);

  const season = await sdk.sun.getSeason()
  const price =  await sdk.bean.getPrice()
  console.log(season, price.toHuman());


  await stop();
}
