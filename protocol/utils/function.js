
const { defaultAbiCoder } = require('@ethersproject/abi');
const { toBN } = require('./helpers');
const { to6 } = require('../test/utils/helpers');

// data is a list of the 3 indices: [returnDataIndex, copyIndex, pasteIndex]
// preBytes is optional and should be used if the function call performs exactly 1 data copy operation
// in which case it should be set to `0x0${type}0${useEtherFlag}`
// where type is 0, 1 or 2 and useEtherFlag is 0 or 1.
function packAdvanced(data, preBytes = '0x0000') {
  return ethers.utils.solidityPack(['bytes2', 'uint80', 'uint80', 'uint80'], [preBytes, data[0], data[1], data[2]])
}


// encode bytes advancedData based on type, value and copyData parameters:
// type = 0,1, or 2
// value = Ether to send in transaction as BigNumber
// copyData = 
//		 if type = 0, []
//     if type = 1, [returnDataIndex, copyIndex, pasteIndex]
//     if type = 2, [[returnDataIndex, copyIndex, pasteIndex]] (List of copyParams)
function encodeAdvancedData(type, value = to6('0'), copyData = []) {
  let types = []
  let encodeData = []
  let typeBytes = `0x0${type}0${value > toBN('0') ? 1 : 0}`
  if (type == 1) {
    encodeData.push(packAdvanced(copyData, preBytes = typeBytes))
    types.push('bytes32')
  } else if (type == 2) {
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
  d = defaultAbiCoder.encode(types, encodeData);
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
}

exports.packAdvanced = packAdvanced
exports.encodeAdvancedData = encodeAdvancedData
exports.decodeAdvancedData = decodeAdvancedData