const { deployDiamond } = require("../scripts/diamond.js");
const { impersonateSigner, mintEth } = require("../utils");

/**
 * @notice Deploys a new beanstalk diamond contract without any facets. Should be on an L2.
 * @dev account: the account to deploy the beanstalk with.
 */
async function reseedDeployL2Beanstalk(account, verbose = true, mock) {
  // Initialize deployer account for vanity address.
  if (mock) {
    await mintEth(account.address);
  }

  // owner is initially the deployer. Upon the verification of the diamond,
  // the deployer will transfer ownership to the beanstalk owner.
  const beanstalkDiamond = await deployDiamond({
    diamondName: "L2BeanstalkDiamond",
    ownerAddress: account.address,
    deployer: account,
    args: [],
    verbose: verbose
  });

  return beanstalkDiamond.address;
}

exports.reseedDeployL2Beanstalk = reseedDeployL2Beanstalk;
