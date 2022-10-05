var fs = require('fs');
const { defaultAbiCoder } = require('@ethersproject/abi');
const { toBN } = require('../utils');
const { to6 } = require('../test/utils/helpers');
const { packAdvanced } = require('../test/utils/function');

async function deploy(account) {
  const Pipeline = await ethers.getContractFactory('Pipeline', account);
  const pipeline = await Pipeline.deploy();
  await pipeline.deployed()
  return pipeline
}

async function impersonate() {
  let json = fs.readFileSync(`./artifacts/contracts/pipeline/Pipeline.sol/Pipeline.json`);
  await network.provider.send("hardhat_setCode", [
    PIPELINE,
    JSON.parse(json).deployedBytecode,
  ]);
}

function encodeAdvancedData(type, value=to6('0'), copyData=[]) {
  let types = []
  let encodeData = []
  let typeBytes = `0x0${type}0${value > toBN('0') ? 1 : 0}`
  if (type == 1) {
    encodeData.push(packAdvanced(copyData, preBytes = typeBytes))
    types.push('bytes32')
  } else if (type == 2){
    encodeData = encodeData.concat([typeBytes, copyData.map((d) => packAdvanced(d))])
    types = types.concat(['bytes2', 'uint256[]'])
  } else {
    types.push('bytes2')
    encodeData.push(typeBytes)
  }
  if (parseInt(value) > 0) {
    types.push('uint256')
    encodeData.push(value)
  }
  console.log(types)
  console.log(encodeData)
  d = defaultAbiCoder.encode(types, encodeData);
  console.log(d)
  return d
}


function decodeAdvancedData(data) {
  let types = []
  const type = parseInt(data[3])
  const hasValue = parseInt(data[5])
  if (type == 1) types = types.concat(['bytes32'])
  else if (type == 2) types = types.concat(['bytes2', 'uint256[]'])
  else types = types.concat(['bytes2'])
  if (hasValue > 0) types.push('uint256')
  return defaultAbiCoder.decode(types, data)

  return defaultAbiCoder.decode(callData, ['bytes[]'])
}

exports.deployPipeline = deploy
exports.impersonatePipeline = impersonate
exports.encodeAdvancedData = encodeAdvancedData
exports.decodeAdvancedData = decodeAdvancedData