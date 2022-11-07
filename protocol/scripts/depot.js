var fs = require('fs');
const { DEPOT } = require('../test/utils/constants');

async function deploy(account) {
  const Depot = await ethers.getContractFactory('Depot', account);
  const depot = await Depot.deploy();
  await depot.deployed()
  return depot
}

async function impersonate() {
  let json = fs.readFileSync(`./artifacts/contracts/depot/Depot.sol/Depot.json`);
  await network.provider.send("hardhat_setCode", [
    DEPOT,
    JSON.parse(json).deployedBytecode,
  ]);
}

exports.deployDepot = deploy
exports.impersonateDepot = impersonate