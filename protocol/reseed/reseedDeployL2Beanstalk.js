const { deploy, deployFacets } = require("../scripts/diamond.js");
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
    await mintEth(account);
    signer = await ethers.provider.getSigner(account);
  } else {
    signer = await impersonateSigner(account);
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
  const [beanstalkDiamond] = await deploy({
    diamondName: "L2BeanstalkDiamond",
    facets: facetsAndNames,
    owner: account,
    args: [],
    verbose: verbose
  });
  return beanstalkDiamond.address;
}
exports.reseedDeployL2Beanstalk = reseedDeployL2Beanstalk;
