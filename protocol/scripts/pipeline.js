var fs = require('fs');
const { PIPELINE, PIPELINE_DEPLOYER } = require('../test/utils/constants');
const { impersonateSigner, mintEth } = require('../utils');
const { deployAtNonce } = require('./contracts');

async function deploy(account=undefined) {
  if (account == undefined) {
    account = await impersonateSigner(PIPELINE_DEPLOYER)
    await mintEth(account.address)
  }
  return await deployAtNonce('Pipeline', account, n = 8)
}

async function impersonate() {
  let json = fs.readFileSync(`./artifacts/contracts/pipeline/Pipeline.sol/Pipeline.json`);
  await network.provider.send("hardhat_setCode", [
    PIPELINE,
    JSON.parse(json).deployedBytecode,
  ]);
  return await ethers.getContractAt('Pipeline', PIPELINE)
}

exports.deployPipeline = deploy
exports.impersonatePipeline = impersonate