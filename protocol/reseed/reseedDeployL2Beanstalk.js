const { deploy, deployFacets, upgradeWithNewFacets } = require("../scripts/diamond.js");
const fs = require("fs");
const { impersonateSigner, mintEth } = require("../utils");

/**
 * @notice deploys a new beanstalk. Should be on an L2.
 * @dev account: the account to deploy the beanstalk with.
 * Todo: facets should be added post-migration to prevent users from interacting.
 */
async function reseedDeployL2Beanstalk(account, verbose = false, mock) {
  // impersonate `account`:
  let signer;
  if (mock) {
    await mintEth(account.address);
    signer = await ethers.provider.getSigner(account.address);
  } else {
    signer = await impersonateSigner(account.address);
  }

  let tx;
  let totalGasUsed = ethers.BigNumber.from("0");
  let receipt;

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
    "LibPipelineConvert",
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
    EnrootFacet: ["LibSilo"],
  };

  const [beanstalkDiamond] = await deploy({
      diamondName: "L2BeanstalkDiamond",
      facets: facets,
      facetLibraries: facetLibraries,
      libraryNames: libraryNames,
      owner: account,
      args: [1],
      verbose: true
    });
  
  return beanstalkDiamond.address;
}
exports.reseedDeployL2Beanstalk = reseedDeployL2Beanstalk;
