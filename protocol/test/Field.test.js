require('hardhat')
const { expectRevert } = require('@openzeppelin/test-helpers')
const { expect } = require('chai')
const { deploy } = require('../scripts/deploy.js')
const { parseJson, incrementTime } = require('./utils/helpers.js')
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

async function getEthSpentOnGas(result) {
  const receipt = await result.wait()
  return receipt.effectiveGasPrice.mul(receipt.cumulativeGasUsed);
}

const toBean = (amount) => ethers.utils.parseUnits(amount, 6);
const to18 = (amount) => ethers.utils.parseEther(amount);

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

      it('outputs the correct extreme weather', async function () {
        const weather = await this.season.weather()
        expect(weather.didSowBelowMin).to.eq(this.testData.didSowBelowMin)
        expect(weather.lastSowTime).to.eq(parseInt(this.testData.lastSowTime))
        expect(weather.didSowFaster).to.eq(this.testData.didSowFaster)
      })

      it('outputs the correct state', async function () {
        const weather = await this.season.weather()
        if (weather.lastSowTime == MAX_UINT32 || !weather.didSowBelowMin) {
          expect('1').to.eq(this.testData.state)
        } else if (weather.didSowFaster) {
          expect('2').to.eq(this.testData.state)
        } else {
          expect('0').to.eq(this.testData.state)
        }
      })
    })
  })

  describe("Buy and sow", async function () {
    beforeEach(async function () {
      await this.season.resetAccount(userAddress)
      await this.season.resetState()
      await this.bean.connect(user).burn(await this.bean.balanceOf(userAddress))
      await this.bean.connect(user).approve(this.field.address, to18('1000000000000'))
      await this.bean.mint(userAddress, toBean('100000'))
      await this.season.setYieldE('1')
    })

    describe("Half buy, half Beans", async function () {
      beforeEach(async function () {
        const beforeBeans = await this.bean.balanceOf(userAddress);
        const beforeEth = await ethers.provider.getBalance(userAddress);
        await this.pair.simulateTrade(toBean('5000'), to18('1'));
        this.field.incrementTotalSoilE(toBean('5000'));
        this.result = await this.field.connect(user).buyAndSowBeans(toBean('2500'), toBean('2500'), {value: to18('1') })
        const ethSpentOnGas = await getEthSpentOnGas(this.result);
        this.deltaBeans = beforeBeans.sub(await this.bean.balanceOf(userAddress));
        this.deltaEth = beforeEth.sub(await ethers.provider.getBalance(userAddress)).sub(ethSpentOnGas);
      })

      it("updates user balances", async function () {
        expect(this.deltaBeans).to.equal(toBean('2500'))
        expect(this.deltaEth).to.equal(to18('1'))
        expect(await this.field.plot(userAddress, '0')).to.eq(toBean('5050'))
      })

      it('updates total balance', async function() {
        expect(await this.field.totalPods()).to.eq(toBean('5050'))
        expect(await this.field.totalSoil()).to.eq('0')
      })
    })
  })
})
