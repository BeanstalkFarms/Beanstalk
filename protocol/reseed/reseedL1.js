const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { BEANSTALK } = require("../test/hardhat/utils/constants.js");
const SELECTORS = require("./data/beanstalkSelectors.json");
const { printBeanstalk } = require("./reseedL2.js");

/**
 * @notice reseed1 initializes migration by:
 * - removing all functionality from beanstalk except for diamond functionality, and internal balance support.
 * - pausing beanstalk.
 * - transferring bean LP tokens to BCM.
 */
async function reseedL1(account) {
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
    "0xf2fde38b" // transferOwnership
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
  // add the BeanL2MigrationFacet, L1TokenFacet, remove all selectors other than the diamond functionality.
  await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    facetNames: ["BeanL2MigrationFacet", "L1TokenFacet"],
    facetsToRemove: beanstalkSelectors,
    initFacetName: "ReseedL2Migration",
    bip: false,
    verbose: true,
    account: account
  });
  console.log("Beanstalk is now paused and bean LP tokens are transferred to BCM.");
  console.log("-----------------------------------");
}
exports.reseedL1 = reseedL1;
