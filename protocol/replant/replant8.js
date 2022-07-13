const { upgradeWithNewFacets } = require('../scripts/diamond.js');
const { BEANSTALK } = require('../test/utils/constants.js');

async function replant8 (
        account
    ) {
    console.log('-----------------------------------')
    console.log('Replant8:\n')
    await upgradeWithNewFacets({
      diamondAddress: BEANSTALK,
      facetNames: [],
      initFacetName: 'Replant8',
      bip: false,
      verbose: true,
      account: account
    });
    console.log('-----------------------------------')
}
exports.replant8 = replant8
