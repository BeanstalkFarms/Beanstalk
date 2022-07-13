// Contracts
const { FERTILIZER_ADMIN, BEANSTALK, BCM } = require('../test/utils/constants.js');

async function replant9 (account) {
  console.log('-----------------------------------')
  console.log('Replant9:\n')
  const ownershipFacet = await ethers.getContractAt("OwnershipFacet", BEANSTALK)
  await ownershipFacet.connect(account).transferOwnership(BCM)
  console.log(`Transfered Beanstalk owner to ${await ownershipFacet.owner()}`)

  const proxyAdmin = await ethers.getContractAt("OwnershipFacet", FERTILIZER_ADMIN)
  await proxyAdmin.connect(account).transferOwnership(BEANSTALK)
  console.log(`Transferred Fertilizer owner to ${await proxyAdmin.owner()}`)
  console.log('-----------------------------------')
}
exports.replant9 = replant9