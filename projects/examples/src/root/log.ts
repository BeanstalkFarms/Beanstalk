import { DataSource, ERC20Token, Token } from "@beanstalk/sdk";
import { sdk } from "../setup";

export const logBalances = async (account: string, inputToken: Token, depositToken: ERC20Token, label: string) => {
  const [
    // ACCOUNT
    accountBalanceOfETH,
    accountBalanceOfINPUT,
    accountBalanceOfDEPOSIT,
    accountBalanceOfROOT,
    // PIPELINE
    pipelineBalanceOfETH,
    pipelineBalanceOfDEPOSIT,
    pipelineBalanceOfROOT,
    pipelineSiloBalance,
    // DEPOT
    depotBalanceOfETH
  ] = await Promise.all([
    // ACCOUNT
    sdk.tokens.ETH.getBalance(account),
    sdk.tokens.getBalance(inputToken),
    sdk.tokens.getBalance(depositToken),
    sdk.tokens.getBalance(sdk.tokens.ROOT),
    // PIPELINE
    sdk.tokens.ETH.getBalance(sdk.contracts.pipeline.address),
    sdk.tokens.getBalance(depositToken, sdk.contracts.pipeline.address),
    sdk.tokens.getBalance(sdk.tokens.ROOT, sdk.contracts.pipeline.address),
    sdk.silo.getBalance(sdk.tokens.BEAN, sdk.contracts.pipeline.address, { source: DataSource.LEDGER }),
    // DEPOT
    sdk.tokens.ETH.getBalance(sdk.contracts.depot.address)
  ]);

  console.log(`\n\nBALANCES: ${label}`);
  console.log(`======================================================`);
  console.log(`ACCOUNT`);
  console.log(`(0) ETH : ${accountBalanceOfETH.toHuman()}`);
  console.log(`(1) ${inputToken.symbol.padEnd(4, " ")}:`, accountBalanceOfINPUT.total.toHuman().padEnd(26, " "), "[inputToken]");
  console.log(`(2) ${depositToken.symbol}:`, accountBalanceOfDEPOSIT.total.toHuman().padEnd(26, " "), "[depositToken]");
  console.log(`(3) ROOT:`, accountBalanceOfROOT.total.toHuman());
  console.log(`\nPIPELINE`);
  console.log(`(4) ETH :`, pipelineBalanceOfETH.toHuman());
  console.log(`(5) ${depositToken.symbol}:`, pipelineBalanceOfDEPOSIT.total.toHuman().padEnd(26, " "), "[depositToken]");
  console.log(`(6) ROOT:`, pipelineBalanceOfROOT.total.toHuman());
  console.log(
    `(7) ${depositToken.symbol} Deposits*:`,
    pipelineSiloBalance.deposited.crates.length.toString().padEnd(16, " "),
    "[depositToken]"
  );
  console.log(`\nDEPOT`);
  console.log(`(8) ETH :`, depotBalanceOfETH.toHuman());
  console.log(` ^ 4-8 should be 0 if Pipeline & Depot were properly unloaded.`);
  console.log(`\n* number of crates deposited in the Silo`);
  console.log(`======================================================\n\n`);

  return accountBalanceOfINPUT;
};
