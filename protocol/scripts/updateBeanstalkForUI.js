const { impersonateSigner, impersonateBeanstalkOwner, mintEth } = require("../utils");
const { upgradeWithNewFacets } = require("./diamond");
const { BEANSTALK, PRICE_DEPLOYER } = require("../test/utils/constants.js");

export async function updateBeanstalkForUI() {
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
      "LibChainlinkOracle"
    ],
    facetLibraries: {
      SeasonFacet: [
        "LibGauge",
        "LibIncentive",
        "LibLockedUnderlying",
        "LibWellMinting",
        "LibGerminate"
      ],
      SeasonGettersFacet: ["LibLockedUnderlying", "LibWellMinting"]
    },
    initArgs: [],
    bip: false,
    verbose: true,
    account: owner
  });

  const account = await impersonateSigner(PRICE_DEPLOYER, true);
  let price = await deployAtNonce("BeanstalkPrice", account, (n = 3), verbose, [BEANSTALK]);

  const bytecode = await ethers.provider.getCode(price.address);
  await network.provider.send("hardhat_setCode", [
    "0x4bed6cb142b7d474242d87f4796387deb9e1e1b4",
    bytecode
  ]);

  price = await ethers.getContractAt(
    "BeanstalkPrice",
    "0x4bed6cb142b7d474242d87f4796387deb9e1e1b4"
  );

  const usdOracle = await deployAtNonce("UsdOracle", account, (n = 5), verbose);
  const bytecode2 = await ethers.provider.getCode(usdOracle.address);
  await network.provider.send("hardhat_setCode", [
    "0xb24a70b71e4cca41eb114c2f61346982aa774180",
    bytecode2
  ]);

  await network.provider.send("hardhat_setCode", [
    "0xE0AdBED7e2ac72bc7798c5DC33aFD77B068db7Fd",
    bytecode2
  ]);
}
