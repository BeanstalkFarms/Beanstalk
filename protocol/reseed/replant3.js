const { upgradeWithNewFacets } = require('../scripts/diamond.js');
const fs = require('fs')
const { BEANSTALK } = require('../test/utils/constants.js');

// Files
const HARVESTABLE_PLOTS = "./replant/data/r3-harvestablePlots.json"
const POD_LISTINGS = "./replant/data/r3-podListings.json"
const POD_ORDERS = "./replant/data/r3-podOrders.json"
const BEAN_WITHDRAWALS = "./replant/data/r3-beanWithdrawals.json"

// Params
const PARTIAL_ADDRESS = '0xc3853c3a8fc9c454f59c9aed2fc6cfa1a41eb20e'
const PARTIAL_AMOUNT = '54339725407961'

async function replant3 (
        account
    ) {
    console.log('-----------------------------------')
    console.log('Replant3: Remove Non-Deposited Beans\n')
    const harvestablePlots = JSON.parse(await fs.readFileSync(HARVESTABLE_PLOTS));
    const podListings = JSON.parse(await fs.readFileSync(POD_LISTINGS));
    const podOrders = JSON.parse(await fs.readFileSync(POD_ORDERS));
    const beanWithdrawals = JSON.parse(await fs.readFileSync(BEAN_WITHDRAWALS));
    
    await upgradeWithNewFacets({
      diamondAddress: BEANSTALK,
      facetNames: [],
      initFacetName: 'Replant3',
      initArgs: [harvestablePlots, podListings, PARTIAL_ADDRESS, PARTIAL_AMOUNT, podOrders, beanWithdrawals],
      bip: false,
      verbose: true,
      account: account
    });
    console.log('-----------------------------------')
}
exports.replant3 = replant3
