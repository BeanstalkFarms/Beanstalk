const { expect } = require('chai')
const { deploy } = require('../scripts/deploy.js')
const { parseJson, to6, to18 } = require('./utils/helpers.js')
const { MAX_UINT32, UNRIPE_BEAN, UNRIPE_LP, BEAN_3_CURVE, BEAN_ETH_WELL} = require('./utils/constants.js')
const { getAltBeanstalk, getBean } = require('../utils/contracts.js');
const { BEAN } = require('./utils/constants')
const { deployMockWell } = require('../utils/well.js');
const { advanceTime } = require('../utils/helpers.js');
const ZERO_BYTES = ethers.utils.formatBytes32String('0x0')

// // Set the test data
const [columns, tests] = parseJson('./coverage_data/weather.json')
var numberTests = tests.length
var startTest = 0

async function setToSecondsAfterHour(seconds = 0) {
    const lastTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const hourTimestamp = parseInt(lastTimestamp/3600 + 1) * 3600 + seconds
    await network.provider.send("evm_setNextBlockTimestamp", [hourTimestamp])
}

describe('Complex Weather', function () {

  before(async function () {
    [owner,user,user2] = await ethers.getSigners()
    userAddress = user.address
    user2Address = user2.address
    const contracts = await deploy("Test", false, true)
    ownerAddress = contracts.account
    this.diamond = contracts.beanstalkDiamond
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.seasonGetter = await ethers.getContractAt('SeasonGetterFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('MockToken', BEAN)
    beanstalk = await getAltBeanstalk(contracts.beanstalkDiamond.address);

    // add unripe
    this.fertilizer = await ethers.getContractAt('MockFertilizerFacet', this.diamond.address)
    this.unripe = await ethers.getContractAt('MockUnripeFacet', this.diamond.address)
    this.unripeBean = await ethers.getContractAt('MockToken', UNRIPE_BEAN)
    this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP)
    await this.unripeLP.mint(user.address, to6('1000'))
    await this.unripeLP.connect(user).approve(this.diamond.address, to6('100000000'))
    await this.unripeBean.mint(user.address, to6('1000'))
    await this.unripeBean.connect(user).approve(this.diamond.address, to6('100000000'))
    await this.fertilizer.setFertilizerE(true, to6('10000'))
    await this.unripe.addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES);
    await this.unripe.addUnripeToken(UNRIPE_LP, BEAN_ETH_WELL, ZERO_BYTES);

    // wells
    [this.well, this.wellFunction, this.pump] = await deployMockWell()
    await this.well.setReserves([to6('1000000'), to18('1000')])
    await advanceTime(3600)
    await owner.sendTransaction({to: user.address, value: 0});
    await setToSecondsAfterHour(0)
    await owner.sendTransaction({to: user.address, value: 0});
    await this.well.connect(user).mint(user.address, to18('1000'))
    await beanstalk.connect(user).sunrise();

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
        await this.season.setNextSowTimeE(this.testData.thisSowTime)
        this.result = await this.season.calcCaseIdWithParams(this.pods, this.dsoil,this.startSoil-this.endSoil, this.endSoil, this.price, this.testData.wasRaining, this.testData.rainStalk)
      })
      it('Checks New Weather', async function () {
        expect(await this.season.getT()).to.eq(this.testData.newWeather)
      })
      it('Emits The Correct Case Weather', async function () {
        if (this.testData.totalOutstandingBeans !== 0) await expect(this.result).to.emit(this.season, 'TemperatureChange')
          .withArgs(
            await this.seasonGetter.season(), 
            this.testData.Code, 
            10000, 
            this.testData.newWeather-this.testData.startingWeather
            )
      })
    })
  })

  describe("Extreme Weather", async function () {
    before(async function () {
      await this.season.setLastDSoilE('100000');
      await this.bean.mint(userAddress, '1000000000')
      await this.field.incrementTotalPodsE('100000000000');
    })

    beforeEach(async function () {
      await this.season.setYieldE('10');
    })

    it("thisSowTime immediately", async function () {
        await this.season.setLastSowTimeE('1')
        await this.season.setNextSowTimeE('10')
      await this.season.calcCaseIdE(ethers.utils.parseEther('1'), '1');
        const weather = await this.seasonGetter.weather();
        expect(weather.t).to.equal(7)
        expect(weather.thisSowTime).to.equal(parseInt(MAX_UINT32))
        expect(weather.lastSowTime).to.equal(10)
    })

    it("lastSowTime max", async function () {
      await this.season.setLastSowTimeE(MAX_UINT32)
      await this.season.setNextSowTimeE('1000')
      await this.season.calcCaseIdE(ethers.utils.parseEther('1'), '1');
      const weather = await this.seasonGetter.weather();
      expect(weather.t).to.equal(7)
      expect(weather.thisSowTime).to.equal(parseInt(MAX_UINT32))
      expect(weather.lastSowTime).to.equal(1000)
    })

    it("lastSowTime max", async function () {
      await this.season.setLastSowTimeE('1061')
      await this.season.setNextSowTimeE('1000')
      await this.season.calcCaseIdE(ethers.utils.parseEther('1'), '1');
      const weather = await this.seasonGetter.weather();
      expect(weather.t).to.equal(7)
      expect(weather.thisSowTime).to.equal(parseInt(MAX_UINT32))
      expect(weather.lastSowTime).to.equal(1000)
    })

    it("lastSowTime max", async function () {
      await this.season.setLastSowTimeE('1060')
      await this.season.setNextSowTimeE('1000')
      await this.season.calcCaseIdE(ethers.utils.parseEther('1'), '1');
      const weather = await this.seasonGetter.weather();
      expect(weather.t).to.equal(9)
      expect(weather.thisSowTime).to.equal(parseInt(MAX_UINT32))
      expect(weather.lastSowTime).to.equal(1000)
    })

    it("lastSowTime max", async function () {
      await this.season.setLastSowTimeE('940')
      await this.season.setNextSowTimeE('1000')
      await this.season.calcCaseIdE(ethers.utils.parseEther('1'), '1');
      const weather = await this.seasonGetter.weather();
      expect(weather.t).to.equal(9)
      expect(weather.thisSowTime).to.equal(parseInt(MAX_UINT32))
      expect(weather.lastSowTime).to.equal(1000)
    })

    it("lastSowTime max", async function () {
      await this.season.setLastSowTimeE('900')
      await this.season.setNextSowTimeE('1000')
      await this.season.calcCaseIdE(ethers.utils.parseEther('1'), '1');
      const weather = await this.seasonGetter.weather();
      expect(weather.t).to.equal(10)
      expect(weather.thisSowTime).to.equal(parseInt(MAX_UINT32))
      expect(weather.lastSowTime).to.equal(1000)
    })

    it("lastSowTime max", async function () {
      await this.season.setLastSowTimeE('900')
      await this.season.setNextSowTimeE(MAX_UINT32)
      await this.season.calcCaseIdE(ethers.utils.parseEther('1'), '1');
      const weather = await this.seasonGetter.weather();
      expect(weather.t).to.equal(9)
      expect(weather.thisSowTime).to.equal(parseInt(MAX_UINT32))
      expect(weather.lastSowTime).to.equal(parseInt(MAX_UINT32))
    })
  })
})
