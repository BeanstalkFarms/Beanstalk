var JSONbig = require('json-bigint');
const fs = require('fs')

function parseJson(file) {
  var jsonString = fs.readFileSync(file)
  const data = JSONbig.parse(jsonString)
  return [data['columns'], data['data']]
}

async function incrementTime(t=86400) {
  await ethers.provider.send("evm_mine")
  await ethers.provider.send("evm_increaseTime", [t])
  await ethers.provider.send("evm_mine")
}


async function getEthSpentOnGas(result) {
  const receipt = await result.wait()
  return receipt.effectiveGasPrice.mul(receipt.cumulativeGasUsed);
}

function toBean(amount) {
  return ethers.utils.parseUnits(amount,6);
}

function toEther(amount) {
  return ethers.utils.parseEther(amount);
}

exports.toBean = toBean
exports.toEther = toEther
exports.parseJson = parseJson
exports.getEthSpentOnGas = getEthSpentOnGas
exports.incrementTime = incrementTime
