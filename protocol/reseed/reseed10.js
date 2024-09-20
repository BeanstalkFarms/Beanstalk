const { upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { retryOperation } = require("../utils/read.js");

/**
 * @notice reseed9 (final step) adds all facets to beanstalk, and unpauses beanstalk.
 */
async function reseed10(account, L2Beanstalk, mock, verbose = true) {
  // get list of facets to deploy:
  let facets = [
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

  // A list of public libraries that need to be deployed separately.
  libraryNames = [
    "LibGauge",
    "LibIncentive",
    "LibConvert",
    "LibLockedUnderlying",
    "LibWellMinting",
    "LibGerminate",
    "LibPipelineConvert",
    "LibSilo",
    "LibShipping",
    "LibFlood",
    "LibTokenSilo",
    "LibEvaluate",
    "LibSiloPermit"
  ];

  // A mapping of facet to public library names that will be linked to it.
  // MockFacets will be deployed with the same public libraries.
  facetLibraries = {
    SeasonFacet: [
      "LibGauge",
      "LibIncentive",
      "LibWellMinting",
      "LibGerminate",
      "LibShipping",
      "LibFlood",
      "LibEvaluate"
    ],
    ConvertFacet: ["LibConvert", "LibPipelineConvert", "LibSilo", "LibTokenSilo"],
    PipelineConvertFacet: ["LibPipelineConvert", "LibSilo", "LibTokenSilo"],
    UnripeFacet: ["LibLockedUnderlying"],
    SeasonGettersFacet: ["LibLockedUnderlying", "LibWellMinting"],
    SiloFacet: ["LibSilo", "LibTokenSilo", "LibSiloPermit"],
    EnrootFacet: ["LibSilo", "LibTokenSilo"],
    ClaimFacet: ["LibSilo", "LibTokenSilo"],
    GaugeGettersFacet: ["LibLockedUnderlying"],
    L1RecieverFacet: ["LibSilo", "LibTokenSilo"]
  };

  // A mapping of external libraries to external libraries that need to be linked.
  // note: if a library depends on another library, the dependency will need to come
  // before itself in `libraryNames`
  libraryLinks = {
    LibEvaluate: ["LibLockedUnderlying"]
  };

  // upgrade beanstalk with all facets. calls `InitReseed`
  await retryOperation(async () => {
    await upgradeWithNewFacets({
      diamondAddress: L2Beanstalk,
      facetNames: facets,
      facetLibraries: facetLibraries,
      libraryNames: libraryNames,
      linkedLibraries: libraryLinks,
      initFacetName: "InitReseed",
      initArgs: [],
      bip: false,
      verbose: verbose,
      account: account
    });
  });
}
exports.reseed10 = reseed10;
