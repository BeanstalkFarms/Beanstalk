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
  mock = false,
  convertData = true,
  log = false,
  start = 0,
  end = 10,
  setState = true,
  addLiquidity = false,
  verbose = false
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
    reseed9 // reseed whitelist
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
  const BLOCK_NUMBER = 20921737;
  // Read contract addresses to exclude them from the reseed
  const contractAccountsJson = JSON.parse(
    fs.readFileSync(`./reseed/data/exports/contract-accounts${BLOCK_NUMBER}.json`, "utf8")
  );
  // Convert all the items in the array to lowercase for comparison
  const contractAccounts = contractAccountsJson.map((address) => address.toLowerCase());
  const storageAccountsPath = `./reseed/data/exports/storage-accounts${BLOCK_NUMBER}.json`;
  const storageFertPath = `./reseed/data/exports/storage-fertilizer${BLOCK_NUMBER}.json`;
  const storageSystemPath = `./reseed/data/exports/storage-system${BLOCK_NUMBER}.json`;
  const marketPath = `./reseed/data/exports/market-info${BLOCK_NUMBER}.json`;
  const externalUnripeHoldersPath = `./reseed/data/exports/externalHolders/urbean-holders${BLOCK_NUMBER}.csv`;
  const externalUnripeLpHoldersPath = `./reseed/data/exports/externalHolders/urlp-holders${BLOCK_NUMBER}.csv`;
  const [smartContractStalk, smartContractRoots] = parseAccountStatus(
    storageAccountsPath,
    "./reseed/data/r7-account-status.json",
    contractAccounts
  );
  parseGlobals(
    storageSystemPath,
    "./reseed/data/global.json",
    smartContractStalk,
    smartContractRoots
  );
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
  const reserveSupplyJsonPath = `./reseed/data/exports/migrated-tokens${BLOCK_NUMBER}.json`;
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
