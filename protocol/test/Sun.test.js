const { BN } = require('@openzeppelin/test-helpers')
const { expect } = require('chai')
const { deploy } = require('../scripts/deploy.js')
const { parseJson } = require('./utils/helpers.js')
const { MAX_UINT256 } = require('./utils/constants.js')

// Set the test data
const [columns, tests] = parseJson('./coverage_data/sun.json')
var numberTests = tests.length
var startTest = 0

describe('Sun', function () {

  before(async function () {
    [owner,user,user2] = await ethers.getSigners()
    userAddress = user.address
    user2Address = user2.address
    const contracts = await deploy("Test", false, true)
    ownerAddress = contracts.account
    this.diamond = contracts.beanstalkDiamond
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('MockToken', contracts.bean)
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair)
    this.pegPair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pegPair)
  });

  [...Array(numberTests).keys()].map(i => i + startTest).forEach(function(v) {
    const testStr = 'Test #'
    describe(testStr.concat((v)), function () {
      testData = {}
      columns.forEach((key, i) => testData[key] = tests[v][i])
      console.log(testData);
      before(async function () {
        await this.season.resetState()
        await this.pair.burnBeans(this.bean.address)
        this.testData = {}
        columns.forEach((key, i) => this.testData[key] = tests[v][i])
        for (var i = 0; i < this.testData.season-1; i++) {
          await this.season.lightSunrise()
        }

        await this.bean.mint(this.silo.address, this.testData.beansInSilo)
        await this.bean.mint(this.pair.address, this.testData.beansInPool)
        await this.silo.incrementDepositedBeansE(this.testData.beansInSilo)
        await this.season.incrementTotalSoilE(this.testData.soil)
        await this.silo.depositSiloAssetsE(userAddress, '1', '100000')
        await this.field.incrementTotalPodsE((parseInt(this.testData.unripenedPods) + parseInt(this.testData.harvestablePods)).toString())
        await this.field.incrementTotalHarvestableE(this.testData.harvestablePods)
        this.pair.simulateTrade(this.testData.beansInPool, this.testData.ethInPool+'000000000000')
        this.result = await this.season.sunSunrise(this.testData.twapBeans, this.testData.twapUSDC, this.testData.divisor)
      })
      it('checks values', async function () {
        expect(await this.bean.totalSupply()).to.eq(this.testData.newTotalSupply)
        expect(await this.bean.balanceOf(this.silo.address)).to.eq((parseInt(this.testData.newBeansInSilo)+parseInt(this.testData.newHarvestablePods)).toString())
        expect(await this.silo.totalDepositedBeans()).to.eq(this.testData.newBeansInSilo)
        expect(await this.field.totalSoil()).to.eq(this.testData.newSupplyofSoil)
        expect(await this.field.totalHarvestable()).to.eq(this.testData.newHarvestablePods)
        expect(await this.field.totalUnripenedPods()).to.eq(this.testData.newUnripenedPods)
        expect(await this.field.totalPods()).to.eq(this.testData.newTotalPods)
      })

      it('emits the correct event', async function () {
        if (new BN(this.testData.currentTWAP).gt(new BN('1000000000000000000'))) {
          await expect(this.result).to.emit(this.season, 'SupplyIncrease').withArgs(
             (parseInt(this.testData.currentSeason)+1).toString(),
             this.testData.currentTWAP,
             this.testData.deltaHarvestablePods,
             this.testData.deltaBeansInSilo,
             this.testData.deltaSoil)
       }
       else if (new BN(this.testData.currentTWAP).eq(new BN('1000000000000000000'))) {
          await expect(this.result).to.emit(this.season, 'SupplyNeutral').withArgs(
             (parseInt(this.testData.currentSeason)+1).toString(),
             this.testData.deltaSoil)
        } else {
          await expect(this.result).to.emit(this.season, 'SupplyDecrease').withArgs(
             (parseInt(this.testData.currentSeason)+1).toString(),
             this.testData.currentTWAP,
             this.testData.deltaSoil)
        }
      })
    })
  })
})


describe('Sun Soil', function () {

  before(async function () {
    [owner,user,user2] = await ethers.getSigners()
    userAddress = user.address
    user2Address = user2.address
    const contracts = await deploy("Test", false, true)
    ownerAddress = contracts.account
    this.diamond = contracts.beanstalkDiamond
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('MockToken', contracts.bean)
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair)
    this.pegPair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pegPair)
    await this.bean.mint(this.silo.address, '100000')
    await this.season.setYieldE('100')
  });

  this.beforeEach(async function () {
    await this.season.decrementTotalSoilE(await this.field.totalSoil())
  })

  it("Properly sets the soil bounds", async function () {
    expect(await this.season.minSoil('100')).to.be.equal('50')
    expect(await this.season.maxSoil()).to.be.equal('25000')
  });

  // Increase Soil

  describe("Increase above max Soil", async function () {
    beforeEach(async function () {
      await this.season.increaseSoilE('100000')
    });

    it("Properly sets the soil", async function () {
      expect(await this.field.totalSoil()).to.be.equal('25000')
    });
  });

  describe("Increase when already above above max Soil", async function () {
    beforeEach(async function () {
      await this.season.incrementTotalSoilE('100000')
      await this.season.increaseSoilE('100000')
    });

    it("Properly sets the soil", async function () {
      expect(await this.field.totalSoil()).to.be.equal('25000')
    });
  });

  describe("Increase little Soil", async function () {
    beforeEach(async function () {
      await this.season.increaseSoilE('1')
    });

    it("Properly sets the soil", async function () {
      expect(await this.field.totalSoil()).to.be.equal('1')
    });
  });

  describe("Increase to normal Soil", async function () {
    beforeEach(async function () {
      await this.season.increaseSoilE('100')
    });

    it("Properly sets the soil", async function () {
      expect(await this.field.totalSoil()).to.be.equal('100')
    });
  });

  // Decrease Soil

  describe("Decrease above max Soil", async function () {
    beforeEach(async function () {
      await this.season.incrementTotalSoilE('100000')
      await this.season.decreaseSoilE('1', '100')
    });

    it("Properly sets the max soil", async function () {
      expect(await this.field.totalSoil()).to.be.equal('25000')
    });
  });

  describe("Decrease already below min Soil", async function () {
    beforeEach(async function () {
      await this.season.incrementTotalSoilE('2')
      await this.season.decreaseSoilE('1', '100')
    });

    it("Properly sets the soil", async function () {
      expect(await this.field.totalSoil()).to.be.equal('50')
    });
  });

  describe("Decrease below min Soil", async function () {
    beforeEach(async function () {
      await this.season.incrementTotalSoilE('110')
      await this.season.decreaseSoilE('100', '100')
    });

    it("Properly sets the soil", async function () {
      expect(await this.field.totalSoil()).to.be.equal('50')
    });
  });

  describe("Decrease to normal Soil", async function () {
    beforeEach(async function () {
      await this.season.incrementTotalSoilE('110')
      await this.season.decreaseSoilE('10', '100')
    });

    it("Properly sets the soil", async function () {
      expect(await this.field.totalSoil()).to.be.equal('100')
    });
  });

  describe("Decrease below 0 Soil", async function () {
    beforeEach(async function () {
      await this.season.incrementTotalSoilE('100')
      await this.season.decreaseSoilE('110', '10')
    });

    it("Properly sets the soil", async function () {
      expect(await this.field.totalSoil()).to.be.equal('5')
    });
  });

  describe("Decrease to 0 Soil", async function () {
    beforeEach(async function () {
      await this.season.incrementTotalSoilE('100')
      await this.season.decreaseSoilE('110', '0')
    });

    it("Properly sets the soil", async function () {
      expect(await this.field.totalSoil()).to.be.equal('0')
    });
  });

  // Ensure soil bounds

  // Decrease Soil

  describe("When above max soil", async function () {
    beforeEach(async function () {
      await this.season.incrementTotalSoilE('100000')
      await this.season.ensureSoilBoundsE()
    });

    it("Properly sets the max soil", async function () {
      expect(await this.field.totalSoil()).to.be.equal('25000')
    });
  });

  describe("When normal soil", async function () {
    beforeEach(async function () {
      await this.season.incrementTotalSoilE('2')
      await this.season.ensureSoilBoundsE()
    });

    it("Properly sets the soil", async function () {
      expect(await this.field.totalSoil()).to.be.equal('2')
    });
  });
});
