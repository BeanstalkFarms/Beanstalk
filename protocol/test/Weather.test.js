const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { parseJson, to6, to18 } = require("./utils/helpers.js");
const {
  MAX_UINT32,
  UNRIPE_BEAN,
  UNRIPE_LP,
  BEAN_ETH_WELL,
  BEAN,
  BEAN_WSTETH_WELL,
  WSTETH,
  BEANSTALK_PUMP,
  ZERO_BYTES
} = require("./utils/constants.js");
const { getAllBeanstalkContracts } = require("../utils/contracts.js");
const { deployMockWellWithMockPump } = require("../utils/well.js");
const { setEthUsdChainlinkPrice, setWstethUsdPrice } = require("../utils/oracle.js");
const { advanceTime } = require("../utils/helpers.js");

// // Set the test data
const [columns, tests] = parseJson("./coverage_data/weather.json");
var numberTests = tests.length;
var startTest = 0;

async function setToSecondsAfterHour(seconds = 0) {
  const lastTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
  const hourTimestamp = parseInt(lastTimestamp / 3600 + 1) * 3600 + seconds;
  await network.provider.send("evm_setNextBlockTimestamp", [hourTimestamp]);
}

describe("Complex Weather", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();

    user2.address = user2.address;
    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;

    bean = await ethers.getContractAt("MockToken", BEAN);

    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    // add unripe
    this.unripeBean = await ethers.getContractAt("MockToken", UNRIPE_BEAN);
    this.unripeLP = await ethers.getContractAt("MockToken", UNRIPE_LP);
    await this.unripeLP.mint(user.address, to6("1000"));
    await this.unripeLP.connect(user).approve(this.diamond.address, to6("100000000"));
    await this.unripeBean.mint(user.address, to6("1000"));
    await this.unripeBean.connect(user).approve(this.diamond.address, to6("100000000"));
    await mockBeanstalk.setFertilizerE(true, to6("10000"));
    await mockBeanstalk.addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES);
    await mockBeanstalk.addUnripeToken(UNRIPE_LP, BEAN_ETH_WELL, ZERO_BYTES);

    const whitelist = await ethers.getContractAt(
      "WhitelistFacet",
      contracts.beanstalkDiamond.address
    );

    // wells
    [this.well, this.wellFunction, this.pump] = await deployMockWellWithMockPump();
    await this.well.setReserves([to6("1000000"), to18("1000")]);
    [this.beanWstethWell, this.wellFunction, this.pump] = await deployMockWellWithMockPump(
      BEAN_WSTETH_WELL,
      WSTETH
    );
    await this.beanWstethWell.setReserves([to6("1000000"), to18("1000")]);
    await this.beanWstethWell.setReserves([to6("1000000"), to18("1000")]);
    await this.well.setReserves([to6("1000000"), to18("1000")]);
    await this.well.setReserves([to6("1000000"), to18("1000")]);
    await advanceTime(3600);
    await owner.sendTransaction({ to: user.address, value: 0 });
    await setToSecondsAfterHour(0);
    await owner.sendTransaction({ to: user.address, value: 0 });
    await this.well.connect(user).mint(user.address, to18("1000"));
    await beanstalk.connect(user).sunrise();
    await mockBeanstalk.captureWellE(this.well.address);
    await mockBeanstalk.captureWellE(this.beanWstethWell.address);

    await setEthUsdChainlinkPrice("1000");
    await setWstethUsdPrice("1000");
  });

  [...Array(numberTests).keys()]
    .map((i) => i + startTest)
    .forEach(function (v) {
      const testStr = "Test #";
      describe(testStr.concat(v), function () {
        before(async function () {
          this.testData = {};
          columns.forEach((key, i) => (this.testData[key] = tests[v][i]));
          await mockBeanstalk.setUsdEthPrice(to18("0.001"));
          await mockBeanstalk.setFertilizerE(false, to6("0"));
          await mockBeanstalk.setYieldE(this.testData.startingWeather);
          await mockBeanstalk.setBeanToMaxLpGpPerBdvRatio(to18(this.testData.initialPercentToLp));
          bean.connect(user).burn(await bean.balanceOf(user.address));
          this.dsoil = this.testData.lastSoil;
          this.startSoil = this.testData.startingSoil;
          this.endSoil = this.testData.endingSoil;
          this.deltaB = this.testData.deltaB;
          this.pods = this.testData.unharvestablePods;
          this.aboveQ = this.testData.aboveQ;
          this.L2SRState = this.testData.L2SR;
          this.newPercentToLp = to18(this.testData.newPercentToLp);

          await bean.mint(user.address, this.testData.totalOutstandingBeans);
          await mockBeanstalk.setLastSowTimeE(this.testData.lastSowTime);
          await mockBeanstalk.setNextSowTimeE(this.testData.thisSowTime);
          this.result = await mockBeanstalk.calcCaseIdWithParams(
            this.pods,
            this.dsoil, // lastDeltaSoil
            this.startSoil - this.endSoil, // beanSown
            this.endSoil, // endSoil
            this.deltaB, // deltaB
            this.testData.wasRaining,
            this.testData.rainStalk,
            this.aboveQ, // aboveQ
            this.L2SRState // L2SR
          );
        });
        it("Checks New Weather", async function () {
          expect(await mockBeanstalk.getT()).to.eq(this.testData.newWeather);
        });

        it("Emits The Correct Case Weather", async function () {
          if (this.testData.totalOutstandingBeans !== 0)
            await expect(this.result)
              .to.emit(beanstalk, "TemperatureChange")
              .withArgs(
                await beanstalk.season(),
                this.testData.Code,
                this.testData.newWeather - this.testData.startingWeather
              );
        });

        it("Checks New Percent To LP", async function () {
          expect(await beanstalk.getBeanToMaxLpGpPerBdvRatio()).to.eq(
            to18(this.testData.newPercentToLp)
          );
        });

        it("Emits The Correct LP Case", async function () {
          if (this.testData.totalOutstandingBeans !== 0)
            await expect(this.result)
              .to.emit(beanstalk, "BeanToMaxLpGpPerBdvRatioChange")
              .withArgs(await beanstalk.season(), this.testData.Code, to18(this.testData.bL));
        });
      });
    });

  describe("Extreme Weather", async function () {
    before(async function () {
      await mockBeanstalk.setLastDSoilE("100000");
      await bean.mint(user.address, "1000000000");
      await mockBeanstalk.incrementTotalPodsE(0, "100000000000");
    });

    beforeEach(async function () {
      await mockBeanstalk.setYieldE("10");
    });

    it("thisSowTime immediately", async function () {
      await mockBeanstalk.setLastSowTimeE("1");
      await mockBeanstalk.setNextSowTimeE("10");
      await mockBeanstalk.calcCaseIdE(ethers.utils.parseEther("1"), "1");
      const weather = await beanstalk.weather();
      expect(weather.temp).to.equal(7);
      expect(weather.thisSowTime).to.equal(parseInt(MAX_UINT32));
      expect(weather.lastSowTime).to.equal(10);
    });

    it("lastSowTime max", async function () {
      await mockBeanstalk.setLastSowTimeE(MAX_UINT32);
      await mockBeanstalk.setNextSowTimeE("1000");
      await mockBeanstalk.calcCaseIdE(ethers.utils.parseEther("1"), "1");
      const weather = await beanstalk.weather();
      expect(weather.temp).to.equal(7);
      expect(weather.thisSowTime).to.equal(parseInt(MAX_UINT32));
      expect(weather.lastSowTime).to.equal(1000);
    });

    it("lastSowTime max", async function () {
      await mockBeanstalk.setLastSowTimeE("1061");
      await mockBeanstalk.setNextSowTimeE("1000");
      await mockBeanstalk.calcCaseIdE(ethers.utils.parseEther("1"), "1");
      const weather = await beanstalk.weather();
      expect(weather.temp).to.equal(7);
      expect(weather.thisSowTime).to.equal(parseInt(MAX_UINT32));
      expect(weather.lastSowTime).to.equal(1000);
    });

    it("lastSowTime max", async function () {
      await mockBeanstalk.setLastSowTimeE("1060");
      await mockBeanstalk.setNextSowTimeE("1000");
      await mockBeanstalk.calcCaseIdE(ethers.utils.parseEther("1"), "1");
      const weather = await beanstalk.weather();
      expect(weather.temp).to.equal(7);
      expect(weather.thisSowTime).to.equal(parseInt(MAX_UINT32));
      expect(weather.lastSowTime).to.equal(1000);
    });

    it("lastSowTime max", async function () {
      await mockBeanstalk.setLastSowTimeE("940");
      await mockBeanstalk.setNextSowTimeE("1000");
      await mockBeanstalk.calcCaseIdE(ethers.utils.parseEther("1"), "1");
      const weather = await beanstalk.weather();
      expect(weather.temp).to.equal(7);
      expect(weather.thisSowTime).to.equal(parseInt(MAX_UINT32));
      expect(weather.lastSowTime).to.equal(1000);
    });

    it("lastSowTime max", async function () {
      await mockBeanstalk.setLastSowTimeE("900");
      await mockBeanstalk.setNextSowTimeE("1000");
      await mockBeanstalk.calcCaseIdE(ethers.utils.parseEther("1"), "1");
      const weather = await beanstalk.weather();
      expect(weather.temp).to.equal(9);
      expect(weather.thisSowTime).to.equal(parseInt(MAX_UINT32));
      expect(weather.lastSowTime).to.equal(1000);
    });

    it("lastSowTime max", async function () {
      await mockBeanstalk.setLastSowTimeE("900");
      await mockBeanstalk.setNextSowTimeE(MAX_UINT32);
      await mockBeanstalk.calcCaseIdE(ethers.utils.parseEther("1"), "1");
      const weather = await beanstalk.weather();
      expect(weather.temp).to.equal(7);
      expect(weather.thisSowTime).to.equal(parseInt(MAX_UINT32));
      expect(weather.lastSowTime).to.equal(parseInt(MAX_UINT32));
    });
  });
});
