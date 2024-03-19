const { expect } = require('chai')
const { deploy } = require('../scripts/deploy.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot")
const { to6, toStalk, toBean, to18 } = require('./utils/helpers.js')
const { USDC, UNRIPE_BEAN, UNRIPE_LP, BEAN, THREE_CURVE, THREE_POOL, BEAN_3_CURVE, BEAN_ETH_WELL, BEANSTALK_PUMP, STABLE_FACTORY, ETH_USDT_UNISWAP_V3 } = require('./utils/constants.js')
const { EXTERNAL, INTERNAL } = require('./utils/balances.js')
const { ethers } = require('hardhat')
const { advanceTime } = require('../utils/helpers.js')
const { deployMockWell, whitelistWell, deployMockWellWithMockPump } = require('../utils/well.js')
const { initalizeGaugeForToken } = require('../utils/gauge.js')
const { setEthUsdPrice, setEthUsdcPrice, setEthUsdtPrice } = require('../scripts/usdOracle.js')
const { time, mineUpTo, mine } = require("@nomicfoundation/hardhat-network-helpers")
const ZERO_BYTES = ethers.utils.formatBytes32String('0x0')
const { setOracleFailure } = require('../utils/oracle.js')


let user, user2, owner
let userAddress, ownerAddress, user2Address

async function setToSecondsAfterHour(seconds = 0) {
  const lastTimestamp = (await ethers.provider.getBlock('latest')).timestamp
  const hourTimestamp = parseInt(lastTimestamp/3600 + 1) * 3600 + seconds
  await network.provider.send("evm_setNextBlockTimestamp", [hourTimestamp])
}


describe('Gauge', function () {
  before(async function () {
    [owner, user] = await ethers.getSigners()
    userAddress = user.address
    const contracts = await deploy("Test", false, true)
    ownerAddress = contracts.account
    this.diamond = contracts.beanstalkDiamond
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address)
    this.siloGetters = await ethers.getContractAt('SiloGettersFacet', this.diamond.address)
    this.whitelist = await ethers.getContractAt('MockWhitelistFacet', this.diamond.address)
    this.gauge = await ethers.getContractAt('GaugePointFacet', this.diamond.address)
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.seasonGetters = await ethers.getContractAt('SeasonGettersFacet', this.diamond.address)
    this.unripe = await ethers.getContractAt('MockUnripeFacet', this.diamond.address)
    this.fertilizer = await ethers.getContractAt('MockFertilizerFacet', this.diamond.address)
    this.gaugePoint = await ethers.getContractAt('GaugePointFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('MockToken', BEAN)
    
    await this.bean.connect(owner).approve(this.diamond.address, to6('100000000'))
    await this.bean.connect(user).approve(this.diamond.address, to6('100000000'));
   
    // init wells
    [this.well, this.wellFunction, this.pump] = await deployMockWellWithMockPump()
    await this.well.connect(owner).approve(this.diamond.address, to18('100000000'))
    await this.well.connect(user).approve(this.diamond.address, to18('100000000'))

    await this.well.setReserves([to6('1000000'), to18('1000')])
    await this.pump.setCumulativeReserves([to6('1000000'), to18('1000')])
    await this.well.mint(ownerAddress, to18('500'))
    await this.well.mint(userAddress, to18('500'))
    await whitelistWell(this.well.address, '10000', to6('4'))
    await this.season.siloSunrise(0)
    await this.season.captureWellE(this.well.address)

    await setEthUsdPrice('999.998018')
    await setEthUsdcPrice('1000')
    await setEthUsdtPrice('1000')

    // add unripe
    this.unripeBean = await ethers.getContractAt('MockToken', UNRIPE_BEAN)
    this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP)
    await this.unripeLP.mint(ownerAddress, to18('10000'))
    await this.unripeBean.mint(ownerAddress, to6('10000'))
    await this.unripeLP.connect(owner).approve(this.diamond.address, to6('100000000'))
    await this.unripeBean.connect(owner).approve(this.diamond.address, to6('100000000'))
    await this.unripe.connect(owner).addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES)
    await this.unripe.connect(owner).addUnripeToken(UNRIPE_LP, BEAN_ETH_WELL, ZERO_BYTES)
    
    // dewhitelist curve, as initMockDiamond initalizes bean3crv.
    // dewhitelisted here rather than updating mock to avoid breaking other tests.
    await this.whitelist.connect(owner).dewhitelistToken(BEAN_3_CURVE)

    // initalize gauge parameters for lp:
    await initalizeGaugeForToken(BEAN_ETH_WELL, to18('1000'), to6('100'))

    await this.season.updateTWAPCurveE()
  })

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  })

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  })

  describe('Bean to maxLP ratio', function () {
    // MockInitDiamond initalizes BeanToMaxLpGpPerBDVRatio to 50% (50e6)

    describe('L2SR > excessively high L2SR % + P > 1', async function () {
      it("increases Bean to maxLP ratio", async function () {
        this.result = await this.season.seedGaugeSunSunrise('0', 108)

        expect(await this.seasonGetters.getBeanToMaxLpGpPerBdvRatio()).to.be.equal(to18('51'))
        await expect(this.result).to.emit(this.season, 'BeanToMaxLpGpPerBdvRatioChange')
          .withArgs(
            3,     // season
            108,    // caseId
            to18('1')    // absolute change (+1%)
          )
      })
    })

    describe('moderately high L2SR % < L2SR < excessively high L2SR % + P < 1', async function () {
      it("decreases Bean to maxLP ratio", async function () {
        this.result = await this.season.seedGaugeSunSunrise('0', 75)
        expect(await this.seasonGetters.getBeanToMaxLpGpPerBdvRatio()).to.be.equal(to18('49'))
        await expect(this.result).to.emit(this.season, 'BeanToMaxLpGpPerBdvRatioChange')
          .withArgs(
            3, // season
            75, // caseId
            to18('-1') // absolute change (-1%)
          )
      })
    })

    describe('moderately low L2SR % < L2SR < moderately high L2SR %, excessively low podRate', async function () {
      it("increases Bean to maxLP ratio", async function () {
        this.result = await this.season.seedGaugeSunSunrise('0', 36)

        expect(await this.seasonGetters.getBeanToMaxLpGpPerBdvRatio()).to.be.equal(to18('0'))
        await expect(this.result).to.emit(this.season, 'BeanToMaxLpGpPerBdvRatioChange')
          .withArgs(
            3, // season
            36, // caseId
            to18('-50') // absolute change (-50%)
          )
      })
    })

    describe('L2SR < moderately low L2SR %', async function () {
      it("massively decreases Bean to maxLP ratio", async function () {
        await this.season.setBeanToMaxLpGpPerBdvRatio(to18('51'))

        this.result = await this.season.seedGaugeSunSunrise('0', 0)
        expect(await this.seasonGetters.getBeanToMaxLpGpPerBdvRatio()).to.be.equal(to18('1'))
        await expect(this.result).to.emit(this.season, 'BeanToMaxLpGpPerBdvRatioChange')
          .withArgs(
            3, // season
            0, // caseId
            to18('-50') // absolute change (-50%)
          )
      })
    })

    it("Bean to maxLP ratio cannot go under 0%", async function () {
      await this.season.setBeanToMaxLpGpPerBdvRatio(to18('0.5'))
      this.result = await this.season.seedGaugeSunSunrise('0', 111)

      expect(await this.seasonGetters.getBeanToMaxLpGpPerBdvRatio()).to.be.equal('0')
      await expect(this.result).to.emit(this.season, 'BeanToMaxLpGpPerBdvRatioChange')
        .withArgs(
          3,     // season
          111,    // caseId
          to18('-0.5')    // absolute change (-0.5%)
        )
    })

    it("Bean to maxLP ratio can increase from 0%", async function () {
      await this.season.setBeanToMaxLpGpPerBdvRatio(to18('0'))
      this.result = await this.season.seedGaugeSunSunrise('0', 72)

      expect(await this.seasonGetters.getBeanToMaxLpGpPerBdvRatio()).to.be.equal(to18('1'))
      await expect(this.result).to.emit(this.season, 'BeanToMaxLpGpPerBdvRatioChange')
        .withArgs(
          3,     // season
          72,    // caseId
          to18('1')    // absolute change (+1%)
        )
    })

    it("Bean to maxLP ratio cannot go above 100%", async function () {
      await this.season.setBeanToMaxLpGpPerBdvRatio(to18('99.9'))
      this.result = await this.season.seedGaugeSunSunrise('0', 54)

      expect(await this.seasonGetters.getBeanToMaxLpGpPerBdvRatio()).to.be.equal(to18('100'))
      await expect(this.result).to.emit(this.season, 'BeanToMaxLpGpPerBdvRatioChange')
        .withArgs(
          3,     // season
          54,    // caseId
          to18('0.1')    // absolute change (+0.1%)
        )
    })

    it("Bean to maxLP ratio properly scales", async function () {
      await this.season.setBeanToMaxLpGpPerBdvRatio(to18('50'))

      // 0.50 * (1 - 0.5) + 0.5 = 0.75
      expect(await this.seasonGetters.getBeanToMaxLpGpPerBdvRatioScaled()).to.be.equal(to18('75'))

      await this.season.setBeanToMaxLpGpPerBdvRatio(to18('51'))

     // 0.51 * (1 - 0.5) + 0.5 = 75.5
      expect(await this.seasonGetters.getBeanToMaxLpGpPerBdvRatioScaled()).to.be.equal(to18('75.5'))
    })    

    it("Bean to maxLP ratio cannot decrease below min %", async function () {
      await this.season.setBeanToMaxLpGpPerBdvRatio(to18('0'))

      // 0 * (1 - 0.5) + 0.5 = .5
      expect(await this.seasonGetters.getBeanToMaxLpGpPerBdvRatioScaled()).to.be.equal(to18('50'))
    })

    it("Bean to maxLP ratio cannot exceed max %", async function () {
      await this.season.setBeanToMaxLpGpPerBdvRatio(to18('100'))

      // 100 * (1 - 0.5) + 0.5 = 1
      expect(await this.seasonGetters.getBeanToMaxLpGpPerBdvRatioScaled()).to.be.equal(to18('100'))
    })

  })

  describe('L2SR calculation', async function () {
    describe("getter", function () {
      
      it('outputs correct liquidity values:', async function (){
        expect(await this.seasonGetters.getTwaLiquidityForWell(BEAN_ETH_WELL)).to.be.equal(to18('1000000'))
        expect(await this.seasonGetters.getTotalUsdLiquidity()).to.be.equal(to18('1000000'))
        expect(await this.seasonGetters.getWeightedTwaLiquidityForWell(BEAN_ETH_WELL)).to.be.equal(to18('1000000'))
        expect(await this.seasonGetters.getTotalWeightedUsdLiquidity()).to.be.equal(to18('1000000'))
      })

      it('inital state', async function () {
        // bean:eth has a ratio of 1000:1 (1m beans paired against 1m usd of eth),
        // bean:3crv has a ratio of 1:1 (1m beans paired against 1m usd of 3crv)
        // total supply of bean is 2m, with 0 circulating.
        // total non-bean liquidity is 2m.
        await this.bean.mint(ownerAddress, to6('1000000'))
        
        expect(
          await this.seasonGetters.getLiquidityToSupplyRatio()
          ).to.be.equal(to18('1'))
      })

      it('liquidity Weighted', async function () {
        await this.bean.mint(ownerAddress, to6('1000000'))
        await this.silo.mockUpdateLiquidityWeight(
          BEAN_ETH_WELL, 
          this.silo.interface.getSighash('mockLiquidityWeight')
        )

        expect(await this.seasonGetters.getLiquidityToSupplyRatio()).to.be.equal(to18('0.5'))
      })

      it('returns 0 if no liquidity', async function () {
        await this.bean.mint(ownerAddress, to6('1000000'))
        await this.pump.setCumulativeReserves([to6('0'), to18('0')])

        expect(
          await this.seasonGetters.getLiquidityToSupplyRatio()
        ).to.be.equal(0)
      })

      it('returns 0 if no supply', async function () {
        this.beanSupply = await this.bean.totalSupply()
        this.result = await this.seasonGetters.getLiquidityToSupplyRatio()
        
        await expect(this.beanSupply).to.be.equal(0)
        await expect(this.result).to.be.equal(0)
      }) 

      it('decreases', async function () {
        await this.bean.mint(ownerAddress, to6('1000000'))
        initalL2SR = await this.seasonGetters.getLiquidityToSupplyRatio()
        
        await this.bean.mint(ownerAddress, to6('1000000'))
        newL2SR = await this.seasonGetters.getLiquidityToSupplyRatio()

        expect(initalL2SR).to.be.equal(to18('1'))
        expect(newL2SR).to.be.equal(to18('0.5'))
        expect(newL2SR).to.be.lt(initalL2SR)

      })

      it('increases', async function () {
        await this.bean.mint(ownerAddress, to6('1000000'))
        initalL2SR = await this.seasonGetters.getLiquidityToSupplyRatio()

        await this.bean.connect(owner).burn(to6('500000'))
        newL2SR = await this.seasonGetters.getLiquidityToSupplyRatio()

        expect(initalL2SR).to.be.equal(to18('1'))
        expect(newL2SR).to.be.equal(to18('2'))
        expect(newL2SR).to.be.gt(initalL2SR)
      })
    })

    // when beanstalk has outstanding fertilizer (aka unripe assets)
    // a portion of the supply is locked, due to the difference between
    // the underlying amount and redemption price. 
    // thus the supply can be reduced.
    describe('with unripe', function() {
      before(async function() {
        await this.bean.mint(ownerAddress, to6('1000000'))
        // enable fertilizer, 10000 sprouts unfertilized
        await this.fertilizer.setFertilizerE(true, to6('10000'))
        await this.unripe.connect(owner).addUnderlying(
          UNRIPE_BEAN,
          to6('1000')
        )

        await this.unripe.connect(owner).addUnderlying(
          UNRIPE_LP,
          to18('31.62277663')
        )

        // add 1000 LP to 10,000 unripe
        await this.fertilizer.connect(owner).setPenaltyParams(to6('100'), to6('1000'))
      })

      it('getters', async function () {
        // urBean supply * 10% recapitalization (underlyingBean/UrBean) * 10% (fertilizerIndex/totalFertilizer)
        // = 10000 urBEAN * 10% = 1000 BEAN * (100-10%) = 900 beans locked.
        // urBEANETH supply * 0.1% recapitalization (underlyingBEANETH/UrBEANETH) * 10% (fertilizerIndex/totalFertilizer)
        // urBEANETH supply * 0.1% recapitalization * (100-10%) = 0.9% BEANETHLP locked.
        // 1m beans underlay all beanETHLP tokens.
        // 1m * 0.9% = 900 beans locked.
        expect(await this.unripe.getLockedBeansUnderlyingUnripeBean()).to.be.eq(to6('436.332105'))
        expect(await this.unripe.getLockedBeansUnderlyingUnripeBeanEth()).to.be.eq(to6('436.332105'))
        expect(await this.unripe.getLockedBeans()).to.be.eq(to6('872.66421'))
        expect(
          await this.seasonGetters.getLiquidityToSupplyRatio()
          ).to.be.eq(to18('1.000873426417975035'))
      })

      it('is MEV resistant', async function () {
        expect(await this.unripe.getLockedBeansUnderlyingUnripeBeanEth()).to.be.eq(to6('436.332105'))

        await this.well.mint(ownerAddress, to18('1000'))
        
        expect(await this.unripe.getLockedBeansUnderlyingUnripeBeanEth()).to.be.eq(to6('436.332105'))
      })
    })
  })

  describe('GaugePoints', async function () {
    beforeEach(async function () {
      beanETHGaugePoints = await this.seasonGetters.getGaugePoints(BEAN_ETH_WELL)
      bean3crvGaugePoints = await this.seasonGetters.getGaugePoints(BEAN_3_CURVE)
      // deposit beanETH:
      await this.silo.connect(user).deposit(BEAN_ETH_WELL, to18('1'), EXTERNAL)
      await this.bean.mint(userAddress, to6('10000'))
      // deposit beans:
      await this.silo.connect(user).deposit(BEAN, to6('100'), EXTERNAL)

      // call sunrise twice as bdv is not updated until germination has finished.
      await this.season.siloSunrise(0)
      await this.season.siloSunrise(0)

      this.result = await this.season.mockStepGauge()
    })

    it('updates gauge points', async function () {
      expect(await this.seasonGetters.getGaugePoints(BEAN_ETH_WELL)).to.be.eq(to18('1000'))
    })

    it('update seeds values', async function () {
      // mockInitDiamond sets s.averageGrownStalkPerBdvPerSeason to 3e6 (avg 3 seeds per BDV),
      // and BeanToMaxLpGpPerBDVRatio to 50% (BeanToMaxLpGpPerBDVRatioScaled = 0.75)
      // total BDV of ~163.25 (100 + 63.245537)
      // 1 seed = 1/10000 stalk, so ~489.75/10000 stalk should be issued this season.
      // BEANETHGP = 1000, gpPerBDV = 1000/63.245537 = 15.811392
      // BEANgpPerBDV = 0.75 * 15.811392 = 11.858544
      // total GP = 1000 + (11.858544*100) = 2185.8544
      // stalkPerGp = 489_750_000 / 2185.8544 = ~224_054/1e10 stalk per GP
      // stalkPerGp * GpPerBDV = stalkIssuedPerBDV
      // stalkIssuedPerBeanBDV =  ~224_054 * 11.858544 = ~2_656_954
      // stalkIssuedPerBeanETH = ~224_054 * 15.811392 = ~3_542_605
      expect(await this.seasonGetters.getBeanEthGaugePointsPerBdv()).to.be.eq(to18('15.811392351684831136'))
      expect(await this.seasonGetters.getBeanGaugePointsPerBdv()).to.be.eq(to18('11.858544263763623352'))
      expect(await this.seasonGetters.getGrownStalkIssuedPerSeason()).to.be.eq(to6('489.736611'))
      expect(await this.seasonGetters.getGrownStalkIssuedPerGp()).to.be.eq(('224048'))
      expect((await this.siloGetters.tokenSettings(BEAN))[1]).to.be.eq(2656883) // 2.65 seeds per BDV
      expect((await this.siloGetters.tokenSettings(BEAN_ETH_WELL))[1]).to.be.eq(3542510) // 3.54 seeds per BDV
      expect((await this.siloGetters.tokenSettings(BEAN_3_CURVE))[1]).to.be.eq(1) // 1 seeds
    })
    
    it('Cannot exceed the maximum gauge points', async function () {
      expect(await this.gaugePoint.defaultGaugePointFunction(
        to18('1000'),
        50e6,
        49e6
      )).to.be.eq(to18('1000'))

      expect(await this.gaugePoint.defaultGaugePointFunction(
        to18('1001'),
        50e6,
        49e6
      )).to.be.eq(to18('1000'))
    })
  })

  describe('averageGrownStalkPerBdvPerSeason', async function () {
    before(async function() {
      await this.season.mockSetAverageGrownStalkPerBdvPerSeason(to6('0'))
      await this.bean.mint(userAddress, to6('2000'))
      this.result = await this.silo.connect(user).deposit(BEAN, to6('1000'), EXTERNAL)
    })

    it('getter', async function (){
      expect(await this.seasonGetters.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(to6('0'))
    })

    it('increases after some seasons pass', async function () {
      await this.season.fastForward(4320)
      await this.silo.mow(userAddress, BEAN)
      expect(await this.seasonGetters.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(0)
      await this.season.mockUpdateAverageStalkPerBdvPerSeason()

      expect(await this.seasonGetters.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(to6('2'))
    })

    it('decreases after a new deposit', async function() {
      await this.season.fastForward(4320)
      await this.silo.mow(userAddress, BEAN)
      await this.season.mockUpdateAverageStalkPerBdvPerSeason()

      expect(await this.seasonGetters.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(to6('2'))

      this.result = await this.silo.connect(user).deposit(BEAN, to6('1000'), EXTERNAL)

      // fast forward 2 seasons to end germination.
      await this.season.fastForward(2)
      await this.season.mockUpdateAverageStalkPerBdvPerSeason()

      expect(await this.seasonGetters.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(to6('1'))
    })

    it('does not update averageGrownStalkPerBDVPerSeason if less than catchup season', async function () {
      expect(await this.seasonGetters.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(to6('0'))
     
      // deposit beanETH (the gauge system will skip if there is no liquidity):
      await this.silo.connect(user).deposit(BEAN_ETH_WELL, to18('1'), EXTERNAL)

      // fast forward (any arbitary value between 0 < s < CATCHUP_SEASON).
      await this.season.fastForward(168)

      // step through the gauge system (mow addresses such that stalk increases).
      await this.silo.mow(userAddress, BEAN)
      await this.silo.mow(userAddress, BEAN_ETH_WELL)
      await this.season.mockStepGauge()

      // verify gauge system does change value.
      expect(await this.seasonGetters.season()).to.be.equal(170)
      expect(await this.seasonGetters.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(0)
    })

    it('updates averageGrownStalkPerBDVPerSeason if the current season is above threshold', async function () {
      await this.season.fastForward(4320)
      expect(await this.seasonGetters.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(to6('0'))

      // deposit beanETH (the gauge system will skip if there is no liquidity):
      await this.silo.connect(user).deposit(BEAN_ETH_WELL, to18('1'), EXTERNAL)

      // fast forward to end germination.
      await this.season.fastForward(2)

      // step through the gauge system (mow addresses such that stalk increases).
      await this.silo.mow(userAddress, BEAN)
      await this.silo.mow(userAddress, BEAN_ETH_WELL)
      await this.season.mockStepGauge()

      // verify gauge system does change value.
      expect(await this.seasonGetters.season()).to.be.equal(4324)
      expect(await this.seasonGetters.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(1881944)
    })
  })

  it('does not iterate seed gauge system if oracle failed', async function (){
    await setOracleFailure(true, ETH_USDT_UNISWAP_V3)
    await this.season.stepGauge()
    // verify state is same
    expect(await this.seasonGetters.getBeanToMaxLpGpPerBdvRatio()).to.be.equal(to18('50'))
    expect(await this.seasonGetters.getGaugePoints(BEAN_ETH_WELL)).to.be.eq(to18('1000'))

    expect((await this.siloGetters.tokenSettings(BEAN))[1]).to.be.eq(to6('2'))
    expect((await this.siloGetters.tokenSettings(BEAN_ETH_WELL))[1]).to.be.eq(to6('4'))
  })

})