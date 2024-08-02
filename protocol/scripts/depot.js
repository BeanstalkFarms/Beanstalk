var fs = require('fs');
const { DEPOT, DEPOT_DEPLOYER } = require('../test/utils/constants');
const { impersonateSigner, mintEth } = require('../utils');
const { deployAtNonce } = require('./contracts');

async function deploy(account=undefined) {
  if (account == undefined) {
    account = await impersonateSigner(DEPOT_DEPLOYER)
    await mintEth(account.address)
  }
  return await deployAtNonce('Depot', account, n = 5)
}
async function impersonate() {
  let json = fs.readFileSync(`./artifacts/contracts/depot/Depot.sol/Depot.json`);
  await network.provider.send("hardhat_setCode", [
    DEPOT,
    JSON.parse(json).deployedBytecode,
  ]);
  return await ethers.getContractAt("Depot", DEPOT)
}

exports.deployDepot = deploy
exports.impersonateDepot = impersonate