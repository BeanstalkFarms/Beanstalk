const { upgradeWithNewFacets } = require('../scripts/diamond.js');
const fs = require('fs')
const { BEANSTALK } = require('../test/utils/constants.js');
const SELECTORS = require('./data/beanstalkSelectors.json')

async function reseed1 (account) {
    beanstalkSelectors = []
    console.log('-----------------------------------')
    console.log('Reseed1: Initialize L2 migration\n')
    // read beanstalk selectors: 
    for (let i = 0; i < SELECTORS.length; i++) {
      selectors = SELECTORS[i][1];
      for(let j = 0; j < selectors.length; j++) {
        beanstalkSelectors.push(selectors[j])
      }
    }
    await upgradeWithNewFacets({
      diamondAddress: BEANSTALK,
      facetNames: [],
      facetsToRemove: beanstalkSelectors,
      initFacetName: 'InitL2Migration',
      bip: false,
      verbose: true,
      account: account
    });
    console.log('-----------------------------------')
}
exports.reseed1 = reseed1
