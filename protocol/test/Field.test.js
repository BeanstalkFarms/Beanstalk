require('hardhat')
const { expectRevert } = require('@openzeppelin/test-helpers')
const { expect } = require('chai')
const { deploy } = require('../scripts/deploy.js')
const { parseJson, getEthSpentOnGas, toBean, toEther } = require('./utils/helpers.js')
const { MAX_UINT32, MAX_UINT256 } = require('./utils/constants.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

const users = ['userAddress', 'user2Address', 'ownerAddress', 'otherAddress']

// Set the test data
const [columns, tests] = parseJson('./coverage_data/field.json')
var numberTests = tests.length
var startTest = 0

async function checkUserPlots(field, address, plots) {
  for (var i = 0; i < plots.length; i++) {
    expect(await field.plot(address, plots[i][0])).to.eq(plots[i][1])
  }
}

let snapshotId;

describe('Field', function () {

  before(async function () {
    [owner,user,user2,other] = await ethers.getSigners()
    userAddress = user.address
    user2Address = user2.address
    otherAddress = other.address
    const contracts = await deploy("Test", false, true)
    ownerAddress = contracts.account
    this.diamond = contracts.beanstalkDiamond
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.marketplace = await ethers.getContractAt('MarketplaceFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('MockToken', contracts.bean)
    await this.bean.connect(user).approve(this.field.address, MAX_UINT256)
    await this.bean.connect(user2).approve(this.field.address, MAX_UINT256)
    await this.bean.connect(other).approve(this.field.address, MAX_UINT256)
  });

  [...Array(numberTests).keys()].map(i => i + startTest).forEach(function(v) {
    const testStr = 'Test #'
    describe(testStr.concat((v)), function () {
      testData = {}
      columns.forEach((key, i) => testData[key] = tests[v][i])
      before(async function () {
        snapshotId = await takeSnapshot();
        this.testData = {}
        columns.forEach((key, i) => this.testData[key] = tests[v][i])
        for (c in columns) {
          if (typeof this.testData[columns[c]] == 'number') {
             this.testData[columns[c]] = this.testData[columns[c]].toString()
          }
        }
        await this.season.setYieldE(this.testData.weather)

        await this.bean.mint(userAddress, this.testData.userStarterBeans)
        await this.bean.mint(user2Address, this.testData.user2StarterBeans)
        await this.bean.mint(otherAddress, this.testData.otherStarterBeans)
        this.season.setSoilE(this.testData.startSoil)
        
        await this.season.setStartSoilE(this.testData.startSoil)
        await this.season.setLastSowTimeE(this.testData.startLastSowTime)
        await this.season.setLastDSoilE(this.testData.lastDSoil)
        for (var i = 0; i < this.testData.functionsCalled.length; i++) {
          this.testData.functionsCalled[i] = this.testData.functionsCalled[i].replace('Address','')
          this.result = await eval(this.testData.functionsCalled[i])
        }
      })

      it('updates user\'s balance', async function() {
        expect(await this.bean.balanceOf(userAddress)).to.eq(this.testData.userCirculatingBeans)
        await checkUserPlots(this.field,userAddress,this.testData.userPlots)
      })

      it('updates user2\'s balance', async function() {
        expect(await this.bean.balanceOf(user2Address)).to.eq(this.testData.user2CirculatingBeans)
        await checkUserPlots(this.field,user2Address,this.testData.user2Plots)
      })

      it('updates other\'s balance', async function() {
        expect(await this.bean.balanceOf(otherAddress)).to.eq(this.testData.otherCirculatingBeans)
        await checkUserPlots(this.field,otherAddress,this.testData.otherPlots)
      })

      it('updates total balance', async function() {
        expect(await this.bean.balanceOf(this.field.address)).to.eq(this.testData.totalHarvestablePods)
        expect(await this.bean.totalSupply()).to.eq(this.testData.totalBeans)
        expect(await this.field.totalPods()).to.eq(this.testData.totalPods)
        expect(await this.field.totalHarvestable()).to.eq(this.testData.totalHarvestablePods)
        expect(await this.field.totalSoil()).to.eq(this.testData.soil)
        expect(await this.field.totalUnripenedPods()).to.eq(this.testData.totalUnripenedPods)
        expect(await this.field.podIndex()).to.eq(this.testData.podIndex)
        expect(await this.field.harvestableIndex()).to.eq(this.testData.podHarvestableIndex)
      })

      after(async function () {
        await revertToSnapshot(snapshotId);
      })
    })
  })

  describe("complex DPD", async function () {
    before(async function () {
      await this.bean.connect(user).approve(this.field.address, MAX_UINT256)
      await this.bean.mint(userAddress, toBean('100000'))
    })
    beforeEach(async function () {
      await this.season.resetAccount(userAddress)
      await this.season.resetState()
    })

    it("Does not set nextSowTime if Soil > 1", async function () {
      this.season.setSoilE(toBean('3'));
      await this.field.connect(user).sowBeans(toBean('1'))
      const weather = await this.season.weather()
      expect(weather.nextSowTime).to.be.equal(parseInt(MAX_UINT32))
    })

    it("Does set nextSowTime if Soil = 1", async function () {
      this.season.setSoilE(toBean('1'));
      await this.field.connect(user).sowBeans(toBean('1'))
      const weather = await this.season.weather()
      expect(weather.nextSowTime).to.be.not.equal(parseInt(MAX_UINT32))
    })

    it("Does set nextSowTime if Soil < 1", async function () {
      this.season.setSoilE(toBean('1.5'));
      await this.field.connect(user).sowBeans(toBean('1'))
      const weather = await this.season.weather()
      expect(weather.nextSowTime).to.be.not.equal(parseInt(MAX_UINT32))
    })

    it("Does not set nextSowTime if Soil already < 1", async function () {
      this.season.setSoilE(toBean('1.5'));
      await this.field.connect(user).sowBeans(toBean('1'))
      const weather = await this.season.weather()
      await this.field.connect(user).sowBeans(toBean('0.5'))
      const weather2 = await this.season.weather()
      expect(weather2.nextSowTime).to.be.equal(weather.nextSowTime)
    })
  })
})
