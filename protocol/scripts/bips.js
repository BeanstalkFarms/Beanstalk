const { BEANSTALK } = require("../test/utils/constants");
const { getBeanstalk, impersonateBeanstalkOwner, mintEth } = require("../utils")
const { upgradeWithNewFacets } = require("./diamond");
const { impersonatePipeline, deployPipeline } = require('./pipeline')

async function bip29(mock = true, account = undefined, deployAccount = undefined) {
    if (account == undefined) {
        account = await impersonateBeanstalkOwner()
        await mintEth(account.address)
    }

    if (mock) {
        await impersonatePipeline()
    } else {
        const pipeline = await deployPipeline(deployAccount)
        console.log(pipeline.address);
        // Note: Make sure pipeline is defined in C.sol correctly.
    }

    beanstalk = await getBeanstalk()
    await upgradeWithNewFacets({
        diamondAddress: BEANSTALK,
        facetNames: [
            'DepotFacet', // Add Depot
            'TokenFacet', // Add ERC-20 permit function
            'FarmFacet' // Add AdvancedFarm
        ],
        bip: false,
        object: !mock,
        verbose: true,
        account: account
      });
}

async function bip28(mock = true, account = undefined) {
    if (account == undefined) {
        account = await impersonateBeanstalkOwner()
        await mintEth(account.address)
    }

    beanstalk = await getBeanstalk()
    await upgradeWithNewFacets({
        diamondAddress: BEANSTALK,
        facetNames: [
            'MarketplaceFacet', // Marketplace V2
            'SiloFacet',  // Add Deposit Permit System
            'TokenFacet' // Add ERC-20 Token Approval System
        ],
        bip: false,
        object: !mock,
        verbose: true,
        account: account
      });
}

exports.bip28 = bip28
exports.bip29 = bip29