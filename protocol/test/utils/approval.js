const { ethers } = require("ethers");

const abi = ethers.utils.defaultAbiCoder;

const getBooleanApproval = (approve) => {
  const approvalType = "0x00";
  const approvalValue = abi.encode(["bool"], [approve]);
  return ethers.utils.solidityPack(
    ["bytes1", "bytes"],
    [approvalType, approvalValue]
  );
};

const getUint256Approval = (allowance) => {
  const approvalType = "0x01";
  const approvalValue = abi.encode(["uint256"], [allowance]);
  return ethers.utils.solidityPack(
    ["bytes1", "bytes"],
    [approvalType, approvalValue]
  );
};

const getExternalApproval = (approve) => {};

module.exports = {
  getBooleanApproval,
  getUint256Approval,
  getExternalApproval,
};
