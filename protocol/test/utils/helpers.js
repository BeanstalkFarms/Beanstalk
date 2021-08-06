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

exports.parseJson = parseJson
exports.incrementTime = incrementTime
