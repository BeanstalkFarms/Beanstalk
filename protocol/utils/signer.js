const { getBeanstalk } = require("./contracts.js");
const { BEANSTALK } = require("../test/hardhat/utils/constants.js");

async function impersonateSigner(signerAddress, withEth = false) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [signerAddress]
  });

  if (withEth) {
    await hre.network.provider.send("hardhat_setBalance", [signerAddress, "0x21E19E0C9BAB2400000"]);
  }

  return await ethers.getSigner(signerAddress);
}

async function impersonateBeanstalkOwner(beanstalk = BEANSTALK) {
  const owner = await (await getBeanstalk(beanstalk)).owner();
  return await impersonateSigner(owner, true);
}

exports.impersonateSigner = impersonateSigner;
exports.impersonateBeanstalkOwner = impersonateBeanstalkOwner;
