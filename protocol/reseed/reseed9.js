const { deployFacets, upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

/**
 * @notice reseed9 (final step) adds all facets to beanstalk, and unpauses beanstalk.
 */
async function reseed9(account) {
  // get list of facets to deploy:
  let facets = [
    "SeasonFacet", // SUN
    "SeasonGettersFacet",
    "GaugePointFacet",
    "LiquidityWeightFacet",
    "SiloFacet", // SILO
    "SiloGettersFacet",
    "WhitelistFacet",
    "ApprovalFacet",
    "BDVFacet",
    "ConvertFacet", // CONVERT
    "ConvertGettersFacet",
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
    "OwnershipFacet"
  ];

  // A list of public libraries that need to be deployed separately.
  let libraryNames = [
    "LibGauge",
    "LibIncentive",
    "LibConvert",
    "LibLockedUnderlying",
    "LibWellMinting",
    "LibGerminate"
  ];

  // A mapping of facet to public library names that will be linked to it.
  // MockFacets will be deployed with the same public libraries.
  let facetLibraries = {
    SeasonFacet: [
      "LibGauge",
      "LibIncentive",
      "LibLockedUnderlying",
      "LibWellMinting",
      "LibGerminate"
    ],
    ConvertFacet: ["LibConvert"],
    UnripeFacet: ["LibLockedUnderlying"],
    SeasonGettersFacet: ["LibLockedUnderlying", "LibWellMinting"]
  };

  // Deploy all facets and external libraries.
  let facetsAndNames = await deployFacets(
    verbose,
    mock,
    facets,
    libraryNames,
    facetLibraries,
    totalGasUsed
  );

  // upgrade beanstalk with all facets. calls `reseedRestart`
  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: facetsAndNames,
    initFacetName: "reseedRestart",
    bip: false,
    verbose: true,
    account: account
  });
}
exports.reseed9 = reseed9;
