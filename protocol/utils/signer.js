const { getBeanstalk } = require('./contracts.js');
const { mintEth } = require('./mint.js');

async function impersonateSigner(signerAddress, withEth = false) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [signerAddress],
  });

  if (withEth) await mintEth(signerAddress)
  
  return await ethers.getSigner(signerAddress)
}

async function impersonateBeanstalkOwner() {
  const owner = await (await getBeanstalk()).owner()
  return await impersonateSigner(owner, true)
}

exports.impersonateSigner = impersonateSigner;
exports.impersonateBeanstalkOwner = impersonateBeanstalkOwner;