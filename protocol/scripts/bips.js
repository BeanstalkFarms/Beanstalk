const { BEANSTALK } = require("../test/utils/constants");
const { getBeanstalk, impersonateBeanstalkOwner, mintEth, impersonateSigner } = require("../utils");
const { deployContract } = require("./contracts");
const { upgradeWithNewFacets } = require("./diamond");
const { impersonatePipeline, deployPipeline } = require("./pipeline");

async function bip30(mock = true, account = undefined) {
  if (account == undefined) {
    account = await impersonateBeanstalkOwner();
    await mintEth(account.address);
  }

  await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    facetNames: [
      "DepotFacet", // Add Depot
      "TokenSupportFacet", // Add ERC-20 permit function
      "FarmFacet", // Add AdvancedFarm
      "SeasonFacet"
    ],
    bip: false,
    object: !mock,
    verbose: true,
    account: account
  });
}

async function bip29(mock = true, account = undefined) {
  if (account == undefined) {
    account = await impersonateBeanstalkOwner();
    await mintEth(account.address);
  }

  beanstalk = await getBeanstalk();
  await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    facetNames: [
      "MarketplaceFacet", // Marketplace V2
      "SiloFacet", // Add Deposit Permit System
      "TokenFacet" // Add ERC-20 Token Approval System
    ],
    selectorsToRemove: [
      "0xeb6fa84f",
      "0xed778f8e",
      "0x72db799f",
      "0x56e70811",
      "0x6d679775",
      "0x1aac9789"
    ],
    bip: false,
    object: !mock,
    verbose: true,
    account: account
  });
}

async function bipMorningAuction(mock = true, account = undefined) {
  if (account == undefined) {
    account = await impersonateBeanstalkOwner();
    await mintEth(account.address);
  }

  await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    facetNames: [
      "FieldFacet", // Add Morning Auction
      "SeasonFacet", // Add ERC-20 permit function
      "FundraiserFacet" // update fundraiser with new soil spec
      // 'MockAdminFacet' // Add MockAdmin for testing purposes
    ],
    initFacetName: "InitBipSunriseImprovements",
    initArgs: [],
    bip: false,
    verbose: true,
    account: account
  });
}

//BIP for Silo migration to stem
async function bipNewSilo(mock = true, account = undefined) {
  if (account == undefined) {
    account = await impersonateBeanstalkOwner();
    await mintEth(account.address);
  }

  await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    facetNames: [
      "SeasonFacet",
      "SiloFacet",
      "ConvertFacet",
      "WhitelistFacet",
      "MetadataFacet",
      "TokenFacet",
      "ApprovalFacet",
      "LegacyClaimWithdrawalFacet"
    ],
    initFacetName: "InitBipNewSilo",
    bip: false,
    object: !mock, //if this is true, something would get spit out in the diamond cuts folder with all the data (due to gnosis safe deployment flow)
    verbose: true,
    account: account
  });
}

//BIP to integration Basin into Beanstalk
async function bipBasinIntegration(mock = true, account = undefined) {
  if (account == undefined) {
    account = await impersonateBeanstalkOwner();
    await mintEth(account.address);
  }

  await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    facetNames: [
      "DepotFacet",
      "BDVFacet",
      "ConvertFacet",
      "ConvertGettersFacet",
      "SiloFacet",
      "EnrootFacet",
      "WhitelistFacet",
      "SeasonFacet",
      "MetadataFacet"
    ],
    initFacetName: "InitBipBasinIntegration",
    bip: false,
    object: !mock, //if this is true, something would get spit out in the diamond cuts folder with all the data (due to gnosis safe deployment flow)
    verbose: true,
    selectorsToRemove: ["0x8f742d16"],
    account: account
  });
}

async function mockBeanstalkAdmin(mock = true, account = undefined) {
  if (account == undefined) {
    account = await impersonateBeanstalkOwner();
    await mintEth(account.address);
  }

  await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    facetNames: ["MockAdminFacet"],
    bip: false,
    object: !mock,
    verbose: true,
    account: account,
    verify: false
  });
}

async function bip34(mock = true, account = undefined) {
  if (account == undefined) {
    account = await impersonateBeanstalkOwner();
    await mintEth(account.address);
  }

  await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    facetNames: [
      "FieldFacet", // Add Morning Auction
      "SeasonFacet", // Add ERC-20 permit function
      "FundraiserFacet" // update fundraiser with new soil spec
    ],
    initFacetName: "InitBipSunriseImprovements",
    selectorsToRemove: ["0x78309c85", "0x6c8d548e"],
    bip: false,
    object: !mock,
    verbose: true,
    account: account,
    verify: false
  });
}

async function bipMigrateUnripeBean3CrvToBeanEth(
  mock = true,
  account = undefined,
  verbose = true,
  oracleAccount = undefined
) {
  if (account == undefined) {
    account = await impersonateBeanstalkOwner();
    await mintEth(account.address);
  }

  await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    facetNames: [
      "BDVFacet",
      "ConvertFacet",
      "ConvertGettersFacet",
      "FertilizerFacet",
      "MetadataFacet",
      "UnripeFacet"
    ],
    libraryNames: ["LibConvert", "LibLockedUnderlying"],
    facetLibraries: {
      ConvertFacet: ["LibConvert"],
      UnripeFacet: ["LibLockedUnderlying"]
    },
    initFacetName: "InitMigrateUnripeBean3CrvToBeanEth",
    selectorsToRemove: ["0x0bfca7e3", "0x8cd31ca0"],
    bip: false,
    object: !mock,
    verbose: verbose,
    account: account,
    verify: false
  });

  if (oracleAccount == undefined) {
    oracleAccount = await impersonateSigner("0x30a1976d5d087ef0BA0B4CDe87cc224B74a9c752", true); // Oracle deployer
    await mintEth(oracleAccount.address);
  }
  await deployContract("UsdOracle", oracleAccount, verbose);
}

async function bipInitTractor(mock = true, account = undefined, verbose = true) {
  if (account == undefined) {
    account = await impersonateBeanstalkOwner();
    await mintEth(account.address);
  }

  await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    initFacetName: "InitTractor",
    bip: false,
    object: !mock,
    verbose: verbose,
    account: account,
    verify: false
  });
}

async function bipSeedGauge(mock = true, account = undefined, verbose = true) {
  if (account == undefined) {
    account = await impersonateBeanstalkOwner();
    await mintEth(account.address);
  }

  await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    facetNames: [
      "SeasonFacet", // Add Seed Gauge system
      "SeasonGettersFacet", // season getters
      "GaugePointFacet", // gauge point function caller
      "UnripeFacet", // new view functions
      "SiloFacet", // new view functions
      "ConvertFacet", // add unripe convert
      "ConvertGettersFacet", // add unripe convert getters
      "WhitelistFacet", // update whitelist abilities.
      "MetadataFacet", // update metadata
      "BDVFacet", // update bdv functions
      "SiloGettersFacet", // add silo getters
      "LiquidityWeightFacet", // add liquidity weight facet
      "EnrootFacet", // update stem functions
      "MigrationFacet" // update migration functions
    ],
    initFacetName: "InitBipSeedGauge",
    selectorsToRemove: [
      "0xd8a6aafe", // remove old whitelist
      "0xb4f55be8", // remove old whitelistWithEncodeType
      "0x07a3b202", // remove Curve Oracle
      "0x9f9962e4", // remove getSeedsPerToken
      "0x0b2939d1" // remove InVestingPeriod
    ],
    libraryNames: [
      "LibGauge",
      "LibConvert",
      "LibLockedUnderlying",
      "LibIncentive",
      "LibGerminate",
      "LibSilo"
    ],
    facetLibraries: {
      SeasonFacet: ["LibGauge", "LibIncentive", "LibLockedUnderlying", "LibGerminate"],
      SeasonGettersFacet: ["LibLockedUnderlying"],
      ConvertFacet: ["LibConvert"],
      UnripeFacet: ["LibLockedUnderlying"],
      SiloFacet: ["LibSilo"]
    },
    bip: false,
    object: !mock,
    verbose: verbose,
    account: account,
    verify: false
  });
}

async function bipMigrateUnripeBeanEthToBeanSteth(
  mock = true,
  account = undefined,
  verbose = true,
  oracleAccount = undefined
) {
  if (account == undefined) {
    await mintEth(account.address);
    account = await impersonateBeanstalkOwner();
  }

  await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    facetNames: [
      "BDVFacet",
      "ConvertGettersFacet",
      "ConvertFacet",
      "EnrootFacet",
      "FertilizerFacet",
      "SeasonFacet",
      "MetadataFacet",
      "SeasonGettersFacet",
      "UnripeFacet",
      "WhitelistFacet" // update whitelist abilities.
    ],
    libraryNames: [
      "LibGauge",
      "LibIncentive",
      "LibConvert",
      "LibLockedUnderlying",
      "LibWellMinting",
      "LibGerminate"
    ],
    facetLibraries: {
      UnripeFacet: ["LibConvert"],
      ConvertFacet: ["LibLockedUnderlying"],
      SeasonFacet: ["LibGauge", "LibIncentive", "LibLockedUnderlying", "LibWellMinting"],
      SeasonGettersFacet: ["LibWellMinting", "LibLockedUnderlying", "LibGerminate"]
    },
    initFacetName: "InitMigrateUnripeBeanEthToBeanSteth",
    bip: false,
    selectorsToRemove: [],
    object: !mock,
    verbose: verbose,
    account: account,
    verify: false
  });

  if (oracleAccount == undefined) {
    oracleAccount = await impersonateSigner("0x30a1976d5d087ef0BA0B4CDe87cc224B74a9c752", true); // Oracle deployer
    await mintEth(oracleAccount.address);
  }
  await deployContract("UsdOracle", oracleAccount, verbose);
}

exports.bip29 = bip29;
exports.bip30 = bip30;
exports.bip34 = bip34;
exports.bipMorningAuction = bipMorningAuction;
exports.bipNewSilo = bipNewSilo;
exports.bipBasinIntegration = bipBasinIntegration;
exports.bipSeedGauge = bipSeedGauge;
exports.mockBeanstalkAdmin = mockBeanstalkAdmin;
exports.bipMigrateUnripeBean3CrvToBeanEth = bipMigrateUnripeBean3CrvToBeanEth;
exports.bipInitTractor = bipInitTractor;
exports.bipMigrateUnripeBeanEthToBeanSteth = bipMigrateUnripeBeanEthToBeanSteth;
