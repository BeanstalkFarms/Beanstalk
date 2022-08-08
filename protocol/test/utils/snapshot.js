const { ethers } = require("hardhat");

const takeSnapshot = async () => {
  const snapshotId = await ethers.provider.send("evm_snapshot");
  return snapshotId;
};

const revertToSnapshot = async (snapshotId) => {
  await ethers.provider.send("evm_revert", [snapshotId]);
};

module.exports = {
  takeSnapshot,
  revertToSnapshot,
};
