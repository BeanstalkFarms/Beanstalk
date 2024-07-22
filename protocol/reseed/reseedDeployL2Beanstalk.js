const { deployDiamond } = require("../scripts/diamond.js");
const { impersonateSigner, mintEth } = require("../utils");

/**
 * @notice Deploys a new beanstalk diamond contract without any facets. Should be on an L2.
 * @dev account: the account to deploy the beanstalk with.
 * Todo: facets should be added post-migration to prevent users from interacting.
 */
async function reseedDeployL2Beanstalk(account, verbose = true, mock) {
  // impersonate `account`:
  let signer;
  if (mock) {
    await mintEth(account.address);
    signer = await ethers.provider.getSigner(account.address);
  } else {
    signer = await impersonateSigner(account.address);
  }

  const beanstalkDiamond = await deployDiamond({
      diamondName: "L2BeanstalkDiamond",
      owner: account,
      args: [],
      verbose: verbose
    });
  
  return beanstalkDiamond.address;
}


exports.reseedDeployL2Beanstalk = reseedDeployL2Beanstalk;
