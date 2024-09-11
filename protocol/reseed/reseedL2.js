const { parseAccountStatus } = require("./dataConverts/convertAccountStatuses.js");
const { parseInternalBalances } = require("./dataConverts/convertInternalBalances.js");
const { parseField } = require("./dataConverts/convertField.js");
const { parseDeposits } = require("./dataConverts/convertDeposits.js");
const { parseFertilizer } = require("./dataConverts/convertFert.js");
const { parsePodMarketplace } = require("./dataConverts/convertPodMarketplace.js");
const { parseGlobals } = require("./dataConverts/convertGlobal.js");
const { parseExternalHolders } = require("./dataConverts/convertExternalHolders.js");
const { reseedDeployL2Beanstalk } = require("./reseedDeployL2Beanstalk.js");
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
const { deployContract } = require("../scripts/contracts.js");

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
  deployBasin = false,
  addLiquidity = true
}) {
  if (convertData) parseBeanstalkData();
  // delete prev gas report
  if (fs.existsSync("./reseed/data/gas-report.csv")) fs.unlinkSync("./reseed/data/gas-report.csv");
  reseeds = [
    reseedDeployL2Beanstalk, // deploy l2 beanstalk diamond
    reseed2, // reseedbean + deploy wells and fertilizer proxy on l2
    reseedGlobal, // reseed global variables
    reseed3, // reseed pod marketplace
    reseed4, // reseed field
    reseed5, // reseed barn (fert)
    reseed6, // reseed silo
    reseed7, // reseed account status
    reseed8, // reseed internal balances
    reseed9, // reseed whitelist
    reseed10 // add selectors to l2
  ];
  let l2BeanstalkAddress;

  console.clear();
  await printBeanstalk();
  for (let i = start; i < reseeds.length; i++) {
    await printStage(i, end, mock, log);
    console.log("L2 Beanstalk:", l2BeanstalkAddress);

    if (i == 0) {
      // first step on the l2 is to deploy the L2 beanstalk diamond with predetermined address.
      l2BeanstalkAddress = await reseedDeployL2Beanstalk(beanstalkDeployer, log, mock);
      continue;
    }

    if (i == 1) {
      // deploy fertilizer (TODO: Remove when fert is deployed on L2)
      const fertilizerImplementation = await deployContract(
        "Fertilizer",
        beanstalkDeployer,
        true,
        []
      );
      console.log("Fertilizer Implementation:", fertilizerImplementation.address);
      // deploy BeanstalkPrice contract (TODO: Remove when this is deployed on L2)
      const beanstalkPrice = await deployContract("BeanstalkPrice", beanstalkDeployer, true, [
        l2BeanstalkAddress
      ]);
      console.log("BeanstalkPrice:", beanstalkPrice.address);
      // deploy bean addresses.
      await reseed2(
        beanstalkDeployer,
        l2BeanstalkAddress,
        deployBasin,
        fertilizerImplementation.address,
        mock
      );
      continue;
    }

    if (setState == true) {
      await reseeds[i](beanstalkDeployer, l2BeanstalkAddress, mock);
      continue;
    }

    if (i == reseeds.length - 2) {
      // prior to the last reseed (i.e, adding facets to L2 beanstalk),
      // the Beanstalk deployer needs to transfer ownership to the beanstalk owner.
      await upgradeWithNewFacets({
        diamondAddress: l2BeanstalkAddress,
        facetNames: ["OwnershipFacet"],
        initFacetName: "ReseedTransferOwnership",
        initArgs: [l2owner.address],
        bip: false,
        verbose: false,
        account: beanstalkDeployer,
        checkGas: true,
        initFacetNameInfo: "ReseedTransferOwnership"
      });
    }
    if (i == reseeds.length - 1) {
      // claim ownership of beanstalk:
      await (await getBeanstalk(l2BeanstalkAddress)).connect(l2owner).claimOwnership();
      // initialize beanstalk state add selectors to L2 beanstalk.
      await reseed10(l2owner, l2BeanstalkAddress, mock);
    }
  }
  // adds liquidity to wells and transfer well LP tokens to l2 beanstalk:
  if (addLiquidity) await reseedAddLiquidityAndTransfer(l2owner, l2BeanstalkAddress, true);
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
  // TODO: Replace with actual smart contract accounts.
  const contractAccounts = ["0x1", "0x2", "0x3", "0x4", "0x5"];
  const BLOCK_NUMBER = 20577510;
  const storageAccountsPath = `./reseed/data/exports/storage-accounts${BLOCK_NUMBER}.json`;
  const storageFertPath = `./reseed/data/exports/storage-fertilizer${BLOCK_NUMBER}.json`;
  const storageSystemPath = `./reseed/data/exports/storage-system${BLOCK_NUMBER}.json`;
  const marketPath = "./reseed/data/exports/market-info20330000.json";
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
  parseField(storageAccountsPath, "./reseed/data/r4-field.json", contractAccounts);
  parsePodMarketplace(
    marketPath,
    "./reseed/data/r3/pod-listings.json",
    "./reseed/data/r3/pod-orders.json"
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
