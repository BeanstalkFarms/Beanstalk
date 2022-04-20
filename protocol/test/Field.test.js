require('hardhat')
const { expectRevert } = require('@openzeppelin/test-helpers')
const { expect } = require('chai')
const { deploy } = require('../scripts/deploy.js')
const { parseJson, getEthSpentOnGas, toBean, toEther } = require('./utils/helpers.js')
const { MAX_UINT32, MAX_UINT256 } = require('./utils/constants.js')

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
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('MockToken', contracts.bean)
    this.claim = await ethers.getContractAt('ClaimFacet', this.diamond.address)
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair)
    this.pegPair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pegPair)
  });

  [...Array(numberTests).keys()].map(i => i + startTest).forEach(function(v) {
    const testStr = 'Test #'
    describe(testStr.concat((v)), function () {
      testData = {}
      columns.forEach((key, i) => testData[key] = tests[v][i])
      before(async function () {
        await this.season.resetState()
        await this.season.resetAccount(userAddress)
        await this.season.resetAccount(user2Address)
        await this.season.resetAccount(otherAddress)
        await this.season.resetState()
        await this.field.resetAllowances([userAddress, user2Address, otherAddress, ownerAddress])
        await this.pair.burnTokens(this.bean.address)
        await this.bean.connect(user).burn(await this.bean.balanceOf(userAddress))
        await this.bean.connect(user2).burn(await this.bean.balanceOf(user2Address))
        await this.bean.connect(other).burn(await this.bean.balanceOf(otherAddress))
        this.testData = {}
        columns.forEach((key, i) => this.testData[key] = tests[v][i])
        for (c in columns) {
          if (typeof this.testData[columns[c]] == 'number') {
             this.testData[columns[c]] = this.testData[columns[c]].toString()
          }
        }
        await this.season.setYieldE(this.testData.weather)

        await this.bean.mint(userAddress, this.testData.userStarterBeans)
        await this.bean.connect(user).approve(this.field.address, MAX_UINT256)
        await this.bean.mint(user2Address, this.testData.user2StarterBeans)
        await this.bean.connect(user2).approve(this.field.address, MAX_UINT256)
        await this.bean.mint(otherAddress, this.testData.otherStarterBeans)
        await this.bean.connect(other).approve(this.field.address, MAX_UINT256)
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
    })
  })

  describe("Buy and Sow", async function () {
    before(async function () {
      await this.bean.connect(user).approve(this.field.address, MAX_UINT256)
      await this.pair.simulateTrade(toBean('1000'), toEther('1'));
      await this.bean.mint(userAddress, toBean('10000000'))
    })
    beforeEach(async function () {
      await this.season.resetState()
    })

    describe("revert", async function () {
      it("no Soil", async function () {
        await expect(this.field.connect(user).buyAndSowBeansWithMin('1','1','1', {value: toEther('0.001')})).to.be.revertedWith("Field: Sowing below min or 0 pods.")
      })
    })

    describe("Only transfer", async function () {
      beforeEach(async function () {
        await this.season.setSoilE(toBean('1'));
        this.beforeBeans = await this.bean.balanceOf(userAddress)
        this.beforeEth = await ethers.provider.getBalance(userAddress)
        this.result = await this.field.connect(user).buyAndSowBeansWithMin(toBean('1'), toBean('1'), toBean('1'), {value: toEther('0.001')});
        this.ethSpentOnGas = await getEthSpentOnGas(this.result)
      })

      it("Properly transfers assets", async function () {
        expect(this.beforeBeans.sub(await this.bean.balanceOf(userAddress))).to.equal(toBean('1'))
        expect(this.beforeEth.sub(await ethers.provider.getBalance(userAddress)).sub(this.ethSpentOnGas)).to.equal('0')

        expect(await this.bean.balanceOf(this.field.address)).to.equal('0')
        expect(await ethers.provider.getBalance(this.field.address)).to.equal('0')
      })

      it("Properly sows", async function () {
        expect(await this.field.totalSoil()).to.equal('0')
      })
    })

    describe("full Buy and Sow", async function () {
      beforeEach(async function () {
        await this.season.setSoilE(toBean('3'));
        
        this.beforeBeans = await this.bean.balanceOf(userAddress)
        this.beforeEth = await ethers.provider.getBalance(userAddress)
        this.result = await this.field.connect(user).buyAndSowBeansWithMin(toBean('1'), toBean('1'), toBean('1'), {value: toEther('0.001002')});
        this.ethSpentOnGas = await getEthSpentOnGas(this.result)
      })

      it("Properly transfers assets", async function () {
        expect(this.beforeBeans.sub(await this.bean.balanceOf(userAddress))).to.equal(toBean('1'))
        expect(this.beforeEth.sub(await ethers.provider.getBalance(userAddress)).sub(this.ethSpentOnGas)).to.equal('1001001001001002')

        expect(await this.bean.balanceOf(this.field.address)).to.equal('0')
        expect(await ethers.provider.getBalance(this.field.address)).to.equal('0')
      })

      it("Properly sows", async function () {
        expect(await this.field.totalSoil()).to.equal(toBean('1'))
      })
    })

    describe("full Buy and Sow all Soil", async function () {
      beforeEach(async function () {
        await this.season.setSoilE(toBean('2'));
        
        this.beforeBeans = await this.bean.balanceOf(userAddress)
        this.beforeEth = await ethers.provider.getBalance(userAddress)
        this.result = await this.field.connect(user).buyAndSowBeansWithMin(toBean('1'), toBean('1'), toBean('1'), {value: toEther('0.001002')});
        this.ethSpentOnGas = await getEthSpentOnGas(this.result)
      })

      it("Properly transfers assets", async function () {
        expect(this.beforeBeans.sub(await this.bean.balanceOf(userAddress))).to.equal(toBean('1'))
        expect(this.beforeEth.sub(await ethers.provider.getBalance(userAddress)).sub(this.ethSpentOnGas)).to.equal('1001001001001002')

        expect(await this.bean.balanceOf(this.field.address)).to.equal('0')
        expect(await ethers.provider.getBalance(this.field.address)).to.equal('0')
      })

      it("Properly sows", async function () {
        expect(await this.field.totalSoil()).to.equal('0')
      })
    })

    describe("full transfer and partial Sow all Soil", async function () {
      it ('reverts with min', async function () {
        await this.season.setSoilE(toBean('1.5'));
        await expect(this.field.connect(user).buyAndSowBeans(toBean('1'), toBean('1'), {value: toEther('0.001002')})).to.be.revertedWith("Field: Sowing below min or 0 pods.");
      });

      beforeEach(async function () {
        await this.season.setSoilE(toBean('1.5'));
        
        this.beforeBeans = await this.bean.balanceOf(userAddress)
        this.beforeEth = await ethers.provider.getBalance(userAddress)
        this.result = await this.field.connect(user).buyAndSowBeansWithMin(toBean('1'), toBean('1'), toBean('1.5'), {value: toEther('0.001002')});
        this.ethSpentOnGas = await getEthSpentOnGas(this.result)
      })

      it("Properly transfers assets", async function () {
        expect(this.beforeBeans.sub(await this.bean.balanceOf(userAddress))).to.equal(toBean('1'))
        expect(this.beforeEth.sub(await ethers.provider.getBalance(userAddress)).sub(this.ethSpentOnGas)).to.equal('500250125062532')

        expect(await this.bean.balanceOf(this.field.address)).to.equal('0')
        expect(await ethers.provider.getBalance(this.field.address)).to.equal('0')
      })

      it("Properly sows", async function () {
        expect(await this.field.totalSoil()).to.equal('0')
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

  describe("Buy and sow", async function () {
    beforeEach(async function () {
      await this.season.resetAccount(userAddress)
      await this.season.resetState()
      await this.bean.connect(user).burn(await this.bean.balanceOf(userAddress))
      await this.bean.connect(user).approve(this.field.address, toEther('1000000000000'))
      await this.bean.mint(userAddress, toBean('100000'))
      await this.season.setYieldE('1')
    })

    describe("Half buy, half Beans", async function () {
      beforeEach(async function () {
        const beforeBeans = await this.bean.balanceOf(userAddress);
        const beforeEth = await ethers.provider.getBalance(userAddress);
        await this.pair.simulateTrade(toBean('5000'), toEther('1'));
        this.field.incrementTotalSoilE(toBean('5000'));
        this.result = await this.field.connect(user).buyAndSowBeans(toBean('2500'), toBean('2500'), {value: toEther('1.000000000001') })
        const ethSpentOnGas = await getEthSpentOnGas(this.result);
        this.deltaBeans = beforeBeans.sub(await this.bean.balanceOf(userAddress));
        this.deltaEth = beforeEth.sub(await ethers.provider.getBalance(userAddress)).sub(ethSpentOnGas);
      })

      it("updates user balances", async function () {
        expect(this.deltaBeans).to.equal(toBean('2500'))
        expect(this.deltaEth).to.equal(toEther('1.000000000000000001'))
        expect(await this.field.plot(userAddress, '0')).to.eq(toBean('5050'))
      })

      it('updates total balance', async function() {
        expect(await this.field.totalPods()).to.eq(toBean('5050'))
        expect(await this.field.totalSoil()).to.eq('0')
      })
    })
  })
})
