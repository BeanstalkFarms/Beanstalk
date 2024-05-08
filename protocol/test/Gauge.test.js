const { expect } = require('chai')
const { deploy } = require('../scripts/deploy.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot")
const { to6, toStalk, toBean, to18 } = require('./utils/helpers.js')
const { UNRIPE_BEAN, UNRIPE_LP, BEAN, BEAN_3_CURVE, BEAN_ETH_WELL, ETH_USDT_UNISWAP_V3, ETH_USD_CHAINLINK_AGGREGATOR } = require('./utils/constants.js')
const { EXTERNAL, INTERNAL } = require('./utils/balances.js')
const { ethers } = require('hardhat')
const { advanceTime } = require('../utils/helpers.js')
const { deployMockWell, whitelistWell, deployMockWellWithMockPump } = require('../utils/well.js')
const { initializeGaugeForToken } = require('../utils/gauge.js')
const { setEthUsdPrice, setEthUsdcPrice, setEthUsdtPrice } = require('../scripts/usdOracle.js')
const ZERO_BYTES = ethers.utils.formatBytes32String('0x0')
const { setOracleFailure } = require('../utils/oracle.js')


let user, owner
let userAddress, ownerAddress


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

    await this.fertilizer.setBarnRaiseWell(BEAN_ETH_WELL)
    
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

    await setEthUsdChainlinkPrice('1000')

    // add unripe
    this.unripeBean = await ethers.getContractAt('MockToken', UNRIPE_BEAN)
    this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP)
    await this.unripeLP.mint(ownerAddress, to6('10000'))
    await this.unripeBean.mint(ownerAddress, to6('10000'))
    await this.unripeLP.connect(owner).approve(this.diamond.address, to6('100000000'))
    await this.unripeBean.connect(owner).approve(this.diamond.address, to6('100000000'))
    await this.unripe.connect(owner).addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES)
    await this.unripe.connect(owner).addUnripeToken(UNRIPE_LP, BEAN_ETH_WELL, ZERO_BYTES)
    
    // dewhitelist curve, as initMockDiamond initializes bean3crv.
    // dewhitelisted here rather than updating mock to avoid breaking other tests.
    await this.whitelist.connect(owner).dewhitelistToken(BEAN_3_CURVE)

    // initialize gauge parameters for lp:
    await initializeGaugeForToken(BEAN_ETH_WELL, to18('1000'), to6('100'))

    await this.season.updateTWAPCurveE()
  })

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  })

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  })

  describe('Bean to maxLP ratio', function () {
    // MockInitDiamond initializes BeanToMaxLpGpPerBDVRatio to 50% (50e6)

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

      it('initial state', async function () {
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
        initialL2SR = await this.seasonGetters.getLiquidityToSupplyRatio()
        
        await this.bean.mint(ownerAddress, to6('1000000'))
        newL2SR = await this.seasonGetters.getLiquidityToSupplyRatio()

        expect(initialL2SR).to.be.equal(to18('1'))
        expect(newL2SR).to.be.equal(to18('0.5'))
        expect(newL2SR).to.be.lt(initialL2SR)

      })

      it('increases', async function () {
        await this.bean.mint(ownerAddress, to6('1000000'))
        initialL2SR = await this.seasonGetters.getLiquidityToSupplyRatio()

        await this.bean.connect(owner).burn(to6('500000'))
        newL2SR = await this.seasonGetters.getLiquidityToSupplyRatio()

        expect(initialL2SR).to.be.equal(to18('1'))
        expect(newL2SR).to.be.equal(to18('2'))
        expect(newL2SR).to.be.gt(initialL2SR)
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
        // issue unripe such that unripe supply > 10m. 
        await this.unripeLP.mint(ownerAddress, to6('10000000'))
        await this.unripeBean.mint(ownerAddress, to6('10000000'))
        // urBean supply * 10% recapitalization (underlyingBean/UrBean) * 10% (fertilizerIndex/totalFertilizer)
        // = 10000 urBEAN * 10% = 1000 BEAN * (100-10%) = 900 beans locked.
        // urLP supply * 0.1% recapitalization (underlyingBEANETH/UrBEANETH) * 10% (fertilizerIndex/totalFertilizer)
        // urLP supply * 0.1% recapitalization * (100-10%) = 0.9% BEANETHLP locked.
        // 1m beans underlay all beanETHLP tokens.
        // 1m * 0.9% = 900 beans locked.
        expect(await this.unripe.getLockedBeansUnderlyingUnripeBean()).to.be.eq(to6('436.332105'))
        expect(await this.unripe.getLockedBeansUnderlyingUnripeLP()).to.be.eq(to6('436.332105'))
        expect(await this.unripe.getLockedBeans()).to.be.eq(to6('872.66421'))
        expect(
          await this.seasonGetters.getLiquidityToSupplyRatio()
          ).to.be.eq(to18('1.000873426417975035'))

      })
      
      it('< 1m unripe lockedBeans calculation:', async function () {
        // current unripe LP and unripe Bean supply each: 10,000. 
        // under 1m unripe bean and LP, all supply is unlocked:
        const getLockedBeansUnderlyingUnripeBean = await this.unripe.getLockedBeansUnderlyingUnripeBean()
        const getLockedBeansUnderlyingUrLP = await this.unripe.getLockedBeansUnderlyingUnripeBeanEth()
        const lockedBeans = await this.unripe.getLockedBeans()
        const L2SR = await this.seasonGetters.getLiquidityToSupplyRatio()

        expect(getLockedBeansUnderlyingUnripeBean).to.be.eq('0')
        expect(getLockedBeansUnderlyingUrLP).to.be.eq('0')
        expect(lockedBeans).to.be.eq('0')
        expect(L2SR).to.be.eq(to18('1'))

        //  set urBean and urLP to 1m and verify values do not change:
        await this.unripeLP.mint(ownerAddress, to6('989999'))
        await this.unripeBean.mint(ownerAddress, to6('989999'))

        expect(await this.unripe.getLockedBeansUnderlyingUnripeBean()).to.be.eq(getLockedBeansUnderlyingUnripeBean)
        expect(await this.unripe.getLockedBeansUnderlyingUnripeBeanEth()).to.be.eq(getLockedBeansUnderlyingUrLP)
        expect(await this.unripe.getLockedBeans()).to.be.eq(lockedBeans)
        expect(await this.seasonGetters.getLiquidityToSupplyRatio()
          ).to.be.eq(L2SR)
      })

      it('< 5m unripe lockedBeans calculation:', async function () {
        // mint unripe bean and LP such that 5m > supply > 1m.
        await this.unripeLP.mint(ownerAddress, to6('1000000'))
        await this.unripeBean.mint(ownerAddress, to6('1000000'))

        // verify locked beans amount changed: 
        const getLockedBeansUnderlyingUnripeBean = await this.unripe.getLockedBeansUnderlyingUnripeBean()
        const getLockedBeansUnderlyingUrLP = await this.unripe.getLockedBeansUnderlyingUnripeBeanEth()
        const lockedBeans = await this.unripe.getLockedBeans()
        const L2SR = await this.seasonGetters.getLiquidityToSupplyRatio()
        expect(getLockedBeansUnderlyingUnripeBean).to.be.eq(to6('579.500817'))
        expect(getLockedBeansUnderlyingUrLP).to.be.eq(to6('579.500817'))
        expect(lockedBeans).to.be.eq(to6('1159.001634'))

        // verify L2SR increased:
        expect(L2SR).to.be.eq(to18('1.001160346477463386'))
        
        //  set urBean and urLP to 5m and verify values do not change:
        await this.unripeLP.mint(ownerAddress, to6('3990000'))
        await this.unripeBean.mint(ownerAddress, to6('3990000'))

        expect(await this.unripe.getLockedBeansUnderlyingUnripeBean()).to.be.eq(getLockedBeansUnderlyingUnripeBean)
        expect(await this.unripe.getLockedBeansUnderlyingUnripeBeanEth()).to.be.eq(getLockedBeansUnderlyingUrLP)
        expect(await this.unripe.getLockedBeans()).to.be.eq(lockedBeans)

        expect(await this.seasonGetters.getLiquidityToSupplyRatio()).to.be.eq(L2SR)
      })

      it('< 10m unripe lockedBeans calculation:', async function () {
        // mint unripe bean and LP such that 10m > supply > 5m.
        await this.unripeLP.mint(ownerAddress, to6('5000000'))
        await this.unripeBean.mint(ownerAddress, to6('5000000'))

        // verify locked beans amount changed: 
        const getLockedBeansUnderlyingUnripeBean = await this.unripe.getLockedBeansUnderlyingUnripeBean()
        const getLockedBeansUnderlyingUrLP = await this.unripe.getLockedBeansUnderlyingUnripeBeanEth()
        const lockedBeans = await this.unripe.getLockedBeans()
        const L2SR = await this.seasonGetters.getLiquidityToSupplyRatio()
        expect(getLockedBeansUnderlyingUnripeBean).to.be.eq(to6('515.604791'))
        expect(getLockedBeansUnderlyingUrLP).to.be.eq(to6('515.604791'))
        expect(lockedBeans).to.be.eq(to6('1031.209582'))

        // verify L2SR increased:
        expect(L2SR).to.be.eq(to18('1.001032274072915240'))

        //  set urBean and urLP to 10m and verify values do not change:
        await this.unripeLP.mint(ownerAddress, to6('4990000'))
        await this.unripeBean.mint(ownerAddress, to6('4990000'))

        expect(await this.unripe.getLockedBeansUnderlyingUnripeBean()).to.be.eq(getLockedBeansUnderlyingUnripeBean)
        expect(await this.unripe.getLockedBeansUnderlyingUnripeBeanEth()).to.be.eq(getLockedBeansUnderlyingUrLP)
        expect(await this.unripe.getLockedBeans()).to.be.eq(lockedBeans)

        expect(await this.seasonGetters.getLiquidityToSupplyRatio()).to.be.eq(L2SR)
      })

      it('< 10m unripe lockedBeans calculation:', async function () {
        // mint unripe bean and LP such that supply > 10m.
        await this.unripeLP.mint(ownerAddress, to6('10000000'))
        await this.unripeBean.mint(ownerAddress, to6('10000000'))

        // verify locked beans amount changed: 
        expect(await this.unripe.getLockedBeansUnderlyingUnripeBean()).to.be.eq(to6('436.332105'))
        expect(await this.unripe.getLockedBeansUnderlyingUnripeBeanEth()).to.be.eq(to6('436.332105'))
        expect(await this.unripe.getLockedBeans()).to.be.eq(to6('872.664210'))

        // verify L2SR increased:
        expect(
          await this.seasonGetters.getLiquidityToSupplyRatio()
          ).to.be.eq(to18('1.000873426417975035'))
      })

      it('is MEV resistant', async function () {
        // issue unripe such that unripe supply > 10m. 
        await this.unripeLP.mint(ownerAddress, to6('10000000'))
        await this.unripeBean.mint(ownerAddress, to6('10000000'))
        expect(await this.unripe.getLockedBeansUnderlyingUnripeBeanEth()).to.be.eq(to6('436.332105'))

        await this.well.mint(ownerAddress, to18('1000'))

        expect(await this.unripe.getLockedBeansUnderlyingUnripeLP()).to.be.eq(to6('436.332105'))
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

  it('does not iterate seed gauge system if uniswap oracle failed', async function (){
    await setOracleFailure(true, ETH_USDT_UNISWAP_V3)
    await this.season.stepGauge()
    // verify state is same
    expect(await this.seasonGetters.getBeanToMaxLpGpPerBdvRatio()).to.be.equal(to18('50'))
    expect(await this.seasonGetters.getGaugePoints(BEAN_ETH_WELL)).to.be.eq(to18('1000'))

    expect((await this.siloGetters.tokenSettings(BEAN))[1]).to.be.eq(to6('2'))
    expect((await this.siloGetters.tokenSettings(BEAN_ETH_WELL))[1]).to.be.eq(to6('4'))
  })

  it('does not iterate seed gauge system if chainlink oracle failed', async function (){
    const ethUsdChainlinkAggregator = await ethers.getContractAt('MockChainlinkAggregator', ETH_USD_CHAINLINK_AGGREGATOR)
    await ethUsdChainlinkAggregator.addRound(0, 0, 0, 0)
    await this.season.stepGauge()
    // verify state is same
    expect(await this.seasonGetters.getBeanToMaxLpGpPerBdvRatio()).to.be.equal(to18('50'))
    expect(await this.seasonGetters.getGaugePoints(BEAN_ETH_WELL)).to.be.eq(to18('1000'))

    expect((await this.siloGetters.tokenSettings(BEAN))[1]).to.be.eq(to6('2'))
    expect((await this.siloGetters.tokenSettings(BEAN_ETH_WELL))[1]).to.be.eq(to6('4'))
  })

  it("does not update Bean to maxLP ratio if oracle fails", async function () {
    await this.season.seedGaugeSunSunriseWithOracle('0', 108, true)
    expect(await this.seasonGetters.getBeanToMaxLpGpPerBdvRatio()).to.be.equal(to18('50'))
  })

  it("properly returns a oracle failure", async function () {
    // add an invalid oracle round.
    const ethUsdChainlinkAggregator = await ethers.getContractAt('MockChainlinkAggregator', ETH_USD_CHAINLINK_AGGREGATOR)
    await ethUsdChainlinkAggregator.addRound(0, 0, 0, 0)
    // step through case calculation and verify that BeanToMaxLpGpPerBdvRatio remains unchanged.
    await this.season.calcCaseIdE(0,0)
    expect(await this.seasonGetters.getBeanToMaxLpGpPerBdvRatio()).to.be.equal(to18('50'))
  })

  describe("excessive price", async function () {
    beforeEach(async function () {
      // twa: 1 million BEAN: 1000 ETH (1000 BEAN : 1 ETH)
      await this.season.mockSetTwaReserves(BEAN_ETH_WELL, to6('1000000'), to18('1000'));
      // USD/TKN = 0.001 ETH = 1 USD
      await this.season.mockSetUsdTokenPrice(
        BEAN_ETH_WELL,
        to18('0.001')
      )
    })

    it("at peg", async function () {
      expect(await this.season.mockTestBeanPrice(BEAN_ETH_WELL)).to.eq(to6('1'));
    })

    it("above peg", async function () {
      // twa: 900k BEAN: 1000 ETH (900 BEAN : 1 ETH)
      await this.season.mockSetTwaReserves(BEAN_ETH_WELL, to6('900000'), to18('1000'));

      expect(await this.season.mockTestBeanPrice(BEAN_ETH_WELL)).to.eq(1111111);
    })

    it("below peg", async function () {
      // twa: 1.1m BEAN: 1000 ETH (110 BEAN : 1 ETH)
      await this.season.mockSetTwaReserves(BEAN_ETH_WELL, to6('1100000'), to18('1000'));

      expect(await this.season.mockTestBeanPrice(BEAN_ETH_WELL)).to.eq(909090);
    })
  })
 

})