const { impersonateBeanstalkOwner, mintEth } = require("../utils");
const { upgradeWithNewFacets } = require("./diamond");
const { BEANSTALK, USD_ORACLE, PRICE } = require("../test/utils/constants.js");
const { deployContract } = require("./contracts");

/**
 * When running a local anvil fork and force forwarding seasons,
 * the USD oracle & price contract fail to return values due to the
 * timestamp diffs being greater than the max timeout from the Chainlink Oracle.
 *
 * This script re-deploys the Season & SeasonGetters Facets w/o the checking the
 * staleness of the data from the chainlink oracle
 *
 * Before running this script, comment out the timestamp checks in LibChainlinkOracle.checkForInvalidTimestampOrAnswer
 *
 * if (timestamp == 0 || timestamp > currentTimestamp) return true;
 * if (currentTimestamp.sub(timestamp) > maxTimeout) return true;
 * if (answer <= 0) return true;
 *
 */

async function updateBeanstalkForUI(verbose = true) {
  const owner = await impersonateBeanstalkOwner();
  await mintEth(owner.address);
  await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    facetNames: ["SeasonFacet", "SeasonGettersFacet"],
    libraryNames: [
      "LibGauge",
      "LibIncentive",
      "LibLockedUnderlying",
      "LibWellMinting",
      "LibGerminate",
      "LibChainlinkOracle",
      "LibShipping",
      "LibFlood"
    ],
    facetLibraries: {
      SeasonFacet: [
        "LibGauge",
        "LibIncentive",
        "LibLockedUnderlying",
        "LibWellMinting",
        "LibGerminate",
        "LibShipping",
        "LibFlood"
      ],
      SeasonGettersFacet: ["LibLockedUnderlying", "LibWellMinting"]
    },
    initArgs: [],
    bip: false,
    verbose: verbose,
    account: owner
  });

  // impersonate price contract.
  let price = await deployContract("BeanstalkPrice", owner, false, [BEANSTALK]);
  const bytecode = await ethers.provider.getCode(price.address);
  await network.provider.send("hardhat_setCode", [PRICE, bytecode]);
  console.log("price contract deployed at", PRICE)

  // impersonate usd oracle contract.
  const usdOracle = await deployContract("UsdOracle", owner, false);
  const bytecode2 = await ethers.provider.getCode(usdOracle.address);
  await network.provider.send("hardhat_setCode", [USD_ORACLE, bytecode2]);
  console.log("usdOracle contract deployed at", USD_ORACLE)
}

exports.updateBeanstalkForUI = updateBeanstalkForUI;
