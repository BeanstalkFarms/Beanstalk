const fs = require('fs')
const { upgradeWithNewFacets } = require('../scripts/diamond.js');
const { BEANSTALK } = require('../test/utils/constants.js');

/// Files
const V1_LP_WITHDRAWALS = "./replant/data/r4-v1LpWithdrawals.json"
const V2_LP_WITHDRAWALS = "./replant/data/r4-v2LpWithdrawals.json"

/**
 * Replant #4
 * ----------
 * 1. Remove all LP Withdrawals
 */
async function replant4(account) {
  console.log('-----------------------------------')
  console.log('Replant4:\n')

  const v1LPWithdrawals = JSON.parse(await fs.readFileSync(V1_LP_WITHDRAWALS));
  const v2LPWithdrawals = JSON.parse(await fs.readFileSync(V2_LP_WITHDRAWALS));
  
  /// ./protocol/contracts/farm/init/replant/Replant4.sol
  await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    facetNames: [],
    initFacetName: 'Replant4',
    initArgs: [
      v1LPWithdrawals,
      v2LPWithdrawals
    ],
    bip: false,
    verbose: true,
    account: account
  });

  console.log('-----------------------------------')
}
exports.replant4 = replant4
