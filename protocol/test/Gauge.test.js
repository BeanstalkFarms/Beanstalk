const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { to6, to18 } = require("./utils/helpers.js");
const {
  UNRIPE_BEAN,
  UNRIPE_LP,
  BEAN,
  BEAN_ETH_WELL,
  ETH_USDT_UNISWAP_V3,
  ZERO_BYTES,
  MAX_UINT256,
  BEAN_WSTETH_WELL
} = require("./utils/constants.js");
const { EXTERNAL } = require("./utils/balances.js");
const { ethers } = require("hardhat");
const { deployMockWellWithMockPump } = require("../utils/well.js");
const { setEthUsdChainlinkPrice } = require("../utils/oracle.js");
const { setOracleFailure } = require("../utils/oracle.js");
const { getAllBeanstalkContracts } = require("../utils/contracts");

let user, user2, owner;

describe("Gauge", function () {
  before(async function () {
    [owner, user] = await ethers.getSigners();
    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    bean = await ethers.getContractAt("MockToken", BEAN);

    // dewhitelist wsteth well for testing purposes (testing bean <> LP gauge).
    await beanstalk.connect(owner).dewhitelistToken(BEAN_WSTETH_WELL);
    await mockBeanstalk.setBarnRaiseWell(BEAN_ETH_WELL);

    await bean.connect(owner).approve(this.diamond.address, MAX_UINT256);
    await bean.connect(user).approve(this.diamond.address, MAX_UINT256);

    // init wells
    [this.well, this.wellFunction, this.pump] = await deployMockWellWithMockPump();
    await this.well.connect(owner).approve(this.diamond.address, MAX_UINT256);
    await this.well.connect(user).approve(this.diamond.address, MAX_UINT256);

    await this.well.setReserves([to6("1000000"), to18("1000")]);
    await this.pump.setCumulativeReserves(this.well.address, [to6("1000000"), to18("1000")]);
    await this.well.mint(ownerAddress, to18("500"));
    await this.well.mint(user.address, to18("500"));
    await mockBeanstalk.siloSunrise(0);
    await mockBeanstalk.captureWellE(this.well.address);

    await setEthUsdChainlinkPrice("1000");

    // add unripe
    this.unripeBean = await ethers.getContractAt("MockToken", UNRIPE_BEAN);
    this.unripeLP = await ethers.getContractAt("MockToken", UNRIPE_LP);
    await this.unripeLP.mint(ownerAddress, to18("10000"));
    await this.unripeBean.mint(ownerAddress, to6("10000"));
    await this.unripeLP.connect(owner).approve(this.diamond.address, to6("100000000"));
    await this.unripeBean.connect(owner).approve(this.diamond.address, to6("100000000"));
    await mockBeanstalk.connect(owner).addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES);
    await mockBeanstalk.connect(owner).addUnripeToken(UNRIPE_LP, BEAN_ETH_WELL, ZERO_BYTES);

    await mockBeanstalk.setBeanToMaxLpGpPerBdvRatio(to18("50"));
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Bean to maxLP ratio", function () {
    // MockInitDiamond initalizes BeanToMaxLpGpPerBDVRatio to 50% (50e6)

    describe("L2SR > excessively high L2SR % + P > 1", async function () {
      it("increases Bean to maxLP ratio", async function () {
        this.result = await mockBeanstalk.seedGaugeSunSunrise("0", 108);

        expect(await beanstalk.getBeanToMaxLpGpPerBdvRatio()).to.be.equal(to18("51"));
        await expect(this.result).to.emit(beanstalk, "BeanToMaxLpGpPerBdvRatioChange").withArgs(
          3, // season
          108, // caseId
          to18("1") // absolute change (+1%)
        );
      });
    });

    describe("moderately high L2SR % < L2SR < excessively high L2SR % + P < 1", async function () {
      it("decreases Bean to maxLP ratio", async function () {
        this.result = await mockBeanstalk.seedGaugeSunSunrise("0", 75);
        expect(await beanstalk.getBeanToMaxLpGpPerBdvRatio()).to.be.equal(to18("49"));
        await expect(this.result).to.emit(beanstalk, "BeanToMaxLpGpPerBdvRatioChange").withArgs(
          3, // season
          75, // caseId
          to18("-1") // absolute change (-1%)
        );
      });
    });

    describe("moderately low L2SR % < L2SR < moderately high L2SR %, excessively low podRate", async function () {
      it("increases Bean to maxLP ratio", async function () {
        this.result = await mockBeanstalk.seedGaugeSunSunrise("0", 36);

        expect(await beanstalk.getBeanToMaxLpGpPerBdvRatio()).to.be.equal(to18("0"));
        await expect(this.result).to.emit(beanstalk, "BeanToMaxLpGpPerBdvRatioChange").withArgs(
          3, // season
          36, // caseId
          to18("-50") // absolute change (-50%)
        );
      });
    });

    describe("L2SR < moderately low L2SR %", async function () {
      it("massively decreases Bean to maxLP ratio", async function () {
        await mockBeanstalk.setBeanToMaxLpGpPerBdvRatio(to18("51"));

        this.result = await mockBeanstalk.seedGaugeSunSunrise("0", 0);
        expect(await beanstalk.getBeanToMaxLpGpPerBdvRatio()).to.be.equal(to18("1"));
        await expect(this.result).to.emit(beanstalk, "BeanToMaxLpGpPerBdvRatioChange").withArgs(
          3, // season
          0, // caseId
          to18("-50") // absolute change (-50%)
        );
      });
    });

    it("Bean to maxLP ratio cannot go under 0%", async function () {
      await mockBeanstalk.setBeanToMaxLpGpPerBdvRatio(to18("0.5"));
      this.result = await mockBeanstalk.seedGaugeSunSunrise("0", 111);

      expect(await beanstalk.getBeanToMaxLpGpPerBdvRatio()).to.be.equal("0");
      await expect(this.result).to.emit(beanstalk, "BeanToMaxLpGpPerBdvRatioChange").withArgs(
        3, // season
        111, // caseId
        to18("-0.5") // absolute change (-0.5%)
      );
    });

    it("Bean to maxLP ratio can increase from 0%", async function () {
      await mockBeanstalk.setBeanToMaxLpGpPerBdvRatio(to18("0"));
      this.result = await mockBeanstalk.seedGaugeSunSunrise("0", 72);

      expect(await beanstalk.getBeanToMaxLpGpPerBdvRatio()).to.be.equal(to18("1"));
      await expect(this.result).to.emit(beanstalk, "BeanToMaxLpGpPerBdvRatioChange").withArgs(
        3, // season
        72, // caseId
        to18("1") // absolute change (+1%)
      );
    });

    it("Bean to maxLP ratio cannot go above 100%", async function () {
      await mockBeanstalk.setBeanToMaxLpGpPerBdvRatio(to18("99.9"));
      this.result = await mockBeanstalk.seedGaugeSunSunrise("0", 54);

      expect(await beanstalk.getBeanToMaxLpGpPerBdvRatio()).to.be.equal(to18("100"));
      await expect(this.result).to.emit(beanstalk, "BeanToMaxLpGpPerBdvRatioChange").withArgs(
        3, // season
        54, // caseId
        to18("0.1") // absolute change (+0.1%)
      );
    });

    it("Bean to maxLP ratio properly scales", async function () {
      await mockBeanstalk.setBeanToMaxLpGpPerBdvRatio(to18("50"));

      // 0.50 * (1 - 0.5) + 0.5 = 0.75
      expect(await beanstalk.getBeanToMaxLpGpPerBdvRatioScaled()).to.be.equal(to18("75"));

      await mockBeanstalk.setBeanToMaxLpGpPerBdvRatio(to18("51"));

      // 0.51 * (1 - 0.5) + 0.5 = 75.5
      expect(await beanstalk.getBeanToMaxLpGpPerBdvRatioScaled()).to.be.equal(to18("75.5"));
    });

    it("Bean to maxLP ratio cannot decrease below min %", async function () {
      await mockBeanstalk.setBeanToMaxLpGpPerBdvRatio(to18("0"));

      // 0 * (1 - 0.5) + 0.5 = .5
      expect(await beanstalk.getBeanToMaxLpGpPerBdvRatioScaled()).to.be.equal(to18("50"));
    });

    it("Bean to maxLP ratio cannot exceed max %", async function () {
      await mockBeanstalk.setBeanToMaxLpGpPerBdvRatio(to18("100"));

      // 100 * (1 - 0.5) + 0.5 = 1
      expect(await beanstalk.getBeanToMaxLpGpPerBdvRatioScaled()).to.be.equal(to18("100"));
    });
  });

  describe("L2SR calculation", async function () {
    describe("getter", function () {
      it("outputs correct liquidity values:", async function () {
        expect(await beanstalk.getTwaLiquidityForWell(BEAN_ETH_WELL)).to.be.equal(to18("1000000"));
        expect(await beanstalk.getTotalUsdLiquidity()).to.be.equal(to18("1000000"));
        expect(await beanstalk.getWeightedTwaLiquidityForWell(BEAN_ETH_WELL)).to.be.equal(
          to18("1000000")
        );
        expect(await beanstalk.getTotalWeightedUsdLiquidity()).to.be.equal(to18("1000000"));
      });

      it("initial state", async function () {
        // bean:eth has a ratio of 1000:1 (1m beans paired against 1m usd of eth),
        // total supply of bean is 2m, with 0 circulating.
        // total non-bean liquidity is 2m.
        await bean.mint(ownerAddress, to6("1000000"));

        expect(await beanstalk.getLiquidityToSupplyRatio()).to.be.equal(to18("1"));
      });

      it("liquidity Weighted", async function () {
        await bean.mint(ownerAddress, to6("1000000"));
        await mockBeanstalk.mockUpdateLiquidityWeight(
          BEAN_ETH_WELL,
          mockBeanstalk.address,
          "0x00",
          mockBeanstalk.interface.getSighash("mockLiquidityWeight")
        );
        expect(await beanstalk.getLiquidityToSupplyRatio()).to.be.equal(to18("0.5"));
      });

      it("returns 0 if no liquidity", async function () {
        await bean.mint(ownerAddress, to6("1000000"));
        await this.pump.setCumulativeReserves(this.well.address, [to6("0"), to18("0")]);

        expect(await beanstalk.getLiquidityToSupplyRatio()).to.be.equal(0);
      });

      it("returns 0 if no supply", async function () {
        this.beanSupply = await bean.totalSupply();
        this.result = await beanstalk.getLiquidityToSupplyRatio();

        await expect(this.beanSupply).to.be.equal(0);
        await expect(this.result).to.be.equal(0);
      });

      it("decreases", async function () {
        await bean.mint(ownerAddress, to6("1000000"));
        initalL2SR = await beanstalk.getLiquidityToSupplyRatio();

        await bean.mint(ownerAddress, to6("1000000"));
        newL2SR = await beanstalk.getLiquidityToSupplyRatio();

        expect(initalL2SR).to.be.equal(to18("1"));
        expect(newL2SR).to.be.equal(to18("0.5"));
        expect(newL2SR).to.be.lt(initalL2SR);
      });

      it("increases", async function () {
        await bean.mint(ownerAddress, to6("1000000"));
        initalL2SR = await beanstalk.getLiquidityToSupplyRatio();

        await bean.connect(owner).burn(to6("500000"));
        newL2SR = await beanstalk.getLiquidityToSupplyRatio();

        expect(initalL2SR).to.be.equal(to18("1"));
        expect(newL2SR).to.be.equal(to18("2"));
        expect(newL2SR).to.be.gt(initalL2SR);
      });
    });

    // when beanstalk has outstanding fertilizer (aka unripe assets)
    // a portion of the supply is locked, due to the difference between
    // the underlying amount and redemption price.
    // thus the supply can be reduced.
    describe("with unripe", function () {
      before(async function () {
        await bean.mint(ownerAddress, to6("1000000"));
        // enable fertilizer, 10000 sprouts unfertilized
        await mockBeanstalk.setFertilizerE(true, to6("10000"));
        await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_BEAN, to6("1000"));

        await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_LP, to18("31.62277663"));

        // add 1000 LP to 10,000 unripe
        await mockBeanstalk.connect(owner).setPenaltyParams(to6("100"), to6("1000"));
      });

      it("getters", async function () {
        // issue unripe such that unripe supply > 10m.
        await this.unripeLP.mint(ownerAddress, to6("10000000"));
        await this.unripeBean.mint(ownerAddress, to6("10000000"));
        // urBean supply * 10% recapitalization (underlyingBean/UrBean) * 10% (fertilizerIndex/totalFertilizer)
        // = 10000 urBEAN * 10% = 1000 BEAN * (100-10%) = 900 beans locked.
        // urBEANETH supply * 0.1% recapitalization (underlyingBEANETH/UrBEANETH) * 10% (fertilizerIndex/totalFertilizer)
        // urBEANETH supply * 0.1% recapitalization * (100-10%) = 0.9% BEANETHLP locked.
        // 1m beans underlay all beanETHLP tokens.
        // 1m * 0.9% = 900 beans locked.
        expect(await beanstalk.getLockedBeansUnderlyingUnripeBean()).to.be.eq(to6("436.332105"));
        expect(await beanstalk.getLockedBeansUnderlyingUnripeLP()).to.be.eq(to6("436.332105"));
        expect(await beanstalk.getLockedBeans()).to.be.eq(to6("872.66421"));
        expect(await beanstalk.getLiquidityToSupplyRatio()).to.be.eq(to18("1.000873426417975035"));
      });

      // skipped due to foundry tests.
      it.skip("< 1m unripe lockedBeans calculation:", async function () {
        // current unripe LP and unripe Bean supply each: 10,000.
        // under 1m unripe bean and LP, all supply is unlocked:
        const getLockedBeansUnderlyingUnripeBean =
          await beanstalk.getLockedBeansUnderlyingUnripeBean();
        const getLockedBeansUnderlyingUrLP = await beanstalk.getLockedBeansUnderlyingUnripeLP();
        const lockedBeans = await beanstalk.getLockedBeans();
        const L2SR = await beanstalk.getLiquidityToSupplyRatio();

        expect(getLockedBeansUnderlyingUnripeBean).to.be.eq("0");
        expect(getLockedBeansUnderlyingUrLP).to.be.eq("0");
        expect(lockedBeans).to.be.eq("0");
        expect(L2SR).to.be.eq(to18("1"));

        //  set urBean and urLP to 1m and verify values do not change:
        await this.unripeLP.mint(ownerAddress, to6("989999"));
        await this.unripeBean.mint(ownerAddress, to6("989999"));

        expect(await beanstalk.getLockedBeansUnderlyingUnripeBean()).to.be.eq(
          getLockedBeansUnderlyingUnripeBean
        );
        expect(await beanstalk.getLockedBeansUnderlyingUnripeLP()).to.be.eq(
          getLockedBeansUnderlyingUrLP
        );
        expect(await beanstalk.getLockedBeans()).to.be.eq(lockedBeans);
        expect(await beanstalk.getLiquidityToSupplyRatio()).to.be.eq(L2SR);
      });

      it.skip("< 5m unripe lockedBeans calculation:", async function () {
        // mint unripe bean and LP such that 5m > supply > 1m.
        await this.unripeLP.mint(ownerAddress, to6("1000000"));
        await this.unripeBean.mint(ownerAddress, to6("1000000"));

        // verify locked beans amount changed:
        const getLockedBeansUnderlyingUnripeBean =
          await beanstalk.getLockedBeansUnderlyingUnripeBean();
        const getLockedBeansUnderlyingUrLP = await beanstalk.getLockedBeansUnderlyingUnripeLP();
        const lockedBeans = await beanstalk.getLockedBeans();
        const L2SR = await beanstalk.getLiquidityToSupplyRatio();
        expect(getLockedBeansUnderlyingUnripeBean).to.be.eq(to6("579.500817"));
        expect(getLockedBeansUnderlyingUrLP).to.be.eq(to6("579.500817"));
        expect(lockedBeans).to.be.eq(to6("1159.001634"));

        // verify L2SR increased:
        expect(L2SR).to.be.eq(to18("1.001160346477463386"));

        //  set urBean and urLP to 5m and verify values do not change:
        await this.unripeLP.mint(ownerAddress, to6("3990000"));
        await this.unripeBean.mint(ownerAddress, to6("3990000"));

        expect(await beanstalk.getLockedBeansUnderlyingUnripeBean()).to.be.eq(
          getLockedBeansUnderlyingUnripeBean
        );
        expect(await beanstalk.getLockedBeansUnderlyingUnripeLP()).to.be.eq(
          getLockedBeansUnderlyingUrLP
        );
        expect(await beanstalk.getLockedBeans()).to.be.eq(lockedBeans);

        expect(await beanstalk.getLiquidityToSupplyRatio()).to.be.eq(L2SR);
      });

      it.skip("< 10m unripe lockedBeans calculation:", async function () {
        // mint unripe bean and LP such that 10m > supply > 5m.
        await this.unripeLP.mint(ownerAddress, to6("5000000"));
        await this.unripeBean.mint(ownerAddress, to6("5000000"));

        // verify locked beans amount changed:
        const getLockedBeansUnderlyingUnripeBean =
          await beanstalk.getLockedBeansUnderlyingUnripeBean();
        const getLockedBeansUnderlyingUrLP = await beanstalk.getLockedBeansUnderlyingUnripeLP();
        const lockedBeans = await beanstalk.getLockedBeans();
        const L2SR = await beanstalk.getLiquidityToSupplyRatio();
        expect(getLockedBeansUnderlyingUnripeBean).to.be.eq(to6("515.604791"));
        expect(getLockedBeansUnderlyingUrLP).to.be.eq(to6("515.604791"));
        expect(lockedBeans).to.be.eq(to6("1031.209582"));

        // verify L2SR increased:
        expect(L2SR).to.be.eq(to18("1.001032274072915240"));

        //  set urBean and urLP to 10m and verify values do not change:
        await this.unripeLP.mint(ownerAddress, to6("4990000"));
        await this.unripeBean.mint(ownerAddress, to6("4990000"));

        expect(await beanstalk.getLockedBeansUnderlyingUnripeBean()).to.be.eq(
          getLockedBeansUnderlyingUnripeBean
        );
        expect(await beanstalk.getLockedBeansUnderlyingUnripeLP()).to.be.eq(
          getLockedBeansUnderlyingUrLP
        );
        expect(await beanstalk.getLockedBeans()).to.be.eq(lockedBeans);

        expect(await beanstalk.getLiquidityToSupplyRatio()).to.be.eq(L2SR);
      });

      it.skip("< 10m unripe lockedBeans calculation:", async function () {
        // mint unripe bean and LP such that supply > 10m.
        await this.unripeLP.mint(ownerAddress, to6("10000000"));
        await this.unripeBean.mint(ownerAddress, to6("10000000"));

        // verify locked beans amount changed:
        expect(await beanstalk.getLockedBeansUnderlyingUnripeBean()).to.be.eq(to6("436.332105"));
        expect(await beanstalk.getLockedBeansUnderlyingUnripeLP()).to.be.eq(to6("436.332105"));
        expect(await beanstalk.getLockedBeans()).to.be.eq(to6("872.664210"));

        // verify L2SR increased:
        expect(await beanstalk.getLiquidityToSupplyRatio()).to.be.eq(to18("1.000873426417975035"));
      });

      it("is MEV resistant", async function () {
        // issue unripe such that unripe supply > 10m.
        await this.unripeLP.mint(ownerAddress, to6("10000000"));
        await this.unripeBean.mint(ownerAddress, to6("10000000"));
        expect(await beanstalk.getLockedBeansUnderlyingUnripeLP()).to.be.eq(to6("436.332105"));

        await this.well.mint(ownerAddress, to18("1000"));

        expect(await beanstalk.getLockedBeansUnderlyingUnripeLP()).to.be.eq(to6("436.332105"));
      });
    });
  });

  describe("GaugePoints", async function () {
    beforeEach(async function () {
      beanETHGaugePoints = await beanstalk.getGaugePoints(BEAN_ETH_WELL);
      // deposit beanETH:
      await beanstalk.connect(user).deposit(BEAN_ETH_WELL, to18("1"), EXTERNAL);
      await bean.mint(user.address, to6("10000"));
      // deposit beans:
      await beanstalk.connect(user).deposit(BEAN, to6("100"), EXTERNAL);

      // call sunrise twice as bdv is not updated until germination has finished.
      await mockBeanstalk.siloSunrise(0);
      await mockBeanstalk.siloSunrise(0);

      this.result = await mockBeanstalk.mockStepGauge();
    });

    it("updates gauge points", async function () {
      expect(await beanstalk.getGaugePoints(BEAN_ETH_WELL)).to.be.eq(to18("100"));
    });

    it("update seeds values", async function () {
      // mockInitDiamond sets s.sys.averageGrownStalkPerBdvPerSeason to 3e6 (avg 3 seeds per BDV),
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
      expect(await beanstalk.getBeanEthGaugePointsPerBdv()).to.be.eq(to18("1.581139235168483113"));
      expect(await beanstalk.getBeanGaugePointsPerBdv()).to.be.eq(to18("1.185854426376362334"));
      expect(await beanstalk.getGrownStalkIssuedPerSeason()).to.be.eq(to6("489.736611"));
      expect(await beanstalk.getGrownStalkIssuedPerGp()).to.be.eq("2240481");
      expect((await beanstalk.tokenSettings(BEAN))[1]).to.be.eq(2656884); // 2.65 seeds per BDV
      expect((await beanstalk.tokenSettings(BEAN_ETH_WELL))[1]).to.be.eq(3542512); // 3.54 seeds per BDV
    });

    it("Cannot exceed the maximum gauge points", async function () {
      expect(await beanstalk.defaultGaugePointFunction(to18("1000"), 50e6, 49e6)).to.be.eq(
        to18("1000")
      );

      expect(await beanstalk.defaultGaugePointFunction(to18("1001"), 50e6, 49e6)).to.be.eq(
        to18("1000")
      );
    });
  });

  describe("averageGrownStalkPerBdvPerSeason", async function () {
    before(async function () {
      await mockBeanstalk.mockSetAverageGrownStalkPerBdvPerSeason(to6("0"));
      await bean.mint(user.address, to6("2000"));
      this.result = await beanstalk.connect(user).deposit(BEAN, to6("1000"), EXTERNAL);
    });

    it("getter", async function () {
      expect(await beanstalk.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(to6("0"));
    });

    it("increases after some seasons pass", async function () {
      await mockBeanstalk.fastForward(4320);
      await beanstalk.mow(user.address, BEAN);
      expect(await beanstalk.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(0);
      await mockBeanstalk.mockUpdateAverageStalkPerBdvPerSeason();

      expect(await beanstalk.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(to6("2"));
    });

    it("decreases after a new deposit", async function () {
      await mockBeanstalk.fastForward(4320);
      await beanstalk.mow(user.address, BEAN);
      await mockBeanstalk.mockUpdateAverageStalkPerBdvPerSeason();

      expect(await beanstalk.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(to6("2"));

      this.result = await beanstalk.connect(user).deposit(BEAN, to6("1000"), EXTERNAL);

      // fast forward 2 seasons to end germination.
      await mockBeanstalk.fastForward(2);
      await mockBeanstalk.mockUpdateAverageStalkPerBdvPerSeason();

      expect(await beanstalk.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(to6("1"));
    });

    it("does not update averageGrownStalkPerBDVPerSeason if less than catchup season", async function () {
      expect(await beanstalk.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(to6("0"));

      // deposit beanETH (the gauge system will skip if there is no liquidity):
      await beanstalk.connect(user).deposit(BEAN_ETH_WELL, to18("1"), EXTERNAL);

      // fast forward (any arbitary value between 0 < s < CATCHUP_SEASON).
      await mockBeanstalk.fastForward(168);

      // step through the gauge system (mow addresses such that stalk increases).
      await beanstalk.mow(user.address, BEAN);
      await beanstalk.mow(user.address, BEAN_ETH_WELL);
      await mockBeanstalk.mockStepGauge();

      // verify gauge system does change value.
      expect(await beanstalk.season()).to.be.equal(170);
      expect(await beanstalk.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(0);
    });

    it("updates averageGrownStalkPerBDVPerSeason if the current season is above threshold", async function () {
      await mockBeanstalk.fastForward(4320);
      expect(await beanstalk.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(to6("0"));

      // deposit beanETH (the gauge system will skip if there is no liquidity):
      await beanstalk.connect(user).deposit(BEAN_ETH_WELL, to18("1"), EXTERNAL);

      // fast forward to end germination.
      await mockBeanstalk.fastForward(2);

      // step through the gauge system (mow addresses such that stalk increases).
      await beanstalk.mow(user.address, BEAN);
      await beanstalk.mow(user.address, BEAN_ETH_WELL);
      await mockBeanstalk.mockStepGauge();

      // verify gauge system does change value.
      expect(await beanstalk.season()).to.be.equal(4324);
      expect(await beanstalk.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(1881944);
    });
  });

  it("does not iterate seed gauge system if oracle failed", async function () {
    await setOracleFailure(true, ETH_USDT_UNISWAP_V3);
    await mockBeanstalk.stepGauge();
    // verify state is same
    expect(await beanstalk.getBeanToMaxLpGpPerBdvRatio()).to.be.equal(to18("50"));
    expect(await beanstalk.getGaugePoints(BEAN_ETH_WELL)).to.be.eq(to18("100"));

    expect((await beanstalk.tokenSettings(BEAN))[1]).to.be.eq(to6("2"));
    expect((await beanstalk.tokenSettings(BEAN_ETH_WELL))[1]).to.be.eq(to6("4"));
  });
});
