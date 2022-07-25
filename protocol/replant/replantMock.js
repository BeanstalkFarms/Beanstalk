const { impersonateBeanstalkOwner } = require('../utils/signer.js');
const { upgradeWithNewFacets } = require('../scripts/diamond.js');
const { BEANSTALK } = require('../test/utils/constants.js');

async function replantMock (
        account
    ) {
    console.log('-----------------------------------')
    console.log('Replant11:\n')
    const signer = await impersonateBeanstalkOwner()
    await upgradeWithNewFacets({
      diamondAddress: BEANSTALK,
      facetNames: ['MockAdminFacet'],
      bip: false,
      verbose: true,
      account: signer
    });
    console.log('-----------------------------------')
}
exports.replantMock = replantMock
