const { ethers } = require("ethers");

const getBlueprintHash = (publisher, predicates, data, calldataCopyParams) => {
  const encodedHash = ethers.utils.defaultAbiCoder.encode(
    ["tuple(address, bytes[], bytes, bytes32[])"],
    [[publisher, predicates, data, calldataCopyParams]]
  );
  return ethers.utils.solidityKeccak256(["bytes"], [encodedHash]);
};

module.exports = {
  getBlueprintHash,
};
