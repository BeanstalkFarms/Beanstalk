const { deployDiamond } = require("../scripts/diamond.js");
const { impersonateSigner, mintEth } = require("../utils");

/**
 * @notice Deploys a new beanstalk diamond contract without any facets. Should be on an L2.
 * @dev account: the account to deploy the beanstalk with.
 * Todo: facets should be added post-migration to prevent users from interacting.
 */
async function reseedDeployL2Beanstalk(account, verbose = true, mock) {
  // Initialize deployer account for vanity address.
  let deployerSigner;
  if (mock) {
    deployerSigner = await impersonateSigner("0xe26367ca850da09a478076481535d7c1c67d62f9");
    await mintEth(deployerSigner.address);
  } else {
    deployerSigner = new ethers.Wallet(process.env.DIAMOND_DEPLOYER_PRIVATE_KEY, ethers.provider);
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
