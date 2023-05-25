const { BEANSTALK } = require("../test/utils/constants");
const { getBeanstalk, impersonateBeanstalkOwner, mintEth } = require("../utils")
const { upgradeWithNewFacets } = require("./diamond");
const { impersonatePipeline, deployPipeline } = require('./pipeline')

async function bip30(mock = true, account = undefined) {
    if (account == undefined) {
        account = await impersonateBeanstalkOwner()
        await mintEth(account.address)
    }

    await upgradeWithNewFacets({
        diamondAddress: BEANSTALK,
        facetNames: [
            'DepotFacet', // Add Depot
            'TokenSupportFacet', // Add ERC-20 permit function
            'FarmFacet', // Add AdvancedFarm
            'SeasonFacet'
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

//BIP for Silo migration to stem
async function bipNewSilo(mock = true, account = undefined) {
    if (account == undefined) {
        account = await impersonateBeanstalkOwner()
        await mintEth(account.address)
    }

    await upgradeWithNewFacets({
        diamondAddress: BEANSTALK,
        facetNames: [
            'SiloFacet', 'ConvertFacet', 'WhitelistFacet'
        ],
        initFacetName: 'InitBipNewSilo',
        bip: false,
        object: !mock, //if this is true, something would get spit out in the diamond cuts folder with all the data (due to gnosis safe deployment flow)
        verbose: true,
        account: account
    })
}

async function bip34(mock = true, account = undefined) {
    if (account == undefined) {
        account = await impersonateBeanstalkOwner()
        await mintEth(account.address)
    }

    await upgradeWithNewFacets({
        diamondAddress: BEANSTALK,
        facetNames: [
            'FieldFacet', // Add Morning Auction
            'SeasonFacet', // Add ERC-20 permit function
            'FundraiserFacet', // update fundraiser with new soil spec
        ],
        initFacetName: 'InitBipSunriseImprovements',
        selectorsToRemove: [
            "0x78309c85",
            "0x6c8d548e",
        ],
        bip: false,
        object: !mock,
        verbose: true,
        account: account,
        verify: false
      });
}

exports.bip29 = bip29
exports.bip30 = bip30
exports.bip34 = bip34
exports.bipNewSilo = bipNewSilo
