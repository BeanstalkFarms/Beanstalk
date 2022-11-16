const { BEANSTALK } = require("../test/utils/constants");
const { mintEth, impersonateBeanstalkOwner, getBeanstalk } = require("../utils");
const { upgradeWithNewFacets } = require("../scripts/diamond");
const { bip30 } = require("../scripts/bips");
const { ebip6 } = require("../scripts/ebips")
const { deployRoot, whitelistBeanRoot } = require("../scripts/root");
const { impersonateDepot } = require("../scripts/depot");

async function mockAdmin() {
    console.log('Adding Mocks')
    const signer = await impersonateBeanstalkOwner()
    await mintEth(signer.address)
    await upgradeWithNewFacets({
        diamondAddress: BEANSTALK,
        facetNames: ['MockAdminFacet'],
        bip: false,
        verbose: false,
        account: signer
    });
}

async function mockSunrise() {
    beanstalk = await getBeanstalk()
    const lastTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const hourTiemstamp = parseInt(lastTimestamp/3600 + 1) * 3600
    await network.provider.send("evm_setNextBlockTimestamp", [hourTiemstamp])
    await beanstalk.sunrise()

}

async function deployV2_1() {
    await bip30()
    await mockAdmin()
    await whitelistBeanRoot()
}

exports.mockAdmin = mockAdmin
exports.deployV2_1 = deployV2_1
exports.mockSunrise = mockSunrise