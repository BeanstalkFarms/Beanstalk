const { parseAccountStatus } = require("./dataConverts/convertAccountStatuses.js");
const { parseInternalBalances } = require("./dataConverts/convertInternalBalances.js");
const { parseField } = require("./dataConverts/convertField.js");
const { parseWhitelist } = require("./dataConverts/convertWhitelist.js");
const { parseDeposits } = require("./dataConverts/convertDeposits.js");
const { parseFertilizer } = require("./dataConverts/convertFert.js");
const { parsePodMarketplace } = require("./dataConverts/convertPodMarketplace.js");
const { parseGlobals } = require("./dataConverts/convertGlobal.js");
const { parseExternalHolders } = require("./dataConverts/convertExternalHolders.js");
const { parseTokens } = require("./dataConverts/convertTokens.js");
const { reseed2 } = require("./reseed2.js");
const { reseed3 } = require("./reseed3.js");
const { reseed4 } = require("./reseed4.js");
const { reseed5 } = require("./reseed5.js");
const { reseed6 } = require("./reseed6.js");
const { reseed7 } = require("./reseed7.js");
const { reseed8 } = require("./reseed8.js");
const { reseed9 } = require("./reseed9.js");
const { reseed10 } = require("./reseed10.js");
const { reseedGlobal } = require("./reseedGlobal.js");
const { reseedAddLiquidityAndTransfer } = require("./reseedAddLiquidityAndTransfer.js");
const fs = require("fs");
const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const { getBeanstalk } = require("../utils/contracts.js");
const { L2_BEANSTALK } = require("../test/hardhat/utils/constants.js");

let reseeds;
async function reseedL2({
  beanstalkDeployer,
  l2owner,
  mock = false,
  convertData = true,
  log = false,
  start = 0,
  end = 11,
  setState = true,
  addLiquidity = true,
  verbose = false,
  onlyState = true
}) {
  if (convertData) parseBeanstalkData();
  // delete prev gas report
  if (fs.existsSync("./reseed/data/gas-report.csv")) fs.unlinkSync("./reseed/data/gas-report.csv");
  reseeds = [
    reseed2, // reseedbean + deploy wells and fertilizer proxy on l2
    reseedGlobal, // reseed global variables
    reseed3, // reseed field
    reseed4, // reseed pod marketplace
    reseed5, // reseed barn (fert)
    reseed6, // reseed silo
    reseed7, // reseed account status
    reseed8, // reseed internal balances
    reseed9, // reseed whitelist
    reseed10 // add selectors to l2
  ];
  console.clear();
  await printBeanstalk();
  for (let i = start; i < reseeds.length; i++) {
    await printStage(i, end, mock, log);
    console.log("L2 Beanstalk:", L2_BEANSTALK);

    if (setState == true) {
      await reseeds[i](beanstalkDeployer, L2_BEANSTALK, mock, verbose);
      continue;
    }

    // Prior to the last reseed (i.e, adding facets to L2 beanstalk),
    // the beanstalk owner needs to accept ownership of beanstalk.
    // The ownership facet will already be added to the diamond
    // and the deployer will have already proposed the l2 owner as the new owner.
    if (i == reseeds.length - 1) {
      // claim ownership of beanstalk:
      console.log("Claiming ownership of beanstalk.");
      await (await getBeanstalk(L2_BEANSTALK)).connect(l2owner).claimOwnership();
      // add selectors to l2 beanstalk from the already deployed facets
      await reseed10(l2owner, L2_BEANSTALK, mock);
    }
  }
  // adds liquidity to wells and transfer well LP tokens to l2 beanstalk:
  if (addLiquidity) await reseedAddLiquidityAndTransfer(l2owner, L2_BEANSTALK, true);
  console.log("Reseed successful.");
}

function getProcessString(processed, total) {
  const max = 20;
  const eq = (max * processed) / total;
  const sp = max - eq;
  return `[${"=".repeat(eq)}${" ".repeat(sp)}]`;
}

async function printStage(i, end, mock, log) {
  if (!log) {
    console.clear();
    printBeanstalk();
  } else {
    console.log("==============================================");
  }
  console.log(`Mocks Enabled: ${mock}`);
  console.log(`Stage ${i}/${end - 1}: ${getProcessString(i, end - 1)}`);
}

function parseBeanstalkData() {
  // Read contract addresses to exclude them from the reseed
  const contractAccounts = fs
    .readFileSync("./scripts/beanstalk-3/data/inputs/ContractAddresses.txt", "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const BLOCK_NUMBER = 20736200;
  const storageAccountsPath = `./reseed/data/exports/storage-accounts${BLOCK_NUMBER}.json`;
  const storageFertPath = `./reseed/data/exports/storage-fertilizer${BLOCK_NUMBER}.json`;
  const storageSystemPath = `./reseed/data/exports/storage-system${BLOCK_NUMBER}.json`;
  const marketPath = "./reseed/data/exports/market-info20330000.json"; // todo: update to latest block upon migration
  const externalUnripeHoldersPath = "./reseed/data/exports/externalHolders/unripeBeanHolders.csv";
  const externalUnripeLpHoldersPath = "./reseed/data/exports/externalHolders/unripeLpHolders.csv";
  parseGlobals(storageSystemPath, "./reseed/data/global.json");
  parseAccountStatus(storageAccountsPath, "./reseed/data/r7-account-status.json", contractAccounts);
  parseInternalBalances(
    storageAccountsPath,
    "./reseed/data/r8-internal-balances.json",
    contractAccounts
  );
  parseDeposits(storageAccountsPath, "./reseed/data/r6-deposits.json", contractAccounts);
  parseFertilizer(storageFertPath, "./reseed/data/r5-barn-raise.json", contractAccounts);
  parseField(storageAccountsPath, "./reseed/data/r3-field.json", contractAccounts);
  parsePodMarketplace(
    marketPath,
    "./reseed/data/r4/pod-listings.json",
    "./reseed/data/r4/pod-orders.json"
  );
  parseExternalHolders(
    externalUnripeHoldersPath,
    "./reseed/data/r2/L2_external_unripe_balances.json",
    contractAccounts
  );
  parseExternalHolders(
    externalUnripeLpHoldersPath,
    "./reseed/data/r2/L2_external_unripe_lp_balances.json",
    contractAccounts
  );
  // Initial supplies and well balances
  const reserveSupplyJsonPath = `./reseed/data/exports/contract-circulating${BLOCK_NUMBER}.json`;
  const outputFilePaths = {
    L2_initial_supply: "./reseed/data/r2/L2_initial_supply.json",
    L2_well_balances: "./reseed/data/r2/L2_well_balances.json"
  };
  parseTokens(reserveSupplyJsonPath, outputFilePaths);
  parseWhitelist(storageSystemPath, "./reseed/data/r9-whitelist.json");
}

async function printBeanstalk() {
  console.log("\n");
  console.log("");
  const text = fs.readFileSync("./reseed/data/reseed.txt");
  console.log(text.toString());
  console.log("");
}

exports.reseedL2 = reseedL2;
exports.printBeanstalk = printBeanstalk;
