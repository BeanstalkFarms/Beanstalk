const { defaultAbiCoder } = require('@ethersproject/abi');

function encodePump(type, tokens, typeData = [], typeTypes = []) {
    types = ['bytes1', 'uint8']
    if (type == 0) types.push('address')
    else if (type == 1) types.push('uint128')
    return ethers.utils.solidityPack([...types, ...typeTypes], [`0x0${type}`, tokens, ...typeData])
}

function decodePumpBalance(data, bits=128) {
    console.log(data)
    return defaultAbiCoder.decode(
        [`uint${bits}[]`],
        data
    )
}

exports.encodePump = encodePump
exports.decodePumpBalance = decodePumpBalance