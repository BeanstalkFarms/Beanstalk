const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { BEANSTALK } = require("../test/hardhat/utils/constants.js");
const SELECTORS = require("./data/beanstalkSelectors.json");
const SILO_SELECTORS = require("./data/SiloFacetSelectors.json");
const { printBeanstalk } = require("./reseedL2.js");

/**
 * @notice reseed1 initializes migration by:
 * - removing all functionality from beanstalk except for diamond functionality, and internal balance support.
 * - pausing beanstalk.
 * - transferring bean LP tokens to BCM.
 */
async function reseedL1(account, mock) {
  await printBeanstalk();
  beanstalkSelectors = [];
  console.log("-----------------------------------");
  console.log("reseed1: Initialize L2 migration\n");
  console.log("Removing selectors and pausing Beanstalk...");

  // the following selectors come from the following facets.
  // diamondLoupeFacet,
  // diamondCutFacet
  // ownershipFacet
  // pauseFacet
  let listOfWhitelistedFunctionSelectors = [
    "0x1f931c1c", // diamondCut
    "0xcdffacc6", // facetAddress
    "0x52ef6b2c", // facetAddresses
    "0xadfca15e", // facetFunctionSelectors
    "0x7a0ed627", // facets
    "0x01ffc9a7", // supportsInterface
    "0x4e71e0c8", // claimOwnership
    "0x8da5cb5b", // owner
    "0x5f504a82", // ownerCandidate
    "0xf2fde38b", // transferOwnership
    "0xda3e3397", // TokenFacet functions.
    "0x0bc33ce4",
    "0xfdb28811",
    "0xb6fc38f9",
    "0xd4fac45d",
    "0x6a385ae9",
    "0x4667fa3d",
    "0xc3714723",
    "0x8a65d2e0",
    "0xa98edb17",
    "0xb39062e6",
    "0xbc197c81",
    "0xf23a6e61",
    "0x8e8758d8",
    "0xd3f4ec6f",
    "0x6204aa43",
    "0xbd32fac3",
    "0x1c059365"
  ];
  for (let i = 0; i < SELECTORS.length; i++) {
    selectors = SELECTORS[i][1];
    for (let j = 0; j < selectors.length; j++) {
      // if selector[j] is not in the whitelist, add it to the list of selectors to remove
      if (!listOfWhitelistedFunctionSelectors.includes(selectors[j])) {
        beanstalkSelectors.push(selectors[j]);
      }
    }
  }

  // remove only the siloFacet:
  console.log("Stage 1: Remove siloFacet");
  // await upgradeWithNewFacets({
  //   diamondAddress: BEANSTALK,
  //   selectorsToRemove: SILO_SELECTORS[1],
  //   bip: false,
  //   verbose: true,
  //   account: account,
  //   object: mock
  // });

  // add the BeanL2MigrationFacet, L1TokenFacet, remove all selectors other than the diamond functionality.
  console.log(
    "Stage 2: Add L2MigrationFacet, L1TokenFacet, remove all selectors other than the diamond functionality."
  );
  await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    facetNames: ["L2MigrationFacet", "L1TokenFacet"],
    selectorsToRemove: beanstalkSelectors,
    initFacetName: "ReseedL2Migration",
    bip: false,
    verbose: true,
    account: account,
    object: !mock
  });
  console.log("Beanstalk is now paused and bean LP tokens are transferred to BCM.");
  console.log("-----------------------------------");
}
exports.reseedL1 = reseedL1;
