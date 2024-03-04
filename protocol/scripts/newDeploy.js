const {
  USDC,
  USDT,
  DAI,
  ETH_USD_CHAINLINK_AGGREGATOR,
  STETH_ETH_CHAINLINK_PRICE_AGGREGATOR,
  WETH,
  WSTETH,
  WSTETH_ETH_UNIV3_01_POOL
} = require("../test/utils/constants.js");
const diamond = require("./diamond.js");
const {
  impersonateBean,
  impersonateCurve,
  impersonateBean3CrvMetapool,
  impersonateWeth,
  impersonateUnripe,
  impersonatePrice,
  impersonateBlockBasefee,
  impersonateEthUsdcUniswap,
  impersonateEthUsdtUniswap,
  impersonateChainlinkAggregator,
  impersonateUniswapV3,
  impersonateWsteth,
  impersonatePipeline,
  impersonateToken
} = require("./impersonate.js");

const { deployBasin } = require("./basin.js");

/**
 * @notice deploys a new instance of beanstalk. 
 * @dev SHOULD NOT be used to deploy new beanstalks on mainnet,
 * as the "Bean" token is always impersonated to the mainnet bean address.
 * For new deployments, ensure that the "Bean" token assigns the minter role 
 * to the new beanstalk diamond.
 */
async function main(
  verbose = false, // if true, print all logs
  mock = true, // if true, deploy "Mock" versions of the facets
  reset = true, // if true, reset hardhat network
  impersonateERC20 = true, // if true, call `impersonateERC20s`
  unripe = true, // if true, deploy and impersonate unripe
  oracle = true, // if true, deploy and impersonate oracles
  curve = true, // if true, deploy and impersonate curve
  basin = true, // if true, deploy and impersonate basin
  mockPump = true // if true, deploy a mockPump rather than multiFlow pump.
) {
  if (verbose) {
    console.log("MOCKS ENABLED: ", mock);
  }

  // Disable forking / reset hardhat network.
  // https://hardhat.org/hardhat-network/docs/reference
  if (mock && reset) {
    await network.provider.request({
      method: "hardhat_reset",
      params: []
    });
  }
  
  const accounts = await ethers.getSigners();
  const account = await accounts[0].getAddress();
  
  if (verbose) {
    console.log("Account: " + account);
    console.log("---");
  }
  let tx;
  let totalGasUsed = ethers.BigNumber.from("0");
  let receipt;
  const name = "Beanstalk";

  // Deploy all facets and external libraries.
  [facets, libraryNames, facetLibraries] = await getFacetData(mock)
  let facetsAndNames = await deployFacets(
    verbose,
    mock,
    facets,
    libraryNames,
    facetLibraries,
    totalGasUsed
  )
  
  // Fetch init diamond contract
  const initDiamondArg = mock
    ? "contracts/mocks/MockInitDiamond.sol:MockInitDiamond"
    : "contracts/beanstalk/init/InitDiamond.sol:InitDiamond";
  // eslint-disable-next-line no-unused-vars
  

  // Impersonate various contracts that beanstalk interacts with.
  // These should be impersonated on a fresh network state.
  if (reset) {
    await impersonateBlockBasefee(); // Block fee contract (sunrise)
    await impersonatePrice(); // BeanstalkPrice contract (frontend price)
    await impersonatePipeline(); // Pipeline contract (Depot)
    await deployBasin(true, undefined, verbose, true, mockPump); // Basin deployment.
    await impersonateUnripe(); // Unripe
  }

  // Impersonate various ERC20s, if enabled.
  // Bean and WETH are included by default.
  // Non-default ERC20s should have their own impersonation function.
  if (impersonateERC20) await impersonateERC20s(mock);

  // Impersonate oracles. Used within beanstalk to calculate BDV/DeltaB.
  if (oracle) await impersonateOracles();

  // Impersonate Curve.
  if (curve) {
    await impersonateCurve(); 
    await impersonateBean3CrvMetapool(); // Bean3crv metapool deployment.
  }

  // deploy unripe tokens.
  if (unripe) await impersonateUnripe();

  const [beanstalkDiamond, diamondCut] = await diamond.deploy({
    diamondName: "BeanstalkDiamond",
    initDiamond: initDiamondArg,
    facets: facetsAndNames,
    owner: account,
    args: [],
    verbose: verbose,
    impersonate: mock && reset
  });

  tx = beanstalkDiamond.deployTransaction;
  if (tx) {
    receipt = await tx.wait();
    if (verbose) console.log("Beanstalk diamond deploy gas used: " + strDisplay(receipt.gasUsed));
    if (verbose) console.log("Beanstalk diamond cut gas used: " + strDisplay(diamondCut.gasUsed));
    totalGasUsed = totalGasUsed.add(receipt.gasUsed).add(diamondCut.gasUsed);
  }

  if (verbose) {
    console.log("--");
    console.log("Beanstalk diamond address:" + beanstalkDiamond.address);
    console.log("--");
    console.log("Total gas used: " + strDisplay(totalGasUsed))
  }

  return {
    account: account,
    beanstalkDiamond: beanstalkDiamond,
  };
}

// Deploy all facets and libraries.
// if mock is enabled, deploy "Mock" versions of the facets.
async function deployFacets(
  verbose, 
  mock,
  facets, 
  libraryNames = [], 
  facetLibraries = {}, 
  totalGasUsed
) {
  const instancesAndNames = [];
  const libraries = {};

  for (const name of libraryNames) {
    if (verbose) console.log(`Deploying: ${name}`);
    let libraryFactory = await ethers.getContractFactory(name);
    libraryFactory = await libraryFactory.deploy();
    await libraryFactory.deployed();
    const receipt = await libraryFactory.deployTransaction.wait();
    if (verbose) console.log(`${name} deploy gas used: ` + strDisplay(receipt.gasUsed));
    if (verbose) console.log(`Deployed at ${libraryFactory.address}`);
    libraries[name] = libraryFactory.address;
  }

  for (let facet of facets) {
    let constructorArgs = [];
    if (Array.isArray(facet)) {
      [facet, constructorArgs] = facet;
    }
    let factory;
    // if mocks are enabled, and if the facet has an extenral library,
    // append "Mock" to the facet name when deploying, and run a try/catch.
    if (mock && facetLibraries[facet] !== undefined) {
      let facetLibrary = Object.keys(libraries).reduce((acc, val) => {
        if (facetLibraries[facet].includes(val)) acc[val] = libraries[val];
        return acc;
      }, {});
      try { 
        mockFacet = "Mock" + facet;
        factory = await ethers.getContractFactory(mockFacet, {
          libraries: facetLibrary
        });
        facet = mockFacet;
      } catch(e) {
        factory = await ethers.getContractFactory(facet, {
          libraries: facetLibrary
        });
      }
    } else if (facetLibraries[facet] !== undefined) {
      let facetLibrary = Object.keys(libraries).reduce((acc, val) => {
        if (facetLibraries[facet].includes(val)) acc[val] = libraries[val];
        return acc;
      }, {});
      factory = await ethers.getContractFactory(facet, {
        libraries: facetLibrary
      });
    } else {
      // if mock is enabled, append "Mock" to the facet name, and run a try/catch.
      if (mock) {
        try {
          mockFacet = "Mock" + facet;
          factory = await ethers.getContractFactory(mockFacet);
          facet = mockFacet;
        } catch (e) {
          factory = await ethers.getContractFactory(facet);
        }
      } else {
        factory = await ethers.getContractFactory(facet);
      }
    }
    const facetInstance = await factory.deploy(...constructorArgs);
    await facetInstance.deployed();
    const tx = facetInstance.deployTransaction;
    const receipt = await tx.wait();
    if (verbose) console.log(`${facet} deploy gas used: ` + strDisplay(receipt.gasUsed));
    totalGasUsed = totalGasUsed.add(receipt.gasUsed);
    instancesAndNames.push([facet, facetInstance]);
  }
  return instancesAndNames;
}

async function getFacetData(mock=true) {
  // if new facets are added to beanstalk,
  // append them here.
  // "Mock" versions are automatically detected, 
  // if mocks are enabled (make sure to append "Mock" to the facet name).
  facets = [
    "BDVFacet",
    "CurveFacet",
    "MigrationFacet",
    "ApprovalFacet",
    "ConvertGettersFacet",
    "EnrootFacet",
    "FarmFacet",
    "PauseFacet",
    "DepotFacet",
    "SeasonGettersFacet",
    "OwnershipFacet",
    "TokenFacet",
    "TokenSupportFacet",
    "MetadataFacet",
    "GaugePointFacet",
    "SiloGettersFacet",
    "LiquidityWeightFacet",
    "ConvertFacet",
    "FieldFacet",
    "FundraiserFacet",
    "MarketplaceFacet",
    "SeasonFacet",
    "SiloFacet",
    "FertilizerFacet",
    "UnripeFacet",
    "WhitelistFacet"
  ]

  // A list of public libraries that need to be deployed separately.
  libraryNames = [
    "LibGauge",
    "LibIncentive",
    "LibConvert",
    "LibLockedUnderlying",
    "LibCurveMinting",
    "LibWellMinting"
  ];

  // A mapping of facet to public library names that will be linked to it.
  // MockFacets will be deployed with the same public libaries.
  facetLibraries = {
    SeasonFacet: [
      "LibGauge", 
      "LibIncentive", 
      "LibLockedUnderlying", 
      "LibWellMinting"
    ],
    ConvertFacet: ["LibConvert"],
    UnripeFacet: ["LibLockedUnderlying"],
    SeasonGettersFacet: ["LibLockedUnderlying", "LibWellMinting"]
  };

  return [facets, libraryNames, facetLibraries]
}

/**
 * Deploys "MockToken" versions of common ERC20s.
 * @dev called if "impersonate" flag is enabled.
 * New ERC20s can be added via the `tokens` array.
 */
async function impersonateERC20s(
) {
  await impersonateBean();
  await impersonateWeth();
  await impersonateWsteth();

  // New default ERC20s should be added here.
  tokens = [
    [USDC, 6],
    [USDT, 18],
    [DAI, 18]
  ]
  for (let token of tokens) {
    await impersonateToken(token[0], token[1]);
  }
}

/**
 * @notice Deploy and impersonate oracles.
 */
async function impersonateOracles() {
  // Eth:USD oracle
  await impersonateChainlinkAggregator(ETH_USD_CHAINLINK_AGGREGATOR);

  // WStEth oracle
  await impersonateChainlinkAggregator(STETH_ETH_CHAINLINK_PRICE_AGGREGATOR);
  await impersonateUniswapV3(WSTETH_ETH_UNIV3_01_POOL, WSTETH, WETH, 100);

  // New oracles for wells should be added here.
}

function addCommas(nStr) {
  nStr += "";
  const x = nStr.split(".");
  let x1 = x[0];
  const x2 = x.length > 1 ? "." + x[1] : "";
  var rgx = /(\d+)(\d{3})/;
  while (rgx.test(x1)) {
    x1 = x1.replace(rgx, "$1" + "," + "$2");
  }
  return x1 + x2;
}

function strDisplay(str) {
  return addCommas(str.toString());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

exports.deploy = main;
