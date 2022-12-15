const { ethers } = require("ethers");

const getBlueprintHash = (blueprint) => {
  return ethers.utils.solidityKeccak256(
    ["address", "bytes", "bytes32[]", "uint256", "uint256", "uint256"],
    [
      blueprint.publisher,
      blueprint.data,
      blueprint.calldataCopyParams,
      blueprint.maxNonce,
      blueprint.startTime,
      blueprint.endTime,
    ]
  );
};

const signBlueprint = async (blueprint, signer) => {
  blueprint.signature = await signer.signMessage(
    ethers.utils.arrayify(getBlueprintHash(blueprint))
  );

  return blueprint;
};

const getNormalBlueprintData = (data) => {
  const blueprintData = ethers.utils.defaultAbiCoder.encode(
    ["bytes[]"],
    [data]
  );
  return ethers.utils.hexlify(
    new Uint8Array([0, ...ethers.utils.arrayify(blueprintData)])
  );
};

const getAdvancedBlueprintData = (data) => {
  const blueprintData = ethers.utils.defaultAbiCoder.encode(
    ["(bytes,bytes)[]"],
    [data]
  );
  return ethers.utils.hexlify(
    new Uint8Array([1, ...ethers.utils.arrayify(blueprintData)])
  );
};

module.exports = {
  getBlueprintHash,
  signBlueprint,
  getNormalBlueprintData,
  getAdvancedBlueprintData,
};
