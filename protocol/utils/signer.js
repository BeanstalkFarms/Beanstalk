const { getBeanstalk } = require('./contracts.js')

async function impersonateSigner(signerAddress) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [signerAddress],
  });
  return await ethers.getSigner(signerAddress)
}

async function impersonateBeanstalkOwner() {
  const owner = await (await getBeanstalk()).owner()
  return await impersonateSigner(owner)
}

exports.impersonateSigner = impersonateSigner;
exports.impersonateBeanstalkOwner = impersonateBeanstalkOwner;