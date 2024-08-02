const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { USDC } = require('./utils/constants.js');

describe('USD Oracle', function () {
    before(async function () {
        const contracts = await deploy("Test", false, true);
        season = await ethers.getContractAt('MockSeasonFacet', contracts.beanstalkDiamond.address)
    })

    beforeEach(async function () {
        snapshotId = await takeSnapshot();
    });
    
    afterEach(async function () {
        await revertToSnapshot(snapshotId);
    });

    it("Reverts if not accepted token", async function () {
        await expect(season.getUsdPrice(USDC)).to.be.revertedWith('Oracle: Token not supported.') // About 1e14
    })
})