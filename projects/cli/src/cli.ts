#!/usr/bin/env node
import commandLineArgs, { OptionDefinition } from "command-line-args";
import { BeanstalkSDK, TestUtils, DataSource } from "@beanstalk/sdk";
import { ethers } from "ethers";
import { balance } from "./commands/balance.js";
import { setbalance } from "./commands/setbalance.js";
import { help } from "./commands/help.js";

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  const commands: OptionDefinition[] = [
    { name: "command", defaultOption: true },
    { name: "help", alias: "h" },
    { name: "account", alias: "a", defaultValue: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266" },
    { name: "token", alias: "t" },
    { name: "amount", alias: "m", defaultValue: "50000" },
    { name: "rpcUrl", alias: "r", defaultValue: "http://127.0.0.1:8545" },
    { name: "no-imp", type: Boolean }
  ];
  const args = commandLineArgs(commands, { partial: true });

  const { sdk, chain, stop } = await setupSDK(args);

  switch (args.command) {
    case "balance":
      await balance(sdk, { account: args.account, symbol: args.token });
      break;
    case "setbalance":
      await setbalance(sdk, chain, { account: args.account, symbol: args.token, amount: args.amount });
      break;
    case "help":
    default:
      await help();
  }

  await stop();
}

async function setupSDK(args: commandLineArgs.CommandLineOptions) {
  const rpcUrl = args.rpcUrl;
  const account = args.account;
  const shouldImpersonate = !args["no-imp"];

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const signer = await provider.getSigner(account);
  const sdk = new BeanstalkSDK({
    signer,
    source: DataSource.LEDGER,
    DEBUG: true
  });
  const chain = new TestUtils.BlockchainUtils(sdk);
  const stop = shouldImpersonate ? await chain.impersonate(account) : () => undefined;

  return { sdk, chain, stop };
}
