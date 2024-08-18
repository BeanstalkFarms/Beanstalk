const { parseAccountStatus } = require("./dataConverts/convertAccountStatuses.js");
const { parseInternalBalances } = require("./dataConverts/convertInternalBalances.js");
const { parseField } = require("./dataConverts/convertField.js");
const { parseDeposits } = require("./dataConverts/convertDeposits.js");
const { parseFertilizer } = require("./dataConverts/convertFert.js");
const { parsePodMarketplace } = require("./dataConverts/convertPodMarketplace.js");
const { parseGlobals } = require("./dataConverts/convertGlobal.js");
const { reseed1 } = require("./reseed1.js");
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

let reseeds;
async function reseed({
  owner,
  beanstalkDeployer,
  l2owner,
  mock = false,
  convertData = true,
  log = false,
  start = 0,
  end = 12,
  deployL1 = true,
  setState = true
}) {
  if (convertData) parseBeanstalkData();
  // delete prev gas report
  if (fs.existsSync("./reseed/data/gas-report.csv")) fs.unlinkSync("./reseed/data/gas-report.csv");
  reseeds = [
    reseed1, // pause l1 beanstalk
    reseedDeployL2Beanstalk, // deploy l2 beanstalk diamond
    reseed3, // reseedbean + deploy fert +  deploy wells on l2
    reseedGlobal, // reseed global variables
    reseed2, // reseed pod marketplace
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
      if (deployL1 == true) {
        // migrate beanstalk L1 assets.
        await reseed1(owner);
        return;
      }
      continue;
    }

    if (i == 1) {
      // deploy L2 beanstalk with predetermined address.
      l2BeanstalkAddress = await reseedDeployL2Beanstalk(beanstalkDeployer, log, mock);
      continue;
    }

    if (i == 2) {
      // deploy beans addresses.
      await reseed3(beanstalkDeployer, l2BeanstalkAddress, mock);
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
      // adds liquidity to wells and transfer well LP tokens to l2 beanstalk:
      await reseedAddLiquidityAndTransfer(l2owner, l2BeanstalkAddress, true);

  //     // claim ownership of beanstalk:
  //     await (await getBeanstalk(l2BeanstalkAddress)).connect(l2owner).claimOwnership();

  //     // initialize beanstalk state add selectors to L2 beanstalk.
  //     await reseed10(l2owner, l2BeanstalkAddress, mock);
  //   }
  // }
  // console.log("Reseed successful.");
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
  const contractAccounts = ["0x1", "0x2", "0x3", "0x4", "0x5"];
  const storageAccountsPath = "./reseed/data/exports/storage-accounts20330000.json";
  const storageFertPath = "./reseed/data/exports/storage-fertilizer20330000.json";
  const storageSystemPath = "./reseed/data/exports/storage-system20330000.json";
  const marketPath = "./reseed/data/exports/market-info20330000.json";
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
    "./reseed/data/r2/pod-listings.json",
    "./reseed/data/r2/pod-orders.json"
  );
}

async function printBeanstalk() {
  console.log("\n");
  console.log("");
  const text = fs.readFileSync("./reseed/data/reseed.txt");
  console.log(text.toString());
  console.log("");
}

exports.reseed = reseed;
