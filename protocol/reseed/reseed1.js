const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { BEANSTALK } = require("../test/utils/constants.js");
const SELECTORS = require("./data/beanstalkSelectors.json");

/**
 * @notice reseed1 initializes migration by:
 * - removing all functionality from beanstalk except for diamond functionality, and internal balance support.
 * - pausing beanstalk.
 * - transferring bean LP tokens to BCM.
 */
async function reseed1(account) {
  beanstalkSelectors = [];
  console.log("-----------------------------------");
  console.log("Reseed1: Initialize L2 migration\n");

  // the following selectors come from the following facets.
  // diamondLoupeFacet,
  // diamondCutFacet
  // ownershipFacet
  // pauseFacet
  // farmFacet
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
    "0xda3e3397", // approveToken
    "0x0bc33ce4", // decreaseTokenAllowance
    "0xfdb28811", // getAllBalance
    "0xb6fc38f9", // getAllBalances
    "0xd4fac45d", // getBalance
    "0x6a385ae9", // getBalances
    "0x4667fa3d", // getExternalBalance
    "0xc3714723", // getExternalBalances
    "0x8a65d2e0", // getInternalBalance
    "0xa98edb17", // getInternalBalances
    "0xb39062e6", // increaseTokenAllowance
    "0xbc197c81", // onERC1155BatchReceived
    "0xf23a6e61", // onERC1155Received
    "0x7c516e94", // permitToken
    "0x8e8758d8", // tokenAllowance
    "0x1f351f6a", // tokenPermitDomainSeparator
    "0x4edcab2d", // tokenPermitNonces
    "0xd3f4ec6f", // transferInternalTokenFrom
    "0x6204aa43", // transferToken
    "0xbd32fac3", // unwrapEth
    "0x1c059365" // wrapEth
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
  // add the BeanL2MigrationFacet, remove all selectors other than
  await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    facetNames: ["BeanL2MigrationFacet"],
    facetsToRemove: beanstalkSelectors,
    initFacetName: "InitL2Migration",
    bip: false,
    verbose: true,
    account: account
  });
  console.log("-----------------------------------");
}
exports.reseed1 = reseed1;
