const { upgradeWithDeployedFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { retryOperation } = require("../utils/read.js");

/**
 * @notice reseed9 (final step) adds all facets to beanstalk, and unpauses beanstalk.
 * note: All facets will be deployed prior to running the reseed.
 */
async function reseed10(account, L2Beanstalk, mock, verbose = true) {
  console.log("-----------------------------------");
  console.log("reseed10: add all facets to L2 Beanstalk.\n");

  // get list of facet names to link
  let facetNames = [
    "SeasonFacet", // SUN
    "SeasonGettersFacet",
    "GaugeGettersFacet",
    "GaugePointFacet",
    "LiquidityWeightFacet",
    "SiloFacet", // SILO
    "ClaimFacet",
    "SiloGettersFacet",
    "WhitelistFacet",
    "ApprovalFacet",
    "BDVFacet",
    "OracleFacet",
    "ConvertFacet", // CONVERT
    "ConvertGettersFacet",
    "PipelineConvertFacet",
    "MetadataFacet", // METADATA
    "MarketplaceFacet", // MARKET
    "FieldFacet", // FIELD
    "DepotFacet", // FARM
    "FarmFacet",
    "TokenFacet",
    "TokenSupportFacet",
    "TractorFacet",
    "FertilizerFacet", // BARN
    "UnripeFacet",
    "EnrootFacet",
    "PauseFacet", // DIAMOND
    "L1RecieverFacet" // MIGRATION
  ];

  // get list of facet addresses to link
  const facetAddresses = [
    "0x552322CD960FFB809d91012CE05d6FBB86BaE290",
    "0xdf522AC66735CB506D15236CF35938588f29e34B",
    "0x16b6B2Deb4b19DDb664167CF8cBE601DFA9a87e5",
    "0x043a11704A9e508a2b03c4Dc38Ae60dEE369EAEC",
    "0x837B2DB3ea3092E9452fCB118027aeBA1d9FfbD3",
    "0xA89Fbf550A453f0eD9D75DAac706fa41eE7F9A1d",
    "0xD14b7AB5fd36C770e3339A94F3763cAeC046DDCc",
    "0x51757F6c0A662B4fB57E96a903b199d9D0fCd312",
    "0x7eF1D0449dD48189AF968586b2F91c8294ADDC07",
    "0x0D6dF5E737EF25913F6f2fA1649D0F9530c83D59",
    "0xa7D49dC04ab8530509A03f9B8669ac6Bc026711f",
    "0x320AaEBB1a644BEd2B86038eDE49B81072D02be0",
    "0xd7a7Ec3B2EC70EdFFfB969f94436908fB53B3B85",
    "0x3D5Cd5A7C7312bF005de78B09e125b34165a69Ec",
    "0x35f6977D9236C0734520878799598eA0FE692965",
    "0x958679Ab3CC0961F4339FaeCcbf36a1d5906cbF5",
    "0x6464446d74C27961396A126b2d449aBdDea354cd",
    "0xE6f9cE8737fa856e2aEeD2925DB39Fcac25c6513",
    "0x47422eEEcd1cE855dcf59eE7EaEb23c6A4666699",
    "0xd4A0797D7700bbA801d2DeD34e5d44480D0061Fe",
    "0x4D26Caf0778D651922e89c546f09Ae852cc4933a",
    "0xcC0f8117B6c0c45C15D4d306Cdb14454263f33Ba",
    "0xD61E6F775dE1B0C3aC8A4b2516FEb7A935DC85Bb",
    "0x6f252Ecf79aF1bd57c48047a8B109001FFB4c1DB",
    "0x0b980ab39F9fDf3226b98Bc32d96EC180fd61687",
    "0xD9171D21C414AE676946a60cd226b3EDa5aC3a2A",
    "0x7ee24734b97902E6081D702514776416F11F971b",
    "0x53106dc7D78dF1EeD36947cf0536d7eCcCa7e0b1"
  ];

  // link all facets to beanstalk diamond:
  await retryOperation(async () => {
    await upgradeWithDeployedFacets({
      diamondAddress: L2Beanstalk,
      facetNames: facetNames,
      facetAddresses: facetAddresses,
      verbose: true,
      account: account,
      checkGas: true
    });
  });

  console.log("\nFacets added to L2 Beanstalk.");
}
exports.reseed10 = reseed10;
