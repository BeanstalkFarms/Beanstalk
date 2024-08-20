const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");

/**
 * @notice reseed9 (final step) adds all facets to beanstalk, and unpauses beanstalk.
 */
async function reseed9(account, L2Beanstalk, verbose = false) {
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
    "LibGerminate",
    "LibShipping",
    "LibFlood",
    "LibSilo",
    "LibPipelineConvert"
  ];

  // A mapping of facet to public library names that will be linked to it.
  // MockFacets will be deployed with the same public libraries.
  let facetLibraries = {
    SeasonFacet: [
      "LibGauge",
      "LibIncentive",
      "LibLockedUnderlying",
      "LibWellMinting",
      "LibGerminate",
      "LibShipping",
      "LibFlood"
    ],
    ConvertFacet: ["LibConvert", "LibPipelineConvert", "LibSilo"],
    UnripeFacet: ["LibLockedUnderlying"],
    SeasonGettersFacet: ["LibLockedUnderlying", "LibWellMinting"],
    SiloFacet: ["LibSilo"],
    EnrootFacet: ["LibSilo"]
  };

  // Season to reseed
  const season = 12345;

  // upgrade beanstalk with all facets. calls `reseedRestart`
  await upgradeWithNewFacets({
    diamondAddress: L2Beanstalk,
    facetNames: facets,
    facetLibraries: facetLibraries,
    libraryNames: libraryNames,
    initFacetName: "InitReseed",
    initArgs: [season],
    bip: false,
    verbose: verbose,
    account: account
  });
}
exports.reseed9 = reseed9;
