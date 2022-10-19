const { BEANSTALK } = require("../test/utils/constants");
const { getBeanstalk, impersonateBeanstalkOwner, mintEth } = require("../utils")
const { upgradeWithNewFacets } = require("./diamond");
const { impersonatePipeline, deployPipeline } = require('./pipeline')

async function bip29(mock = true, account = undefined, deployAccount = undefined) {
    console.log("Executing BIP-29")
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
        verbose: !mock,
        account: account
    });
}

async function bip28(mock = true, account = undefined) {
    console.log("Executing BIP-28")
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
        verbose: !mock,
        account: account
    });
}

exports.bip28 = bip28
exports.bip29 = bip29