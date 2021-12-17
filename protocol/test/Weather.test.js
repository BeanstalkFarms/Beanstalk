const { BN } = require('@openzeppelin/test-helpers')
const { expect } = require('chai')
const { deploy } = require('../scripts/deploy.js')
const { parseJson } = require('./utils/helpers.js')
const { MAX_UINT256 } = require('./utils/constants.js')

const SLOW_TIME = (new BN(4).mul(new BN(10).pow(new BN(9)))).toString()

// Set the test data
const [columns, tests] = parseJson('./coverage_data/weather.json')
var numberTests = tests.length
var startTest = 0

describe('Complex Weather', function () {

  before(async function () {
    [owner,user,user2] = await ethers.getSigners()
    userAddress = user.address
    user2Address = user2.address
    const contracts = await deploy("Test", false, true)
    ownerAddress = contracts.account
    this.diamond = contracts.beanstalkDiamond
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('MockToken', contracts.bean)

  });

  [...Array(numberTests).keys()].map(i => i + startTest).forEach(function(v) {
    const testStr = 'Test #'
    describe(testStr.concat((v)), function () {
      before (async function () {
        this.testData = {}
        columns.forEach((key, i) => this.testData[key] = tests[v][i])
        await this.season.setYieldE(this.testData.startingWeather)
        this.bean.connect(user).burn(await this.bean.balanceOf(userAddress))
        this.dsoil = this.testData.lastSoil
        this.startSoil = this.testData.startingSoil
        this.endSoil = this.testData.endingSoil
        this.price = this.testData.priceAvg
        this.pods = this.testData.unharvestablePods
        await this.bean.mint(userAddress, this.testData.totalOutstandingBeans)
        await this.season.setLastSowTimeE(this.testData.lastSowTime)
        await this.season.setDidSowFasterE(this.testData.didSowFaster)
        await this.season.setDidSowBelowMinE(this.testData.didSowBelowMin)
        this.result = await this.season.stepWeatherWithParams(this.pods, this.dsoil, this.startSoil, this.endSoil, this.price, this.testData.wasRaining, this.testData.rainStalk)
      })
      it('Checks New Weather', async function () {
        expect(await this.season.yield()).to.eq(this.testData.newWeather)
      })
      it('Emits The Correct Case Weather', async function () {
        if (this.testData.totalOutstandingBeans !== 0) await expect(this.result).to.emit(this.season, 'WeatherChange').withArgs(await this.season.season(), this.testData.Code, this.testData.newWeather-this.testData.startingWeather)
      })
    })
  })
})
