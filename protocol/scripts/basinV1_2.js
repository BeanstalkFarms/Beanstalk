const { deployWellContract, encodeWellImmutableData, getWellContractAt } = require("../utils/well");

/**
 * @notice deploys the Upgradeable well implementation and the stable2 well function.
 */
async function deployBasinV1_2Components() {
  // deploy upgradeble well:
  wellUpgradable = await deployWellContract("WellUpgradeable", [], undefined, false, "1.2");

  // deploy the stable2 well function:
  const lookupTable = await deployWellContract("Stable2LUT1", [], undefined, false, "1.2");
  stable = await deployWellContract("Stable2", [lookupTable.address], undefined, false, "1.2");
  return [wellUpgradable, stable];
}

async function deployUpgradeableWell(
  aquifer,
  bean,
  token,
  wellImplementation,
  wf,
  wfData,
  pump,
  pumpData,
  salt
) {
  // get length of wfData:

  const immutableData = await encodeWellImmutableData(
    aquifer.address,
    [bean, token],
    { target: wf.address, data: wfData, length: wfData.length / 2 },
    [{ target: pump.address, data: pumpData, length: pumpData.length / 2 }]
  );

  const initData = await wellImplementation.interface.encodeFunctionData("initNoWellToken");
  well = await aquifer.predictWellAddress(wellImplementation.address, immutableData, salt);

  await aquifer.boreWell(wellImplementation.address, immutableData, initData, salt);
  return well;
}

exports.deployBasinV1_2Components = deployBasinV1_2Components;
exports.deployUpgradeableWell = deployUpgradeableWell;
