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

module.exports = {
  getBlueprintHash,
  signBlueprint,
};
