const { upgradeWithNewFacets } = require('../scripts/diamond.js');
const fs = require('fs')
const { BEANSTALK } = require('../test/utils/constants.js');

// Files
const V1_LP_WITHDRAWALS = "./replant/data/r4-v1LpWithdrawals.json"
const V2_LP_WITHDRAWALS = "./replant/data/r4-v2LpWithdrawals.json"

async function replant4 (
        account
    ) {
    console.log('-----------------------------------')
    console.log('Replant4: Delete LP Withdrawals\n')
    const v1LPWithdrawals = JSON.parse(await fs.readFileSync(V1_LP_WITHDRAWALS));
    const v2LPWithdrawals = JSON.parse(await fs.readFileSync(V2_LP_WITHDRAWALS));
    
    await upgradeWithNewFacets({
      diamondAddress: BEANSTALK,
      facetNames: [],
      initFacetName: 'Replant4',
      initArgs: [v1LPWithdrawals, v2LPWithdrawals],
      bip: false,
      verbose: true,
      account: account
    });
    console.log('-----------------------------------')
}
exports.replant4 = replant4
