const { deployFertilizer } = require('../scripts/deployFertilizer.js')
const { bipMiscellaneousImprovements } = require('../scripts/bips.js')
const { BEANSTALK, FERTILIZER } = require('./utils/constants.js')
const { assert } = require('chai')

describe('Fert Upgrade with on-chain metadata', function () {
    before(async function () {
        await bipMiscellaneousImprovements();
        // fert contract
        this.fert = await ethers.getContractAt('Fertilizer', FERTILIZER)
        // fert beanstalk facet
        this.fertilizer = await ethers.getContractAt('FertilizerFacet', BEANSTALK)
    })

    it("gets the new fert uri", async function () {
        const userId = 1334880
        // const id = await this.fert.getMintId()
        const uri = await this.fert.uri(userId)
        console.log(uri)
    })

    it("keeps the same fert owner", async function () {
        const owner = await this.fert.owner()
        assert.equal(owner, BEANSTALK)
    })
    
})