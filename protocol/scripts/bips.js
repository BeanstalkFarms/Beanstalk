const { getBeanstalk, impersonateBeanstalkOwner, mintEth } = require("../utils")
const { upgradeWithNewFacets } = require("./diamond");
const { BEANSTALK } = require("../test/utils/constants");

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