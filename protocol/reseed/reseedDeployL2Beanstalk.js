const { deployDiamond } = require("../scripts/diamond.js");
const { impersonateSigner, mintEth } = require("../utils");

/**
 * @notice Deploys a new beanstalk diamond contract without any facets. Should be on an L2.
 * @dev account: the account to deploy the beanstalk with.
 * Todo: facets should be added post-migration to prevent users from interacting.
 */
async function reseedDeployL2Beanstalk(account, verbose = true, mock) {

  // Initialize deployer account for vanity address.
  const deployerPk = process.env.DIAMOND_DEPLOYER_PRIVATE_KEY;
  let deployerSigner = await new ethers.Wallet(deployerPk, ethers.provider);
  if (mock) {
    await mintEth(deployerSigner.address);
  }

  const beanstalkDiamond = await deployDiamond({
      diamondName: "L2BeanstalkDiamond",
      ownerAddress: account.address, // owner should always be the L2 BCM address (root account).
      deployer: deployerSigner,
      args: [],
      verbose: verbose
    });

  return beanstalkDiamond.address;
}


exports.reseedDeployL2Beanstalk = reseedDeployL2Beanstalk;
