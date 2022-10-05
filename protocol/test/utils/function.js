function packAdvanced(data, preBytes = '0x0000') {
    return ethers.utils.solidityPack(['bytes2', 'uint80', 'uint80', 'uint80'], [preBytes, data[0], data[1], data[2]])
  }

  exports.packAdvanced = packAdvanced