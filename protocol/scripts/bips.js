const { BEANSTALK } = require("../test/utils/constants");
const { getBeanstalk, impersonateBeanstalkOwner, mintEth } = require("../utils")
const { upgradeWithNewFacets } = require("./diamond");
const { impersonatePipeline, deployPipeline } = require('./pipeline')

async function bip30(mock = true, account = undefined, deployAccount = undefined) {
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

async function bip29(mock = true, account = undefined) {
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
        selectorsToRemove: [
            '0xeb6fa84f',
            '0xed778f8e',
            '0x72db799f',
            '0x56e70811',
            '0x6d679775',
            '0x1aac9789'
        ],
        bip: false,
        object: !mock,
        verbose: true,
        account: account
      });
}

exports.bip29 = bip29
exports.bip30 = bip30