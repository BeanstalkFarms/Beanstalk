var JSONbig = require("json-bigint");
const fs = require("fs");
const ethers = require("ethers");

function parseJson(file) {
  var jsonString = fs.readFileSync(file);
  const data = JSONbig.parse(jsonString);
  return [data["columns"], data["data"]];
}

async function incrementTime(t = 86400) {
  await ethers.provider.send("evm_mine");
  await ethers.provider.send("evm_increaseTime", [t]);
  await ethers.provider.send("evm_mine");
}

async function getEthSpentOnGas(result) {
  const receipt = await result.wait();
  return receipt.effectiveGasPrice.mul(receipt.cumulativeGasUsed);
}

function toBean(amount) {
  return ethers.utils.parseUnits(amount, 6);
}

function to6(amount) {
  return ethers.utils.parseUnits(amount, 6);
}

function toStalk(amount) {
  return ethers.utils.parseUnits(amount, 16);
}

function toEther(amount) {
  return ethers.utils.parseEther(amount);
}

function to18(amount) {
  return ethers.utils.parseEther(amount);
}

function to6(amount) {
  return ethers.utils.parseUnits(amount, 6);
}

function toX(amount, x) {
  return ethers.utils.parseUnits(amount, x);
}

function toBN(a) {
  return ethers.BigNumber.from(a);
}

async function advanceTime(time) {
  let timestamp = (await hre.ethers.provider.getBlock("latest")).timestamp;
  timestamp += time;
  await hre.network.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [timestamp]
  });
}

exports.toBean = toBean;
exports.to6 = to6;
exports.toStalk = toStalk;
exports.toEther = toEther;
exports.to18 = to18;
exports.to6 = to6;
exports.parseJson = parseJson;
exports.getEthSpentOnGas = getEthSpentOnGas;
exports.incrementTime = incrementTime;
exports.advanceTime = advanceTime;
exports.toX = toX;
exports.toBN = toBN;
