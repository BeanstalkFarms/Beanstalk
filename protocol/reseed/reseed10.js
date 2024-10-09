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
    "L1ReceiverFacet" // MIGRATION
  ];

  // get list of facet addresses to link
  const facetAddresses = [
    "0x40c8688969c91290311314fbB2f10156b43Fbe4B", // SeasonFacet
    "0xfe15fe467d06Ce19d20709eAE9E24B3bD8309132", // SeasonGettersFacet
    "0x2e804f24134baCF12036757D1dcdcCbBBb3e2f31", // GaugeGettersFacet
    "0xbcF3bA03bf792F9f8B5dbd460eAa446529020778", // GaugePointFacet
    "0x19AC2dc9A0BFda04Dde8EA7437945872DB95B13E", // LiquidityWeightFacet
    "0x5678345D444918a38ad9dC7CA1b0C208E1927094", // SiloFacet
    "0x76eF6b03775A4cDE7666C96f3Ca21feb736afeBC", // ClaimFacet
    "0xb4F9d59f787642F64c73346A747Bf1984A52D4Ea", // SiloGettersFacet
    "0x7f855852a7191635c845c4183a6335ecb0B7aFAb", // WhitelistFacet
    "0x5579358403eD126dB6ed6A213B5129696161Bad6", // ApprovalFacet
    "0x4da6AAed2a2C3605f7c098037014003697Cb0426", // BDVFacet
    "0x48Fa359664820A12ad6Ae8769ccB4365053da580", // OracleFacet
    "0x242A339C73d3b373a91C157865B36a1480ec3b09", // ConvertFacet
    "0x999A04B54a386b1C68A9Be926AF0200F2C49A47A", // ConvertGettersFacet
    "0x6B1B5E5cef71f0cC65d32B67D8794F58faD491a3", // PipelineConvertFacet
    "0x5794fDb0cfE2AbFCB3D22103F5d8c6B4C2cCD1d9", // MetadataFacet
    "0xcA03AbaBA37566d89B707878495D9EB8Ea48C3c5", // MarketplaceFacet
    "0xa9085918d5632EA12BA91709F819B800fa8B3726", // FieldFacet
    "0x107F33211935bb72B721675c7e95a2d4cC0c96cc", // DepotFacet
    "0x24103B8141F97D9D8794fE2EE0eD96F577EeC05F", // FarmFacet
    "0xf8B5Fa117f492608b8f16AAE84C69175ead6A38d", // TokenFacet
    "0x17AC9d59f4637a16F47C8a77A1c4EE7c7a159A95", // TokenSupportFacet
    "0xcb84F1a368f303798DB6d9cE7B4084Aaf316479b", // TractorFacet
    "0x7B2BDA06CE2cD8287e169b241d68d1Bb6568e342", // FertilizerFacet
    "0x87F1FB2CF1CDC19103739F7cdb0068b203184354", // UnripeFacet
    "0x3AF703FACA14A0201E5aa98D91cA1Dbb10a8f110", // EnrootFacet
    "0x926CFCe66aa8A0CC29470dA28095D88CF24ABE16", // PauseFacet
    "0x7ae90B0c59D120A9F3193a5f2368837353e72459" // L1ReceiverFacet
  ];

  // link all facets to beanstalk diamond:
  await retryOperation(async () => {
    await upgradeWithDeployedFacets({
      diamondAddress: L2Beanstalk,
      facetNames: facetNames,
      facetAddresses: facetAddresses,
      verbose: true,
      account: account,
      object: !mock, // true to save diamond cut json, false to upgrade diamond
      checkGas: true
    });
  });

  console.log("\nFacets added to L2 Beanstalk.");
}
exports.reseed10 = reseed10;
