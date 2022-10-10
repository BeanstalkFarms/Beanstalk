var fs = require('fs');

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

exports.deployPipeline = deploy
exports.impersonatePipeline = impersonate