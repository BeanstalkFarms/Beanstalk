const { upgradeWithNewFacets } = require("../scripts/diamond");
const { BEANSTALK } = require("../test/utils/constants");
const { getBeanstalk } = require("./contracts");
const { mintEth } = require("./mint");
const { impersonateBeanstalkOwner } = require("./signer");


async function addAdminControls() {
    const owner = await impersonateBeanstalkOwner()
    await mintEth(owner.address);
    await upgradeWithNewFacets({
      diamondAddress: BEANSTALK,
      facetNames: [
        'MockAdminFacet'
      ],
      initArgs: [],
      bip: false,
      verbose: false,
      account: owner
    });
}

exports.addAdminControls = addAdminControls