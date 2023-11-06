const { ethers } = require("ethers");

const abi = ethers.utils.defaultAbiCoder;

const getBooleanApproval = (placeBefore, expectedCaller, approve) => {
  const approvalPlace = placeBefore ? 0 : 1;
  const approvalType = 0;
  const approvalValue = abi.encode(
    ["address", "bool"],
    [expectedCaller, approve]
  );
  return ethers.utils.solidityPack(
    ["bytes1", "bytes1", "bytes"],
    [approvalPlace, approvalType, approvalValue]
  );
};

const getUint256Approval = (placeBefore, expectedCaller, allowance) => {
  const approvalPlace = placeBefore ? 0 : 1;
  const approvalType = 1;
  const approvalValue = abi.encode(
    ["address", "uint256"],
    [expectedCaller, allowance]
  );
  return ethers.utils.solidityPack(
    ["bytes1", "bytes1", "bytes"],
    [approvalPlace, approvalType, approvalValue]
  );
};

const getExternalApproval = (placeBefore, externalContract, stateData) => {
  const approvalPlace = placeBefore ? "0x00" : "0x01";
  const approvalType = "0x02";
  const approvalValue = abi.encode(
    ["address", "bytes"],
    [externalContract, stateData]
  );
  return ethers.utils.solidityPack(
    ["bytes1", "bytes1", "bytes"],
    [approvalPlace, approvalType, approvalValue]
  );
};

module.exports = {
  getBooleanApproval,
  getUint256Approval,
  getExternalApproval,
};
