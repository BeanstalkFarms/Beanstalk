const { deployDiamond } = require("../scripts/diamond.js");
const { impersonateSigner, mintEth } = require("../utils");

/**
 * @notice Deploys a new beanstalk diamond contract without any facets. Should be on an L2.
 * @dev account: the account to deploy the beanstalk with.
 * Todo: facets should be added post-migration to prevent users from interacting.
 */
async function reseedDeployL2Beanstalk(account, diamondDeployerAccount, verbose = true, mock) {

  console.log("Deployer address: " + diamondDeployerAccount)
  // impersonate `account`:
  let signer;
  if (!mock) {
    await mintEth(diamondDeployerAccount);
    signer = await impersonateSigner(diamondDeployerAccount , true);
  } else {
    signer = await ethers.provider.getSigner();
  }

  console.log("Signer Address: " + await signer.getAddress());
  console.log("Signer Nonce: " + await signer.getTransactionCount());

  const beanstalkDiamond = await deployDiamond({
      diamondName: "L2BeanstalkDiamond",
      owner: account, // owner should always be the L2 BCM address.
      args: [],
      verbose: verbose
    });

  await impersonateSigner(account.address);
  
  return beanstalkDiamond.address;
}


exports.reseedDeployL2Beanstalk = reseedDeployL2Beanstalk;
