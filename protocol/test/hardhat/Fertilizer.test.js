const { expect } = require("chai");
const { deploy } = require("../../scripts/deploy.js");
const { impersonateFertilizer } = require("../../scripts/deployFertilizer.js");
const { EXTERNAL, INTERNAL } = require("./utils/balances.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const {
  BEAN,
  USDC,
  UNRIPE_BEAN,
  UNRIPE_LP,
  BEANSTALK,
  BARN_RAISE_TOKEN,
  BEAN_WSTETH_WELL
} = require("./utils/constants.js");
const { setWstethUsdPrice } = require("../../utils/oracle.js");
const { to6, to18 } = require("./utils/helpers.js");
const { deployBasinV1_1 } = require("../../scripts/basinV1_1.js");
const { getAllBeanstalkContracts } = require("../../utils/contracts.js");
const { impersonateBeanWstethWell } = require("../../utils/well.js");
const { upgradeWithNewFacets } = require("../../scripts/diamond.js");

let user, user2, owner, fert;

let snapshotId;

function beansForUsdc(amount) {
  return ethers.BigNumber.from(amount)
    .mul(ethers.BigNumber.from("32509005432722"))
    .div(ethers.BigNumber.from("77000000"));
}

function lpBeansForUsdc(amount) {
  return ethers.BigNumber.from(amount).mul(ethers.BigNumber.from("866616"));
}

describe("Fertilize", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();

    user2.address = user2.address;
    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    // impersonate fertilizer.
    this.fert = await impersonateFertilizer();
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;

    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    // simulate transfer to diamond address. impersonate bean-wsteth well.
    await this.fert.transferOwnership(this.diamond.address);
    this.usdc = await ethers.getContractAt("IBean", USDC);
    bean = await ethers.getContractAt("IBean", BEAN);
    this.barnRaiseToken = await ethers.getContractAt("IBean", BARN_RAISE_TOKEN);

    this.unripeBean = await ethers.getContractAt("MockToken", UNRIPE_BEAN);
    this.unripeLP = await ethers.getContractAt("MockToken", UNRIPE_LP);
    await this.unripeBean.mint(user2.address, to6("1000"));
    await this.unripeLP.mint(user2.address, to6("942.297473"));

    await bean.mint(owner.address, to18("1000000000"));
    await this.barnRaiseToken.mint(owner.address, to18("1000000000"));
    await this.barnRaiseToken.mint(user.address, to18("1000000000"));
    await this.barnRaiseToken.mint(user2.address, to18("1000000000"));
    await bean.connect(owner).approve(this.diamond.address, to18("1000000000"));
    await this.barnRaiseToken.connect(owner).approve(this.diamond.address, to18("1000000000"));
    await this.barnRaiseToken.connect(user).approve(this.diamond.address, to18("1000000000"));
    await this.barnRaiseToken.connect(user2).approve(this.diamond.address, to18("1000000000"));

    await setWstethUsdPrice("1000");

    this.well = await ethers.getContractAt("MockToken", BEAN_WSTETH_WELL);
    await this.well.connect(owner).approve(BEANSTALK, ethers.constants.MaxUint256);
    await bean.connect(owner).approve(BEANSTALK, ethers.constants.MaxUint256);
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  it("reverts if early Season", async function () {
    await expect(mockBeanstalk.connect(owner).addFertilizerOwner("1", "1", "0")).to.be.revertedWith(
      "panic code 0x11"
    );
  });

  describe("Get Humidity", async function () {
    it("0th season", async function () {
      expect(await mockBeanstalk.getHumidity("0")).to.be.equal(5000);
    });

    it("first season", async function () {
      expect(await mockBeanstalk.getHumidity("6074")).to.be.equal(2500);
    });

    it("second season", async function () {
      expect(await mockBeanstalk.getHumidity("6075")).to.be.equal(2495);
    });

    it("11th season", async function () {
      expect(await mockBeanstalk.getHumidity("6084")).to.be.equal(2450);
    });

    it("2nd last scale season", async function () {
      expect(await mockBeanstalk.getHumidity("6533")).to.be.equal(205);
    });

    it("last scale season", async function () {
      expect(await mockBeanstalk.getHumidity("6534")).to.be.equal(200);
    });

    it("late season", async function () {
      expect(await mockBeanstalk.getHumidity("10000")).to.be.equal(200);
    });
  });

  it("gets fertilizers", async function () {
    const fertilizers = await mockBeanstalk.getFertilizers();
    expect(`${fertilizers}`).to.be.equal("");
  });

  describe("Add Fertilizer", async function () {
    describe("1 fertilizer", async function () {
      beforeEach(async function () {
        this.result = await mockBeanstalk
          .connect(owner)
          .addFertilizerOwner("10000", to18("0.001"), "0");
      });

      it("updates totals", async function () {
        expect(await mockBeanstalk.totalUnfertilizedBeans()).to.be.equal(to6("1.2"));
        expect(await mockBeanstalk.getFirst()).to.be.equal(to6("1.2"));
        expect(await mockBeanstalk.getNext(to6("1.2"))).to.be.equal(0);
        expect(await mockBeanstalk.getActiveFertilizer()).to.be.equal("1");
        expect(await mockBeanstalk.isFertilizing()).to.be.equal(true);
        expect(await mockBeanstalk.remainingRecapitalization()).to.be.equal(to6("499"));
      });

      it("updates token balances", async function () {
        expect(await bean.balanceOf(mockBeanstalk.address)).to.be.equal(to6("2"));
        expect(await this.well.balanceOf(mockBeanstalk.address)).to.be.equal("29438342344636187");

        expect(await this.barnRaiseToken.balanceOf(this.well.address)).to.be.equal(to18("0.001"));
        expect(await bean.balanceOf(this.well.address)).to.be.equal(lpBeansForUsdc("1"));
      });

      it("updates underlying balances", async function () {
        expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6("2"));
        expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_LP)).to.be.equal(
          await this.well.balanceOf(mockBeanstalk.address)
        );
      });

      it("updates fertizer amount", async function () {
        expect(await mockBeanstalk.getFertilizer(to6("1.2"))).to.be.equal("1");
      });

      it("emits event", async function () {
        expect(this.result).to.emit("SetFertilizer").withArgs("10000", to6("1.2"), to6("1.2"));
      });

      it("gets fertilizers", async function () {
        const fertilizers = await mockBeanstalk.getFertilizers();
        expect(`${fertilizers}`).to.be.equal("1200000,1");
      });
    });

    describe("1 fertilizer twice", async function () {
      beforeEach(async function () {
        await mockBeanstalk.connect(owner).addFertilizerOwner("10000", to18("0.001"), "0");
        await mockBeanstalk.connect(owner).addFertilizerOwner("10000", to18("0.001"), "0");
        this.depositedBeans = beansForUsdc("1").add(beansForUsdc("1"));
      });

      it("updates totals", async function () {
        expect(await mockBeanstalk.totalUnfertilizedBeans()).to.be.equal(to6("2.4"));
        expect(await mockBeanstalk.getFirst()).to.be.equal(to6("1.2"));
        expect(await mockBeanstalk.getNext(to6("1.2"))).to.be.equal(0);
        expect(await mockBeanstalk.getActiveFertilizer()).to.be.equal("2");
        expect(await mockBeanstalk.remainingRecapitalization()).to.be.equal(to6("498"));
      });

      it("updates token balances", async function () {
        expect(await bean.balanceOf(mockBeanstalk.address)).to.be.equal(to6("3.999999"));
        expect(await this.well.balanceOf(mockBeanstalk.address)).to.be.equal("58876684689272374");

        expect(await this.barnRaiseToken.balanceOf(this.well.address)).to.be.equal(to18("0.002"));
        expect(await bean.balanceOf(this.well.address)).to.be.equal(lpBeansForUsdc("2"));
      });

      it("updates underlying balances", async function () {
        expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6("3.999999"));
        expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_LP)).to.be.equal(
          await this.well.balanceOf(mockBeanstalk.address)
        );
      });

      it("updates fertizer amount", async function () {
        expect(await mockBeanstalk.getFertilizer(to6("1.2"))).to.be.equal("2");
      });
    });

    describe("2 fertilizers", async function () {
      beforeEach(async function () {
        await mockBeanstalk.connect(owner).addFertilizerOwner("0", to18("0.005"), "0");
        await mockBeanstalk.connect(owner).addFertilizerOwner("10000", to18("0.001"), "0");
        this.lpBeans = lpBeansForUsdc("5").add(lpBeansForUsdc("1"));
      });

      it("updates totals", async function () {
        expect(await mockBeanstalk.totalUnfertilizedBeans()).to.be.equal(to6("31.2"));
        expect(await mockBeanstalk.getFirst()).to.be.equal(to6("1.2"));
        expect(await mockBeanstalk.getNext(to6("1.2"))).to.be.equal(to6("6"));
        expect(await mockBeanstalk.getActiveFertilizer()).to.be.equal("6");
        expect(await mockBeanstalk.isFertilizing()).to.be.equal(true);
        expect(await mockBeanstalk.remainingRecapitalization()).to.be.equal(to6("494"));
      });

      it("updates token balances", async function () {
        expect(await bean.balanceOf(mockBeanstalk.address)).to.be.equal(to6("11.999999"));
        expect(await this.well.balanceOf(mockBeanstalk.address)).to.be.equal("176630054067817122");

        expect(await this.barnRaiseToken.balanceOf(this.well.address)).to.be.equal(to18("0.006"));
        expect(await bean.balanceOf(this.well.address)).to.be.equal(this.lpBeans);
      });

      it("updates underlying balances", async function () {
        expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6("11.999999"));
        expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_LP)).to.be.equal(
          await this.well.balanceOf(mockBeanstalk.address)
        );
      });

      it("updates fertizer amount", async function () {
        expect(await mockBeanstalk.getFertilizer(to6("1.2"))).to.be.equal("1");
        expect(await mockBeanstalk.getFertilizer(to6("6"))).to.be.equal("5");
      });
    });

    describe("Too much Fertilizer", async function () {
      it("reverts", async function () {
        expect(
          await mockBeanstalk.connect(owner).addFertilizerOwner("0", to18("1"), "0")
        ).to.be.revertedWith("Fertilizer: No more fertilizer available");
      });
    });
  });

  describe("Sort fertilizer seasons", async function () {
    beforeEach(async function () {
      await mockBeanstalk.connect(owner).addFertilizerOwner("10000", to18("0.001"), "0");
      await mockBeanstalk.connect(owner).addFertilizerOwner("6374", to18("0.001"), "0");
      await mockBeanstalk.connect(owner).addFertilizerOwner("6274", to18("0.001"), "0");
      await mockBeanstalk.connect(owner).addFertilizerOwner("9000", to18("0.001"), "0");
      await mockBeanstalk.connect(owner).addFertilizerOwner("6174", to18("0.001"), "0");
      await mockBeanstalk.rewardToFertilizerE(to6("2.5"));
      await mockBeanstalk.connect(owner).addFertilizerOwner("7000", to18("0.001"), "0");
      await mockBeanstalk.connect(owner).addFertilizerOwner("0", to18("0.001"), "0");
    });

    it("properly sorts fertilizer", async function () {
      expect(await mockBeanstalk.getFirst()).to.be.equal(to6("1.2"));
      expect(await mockBeanstalk.getLast()).to.be.equal(to6("6.5"));
      expect(await mockBeanstalk.getNext(to6("1.2"))).to.be.equal(to6("1.7"));
      expect(await mockBeanstalk.getNext(to6("1.7"))).to.be.equal(to6("2"));
      expect(await mockBeanstalk.getNext(to6("2"))).to.be.equal(to6("2.5"));
      expect(await mockBeanstalk.getNext(to6("2.5"))).to.be.equal(to6("3"));
      expect(await mockBeanstalk.getNext(to6("3"))).to.be.equal(to6("6.5"));
      expect(await mockBeanstalk.getNext(to6("6.5"))).to.be.equal(0);
    });

    it("gets fertilizers", async function () {
      const fertilizers = await mockBeanstalk.getFertilizers();
      expect(`${fertilizers}`).to.be.equal(
        "1200000,2,1700000,1,2000000,1,2500000,1,3000000,1,6500000,1"
      );
    });
  });

  describe("Mint Fertilizer", async function () {
    it("Reverts if mints 0", async function () {
      await mockBeanstalk.teleportSunrise("6274");
      await expect(mockBeanstalk.connect(user).mintFertilizer("0", "0", "0")).to.be.revertedWith(
        "Fertilizer: None bought."
      );
    });

    describe("1 mint", async function () {
      beforeEach(async function () {
        await mockBeanstalk.teleportSunrise("6274");
        this.result = await mockBeanstalk.connect(user).mintFertilizer(to18("0.1"), "0", "0");
        this.lpBeans = lpBeansForUsdc("100");
      });

      it("updates totals", async function () {
        expect(await mockBeanstalk.totalUnfertilizedBeans()).to.be.equal(to6("250"));
        expect(await mockBeanstalk.getFirst()).to.be.equal(to6("2.5"));
        expect(await mockBeanstalk.getNext(to6("2.5"))).to.be.equal(0);
        expect(await mockBeanstalk.getActiveFertilizer()).to.be.equal("100");
        expect(await mockBeanstalk.isFertilizing()).to.be.equal(true);
        expect(await mockBeanstalk.remainingRecapitalization()).to.be.equal(to6("400"));
      });

      it("updates token balances", async function () {
        expect(await bean.balanceOf(mockBeanstalk.address)).to.be.equal(to6("200"));
        expect(await this.well.balanceOf(mockBeanstalk.address)).to.be.equal("2943834234463618707");

        expect(await this.barnRaiseToken.balanceOf(this.well.address)).to.be.equal(to18("0.1"));
        expect(await bean.balanceOf(this.well.address)).to.be.equal(this.lpBeans);
      });

      it("updates underlying balances", async function () {
        expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6("200"));
        expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_LP)).to.be.equal(
          await this.well.balanceOf(mockBeanstalk.address)
        );
      });

      it("updates fertizer amount", async function () {
        expect(await mockBeanstalk.getFertilizer(to6("2.5"))).to.be.equal("100");
      });

      it("mints fetilizer", async function () {
        expect(await this.fert.balanceOf(user.address, to6("2.5"))).to.be.equal("100");
        const balance = await this.fert.lastBalanceOf(user.address, to6("2.5"));
        expect(balance[0]).to.be.equal("100");
        expect(balance[1]).to.be.equal(0);
      });

      it("updates fertilizer getters", async function () {
        expect(await this.fert.remaining()).to.be.equal(to6("400"));
        expect(await this.fert.getMintId()).to.be.equal(to6("2.5"));
      });
    });

    describe("2 mints", async function () {
      beforeEach(async function () {
        await mockBeanstalk.teleportSunrise("6274");
        this.result = await mockBeanstalk.connect(user).mintFertilizer(to18("0.05"), "0", "0");
        this.result = await mockBeanstalk.connect(user).mintFertilizer(to18("0.05"), "0", "0");
        this.lpBeans = lpBeansForUsdc("100");
      });

      it("updates totals", async function () {
        expect(await mockBeanstalk.totalUnfertilizedBeans()).to.be.equal(to6("250"));
        expect(await mockBeanstalk.getFirst()).to.be.equal(to6("2.5"));
        expect(await mockBeanstalk.getNext(to6("2.5"))).to.be.equal(0);
        expect(await mockBeanstalk.getActiveFertilizer()).to.be.equal("100");
        expect(await mockBeanstalk.isFertilizing()).to.be.equal(true);
        expect(await mockBeanstalk.remainingRecapitalization()).to.be.equal(to6("400"));
      });

      it("updates token balances", async function () {
        expect(await bean.balanceOf(mockBeanstalk.address)).to.be.equal("199999999"); // Rounds down
        expect(await this.well.balanceOf(mockBeanstalk.address)).to.be.equal("2943834234463618707");

        expect(await this.barnRaiseToken.balanceOf(this.well.address)).to.be.equal(to18("0.1"));
        expect(await bean.balanceOf(this.well.address)).to.be.equal(this.lpBeans);
      });

      it("updates underlying balances", async function () {
        expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal("199999999"); // Rounds down
        expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_LP)).to.be.equal(
          await this.well.balanceOf(mockBeanstalk.address)
        );
      });

      it("updates fertizer amount", async function () {
        expect(await mockBeanstalk.getFertilizer(to6("2.5"))).to.be.equal("100");
      });

      it("mints fetilizer", async function () {
        expect(await this.fert.balanceOf(user.address, to6("2.5"))).to.be.equal("100");
        const balance = await this.fert.lastBalanceOf(user.address, to6("2.5"));
        expect(balance[0]).to.be.equal("100");
        expect(balance[1]).to.be.equal(0);
      });

      it("updates fertilizer getters", async function () {
        expect(await this.fert.remaining()).to.be.equal(to6("400"));
        expect(await this.fert.getMintId()).to.be.equal(to6("2.5"));
      });
    });

    describe("2 mint with season in between", async function () {
      beforeEach(async function () {
        await mockBeanstalk.teleportSunrise("6074");
        await mockBeanstalk.connect(user).mintFertilizer(to18("0.1"), "0", "0");
        await mockBeanstalk.rewardToFertilizerE(to6("50"));
        await mockBeanstalk.teleportSunrise("6274");
        this.result = await mockBeanstalk.connect(user).mintFertilizer(to18("0.1"), "0", "0");
        this.lpBeans = lpBeansForUsdc("100").add(lpBeansForUsdc("100"));
      });

      it("updates totals", async function () {
        expect(await mockBeanstalk.totalFertilizerBeans()).to.be.equal(to6("600"));
        expect(await mockBeanstalk.totalFertilizedBeans()).to.be.equal(to6("50"));
        expect(await mockBeanstalk.getFirst()).to.be.equal(to6("3"));
        expect(await mockBeanstalk.getNext(to6("3"))).to.be.equal(to6("3.5"));
        expect(await mockBeanstalk.getActiveFertilizer()).to.be.equal("200");
        expect(await mockBeanstalk.isFertilizing()).to.be.equal(true);
        expect(await mockBeanstalk.remainingRecapitalization()).to.be.equal(to6("300"));
      });

      it("updates token balances", async function () {
        expect(await bean.balanceOf(mockBeanstalk.address)).to.be.equal(to6("450"));
        expect(await this.well.balanceOf(mockBeanstalk.address)).to.be.equal("5887668468927237414");

        expect(await this.barnRaiseToken.balanceOf(this.well.address)).to.be.equal(to18("0.2"));
        expect(await bean.balanceOf(this.well.address)).to.be.equal(this.lpBeans);
      });

      it("updates underlying balances", async function () {
        expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6("400"));
        expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_LP)).to.be.equal(
          await this.well.balanceOf(mockBeanstalk.address)
        );
      });

      it("updates fertizer amount", async function () {
        expect(await mockBeanstalk.getFertilizer(to6("3.5"))).to.be.equal("100");
        expect(await mockBeanstalk.getFertilizer(to6("3"))).to.be.equal("100");
      });

      it("mints fetilizer", async function () {
        expect(await this.fert.balanceOf(user.address, to6("3.5"))).to.be.equal("100");
        let balance = await this.fert.lastBalanceOf(user.address, to6("3.5"));
        expect(balance[0]).to.be.equal("100");
        expect(balance[1]).to.be.equal(0);
        expect(await this.fert.balanceOf(user.address, to6("3"))).to.be.equal("100");
        balance = await this.fert.lastBalanceOf(user.address, to6("3"));
        expect(balance[0]).to.be.equal("100");
        expect(balance[1]).to.be.equal(to6("0.5"));
      });

      it("updates fertilizer getters", async function () {
        expect(await this.fert.remaining()).to.be.equal(to6("300"));
        expect(await this.fert.getMintId()).to.be.equal(to6("3"));
      });
    });

    describe("2 mint with same id", async function () {
      beforeEach(async function () {
        await mockBeanstalk.teleportSunrise("6074");
        await mockBeanstalk.connect(user).mintFertilizer(to18("0.1"), "0", "0");
        await mockBeanstalk.rewardToFertilizerE(to6("50"));
        await mockBeanstalk.teleportSunrise("6174");
        this.result = await mockBeanstalk.connect(user).mintFertilizer(to18("0.1"), "0", "0");
        this.lpBeans = lpBeansForUsdc("100").add(lpBeansForUsdc("100"));
      });

      it("updates totals", async function () {
        expect(await mockBeanstalk.totalFertilizerBeans()).to.be.equal(to6("650"));
        expect(await mockBeanstalk.totalFertilizedBeans()).to.be.equal(to6("50"));
        expect(await mockBeanstalk.getFirst()).to.be.equal(to6("3.5"));
        expect(await mockBeanstalk.getNext(to6("3"))).to.be.equal(to6("0"));
        expect(await mockBeanstalk.getActiveFertilizer()).to.be.equal("200");
        expect(await mockBeanstalk.isFertilizing()).to.be.equal(true);
        expect(await mockBeanstalk.remainingRecapitalization()).to.be.equal(to6("300"));
      });

      it("updates token balances", async function () {
        expect(await bean.balanceOf(mockBeanstalk.address)).to.be.equal(to6("450"));
        expect(await this.well.balanceOf(mockBeanstalk.address)).to.be.equal("5887668468927237414");

        expect(await this.barnRaiseToken.balanceOf(this.well.address)).to.be.equal(to18("0.2"));
        expect(await bean.balanceOf(this.well.address)).to.be.equal(this.lpBeans);
      });

      it("updates underlying balances", async function () {
        expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6("400"));
        expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_LP)).to.be.equal(
          await this.well.balanceOf(mockBeanstalk.address)
        );
      });

      it("updates fertizer amount", async function () {
        expect(await mockBeanstalk.getFertilizer(to6("3.5"))).to.be.equal("200");
      });

      it("mints fetilizer", async function () {
        expect(await this.fert.balanceOf(user.address, to6("3.5"))).to.be.equal("200");
        let balance = await this.fert.lastBalanceOf(user.address, to6("3.5"));
        expect(balance[0]).to.be.equal("200");
        expect(balance[1]).to.be.equal(to6("0.5"));
      });

      it("updates fertilizer getters", async function () {
        expect(await this.fert.remaining()).to.be.equal(to6("300"));
        expect(await this.fert.getMintId()).to.be.equal(to6("3.5"));
      });

      it("updates claims fertilized Beans", async function () {
        expect(await beanstalk.getInternalBalance(user.address, bean.address)).to.be.equal(
          to6("50")
        );
      });
    });

    describe("2 mint with same id and claim", async function () {
      beforeEach(async function () {
        await mockBeanstalk.teleportSunrise("6074");
        await mockBeanstalk.connect(user).mintFertilizer(to18("0.1"), "0", "0");
        await mockBeanstalk.rewardToFertilizerE(to6("50"));
        await mockBeanstalk.teleportSunrise("6174");
        await mockBeanstalk.connect(user).claimFertilized([to6("3.5")], INTERNAL);
        this.result = await mockBeanstalk.connect(user).mintFertilizer(to18("0.1"), "0", "0");
      });

      it("updates claims fertilized Beans", async function () {
        expect(await beanstalk.getInternalBalance(user.address, bean.address)).to.be.equal(
          to6("50")
        );
      });
    });
  });

  describe("Fertilize", async function () {
    beforeEach(async function () {
      await mockBeanstalk.teleportSunrise("6274");
      this.result = await mockBeanstalk.connect(user).mintFertilizer(to18("0.1"), "0", "0");
    });

    it("gets fertilizable", async function () {
      expect(await mockBeanstalk.balanceOfFertilized(user.address, [to6("3.5")])).to.be.equal("0");
    });

    it("gets fertilizable", async function () {
      await mockBeanstalk.rewardToFertilizerE(to6("50"));
      expect(await mockBeanstalk.balanceOfFertilized(user.address, [to6("2.5")])).to.be.equal(
        to6("50")
      );
    });

    describe("no Beans", async function () {
      beforeEach(async function () {
        const beansBefore = await bean.balanceOf(mockBeanstalk.address);
        await mockBeanstalk.connect(user).claimFertilized([to6("2.5")], EXTERNAL);
        this.deltaBeanstalkBeans = (await bean.balanceOf(mockBeanstalk.address)).sub(beansBefore);
      });

      it("transfer balances", async function () {
        expect(await bean.balanceOf(user.address)).to.be.equal("0");
        expect(this.deltaBeanstalkBeans).to.be.equal("0");
      });

      it("gets balances", async function () {
        expect(await mockBeanstalk.balanceOfFertilized(user.address, [to6("2.5")])).to.be.equal(
          "0"
        );
        const f = await mockBeanstalk.balanceOfFertilizer(user.address, to6("2.5"));
        expect(f.amount).to.be.equal("100");
        expect(f.lastBpf).to.be.equal("0");
        const batchBalance = await mockBeanstalk.balanceOfBatchFertilizer(
          [user.address],
          [to6("2.5")]
        );
        expect(batchBalance[0].amount).to.be.equal("100");
        expect(batchBalance[0].lastBpf).to.be.equal("0");
      });
    });

    describe("Some Beans", async function () {
      beforeEach(async function () {
        await mockBeanstalk.rewardToFertilizerE(to6("50"));
        const beansBefore = await bean.balanceOf(mockBeanstalk.address);
        await mockBeanstalk.connect(user).claimFertilized([to6("2.5")], EXTERNAL);
        this.deltaBeanstalkBeans = (await bean.balanceOf(mockBeanstalk.address)).sub(beansBefore);
      });

      it("transfer balances", async function () {
        expect(await bean.balanceOf(user.address)).to.be.equal(to6("50"));
        expect(this.deltaBeanstalkBeans).to.be.equal(to6("-50"));
      });

      it("gets balances", async function () {
        expect(await mockBeanstalk.balanceOfFertilized(user.address, [to6("2.5")])).to.be.equal(
          "0"
        );
        const f = await mockBeanstalk.balanceOfFertilizer(user.address, to6("2.5"));
        expect(f.amount).to.be.equal("100");
        expect(f.lastBpf).to.be.equal(to6("0.5"));
        const batchBalance = await mockBeanstalk.balanceOfBatchFertilizer(
          [user.address],
          [to6("2.5")]
        );
        expect(batchBalance[0].amount).to.be.equal("100");
        expect(batchBalance[0].lastBpf).to.be.equal(to6("0.5"));
      });
    });

    describe("All Beans", async function () {
      beforeEach(async function () {
        await mockBeanstalk.rewardToFertilizerE(to6("250"));
        const beansBefore = await bean.balanceOf(mockBeanstalk.address);
        await mockBeanstalk.connect(user).claimFertilized([to6("2.5")], EXTERNAL);
        this.deltaBeanstalkBeans = (await bean.balanceOf(mockBeanstalk.address)).sub(beansBefore);
      });

      it("transfer balances", async function () {
        expect(await bean.balanceOf(user.address)).to.be.equal(to6("250"));
        expect(this.deltaBeanstalkBeans).to.be.equal(to6("-250"));
      });

      it("gets balances", async function () {
        expect(await mockBeanstalk.balanceOfFertilized(user.address, [to6("2.5")])).to.be.equal(
          "0"
        );
        expect(
          await mockBeanstalk.balanceOfUnfertilized(user.address, [to6("2.5"), to6("1.5")])
        ).to.be.equal("0");
        const f = await mockBeanstalk.balanceOfFertilizer(user.address, to6("2.5"));
        expect(f.amount).to.be.equal("100");
        expect(f.lastBpf).to.be.equal(to6("2.5"));
        const batchBalance = await mockBeanstalk.balanceOfBatchFertilizer(
          [user.address],
          [to6("2.5")]
        );
        expect(batchBalance[0].amount).to.be.equal("100");
        expect(batchBalance[0].lastBpf).to.be.equal(to6("2.5"));
      });
    });

    describe("Rest of Beans", async function () {
      beforeEach(async function () {
        await mockBeanstalk.rewardToFertilizerE(to6("200"));
        await mockBeanstalk.teleportSunrise("6474");
        this.result = await mockBeanstalk.connect(user).mintFertilizer(to18("0.1"), "0", "0");
        await mockBeanstalk.connect(user).claimFertilized([to6("2.5")], EXTERNAL);
        await mockBeanstalk.rewardToFertilizerE(to6("150"));

        const beansBefore = await bean.balanceOf(mockBeanstalk.address);
        await mockBeanstalk.connect(user).claimFertilized([to6("2.5")], EXTERNAL);
        this.deltaBeanstalkBeans = (await bean.balanceOf(mockBeanstalk.address)).sub(beansBefore);
      });

      it("transfer balances", async function () {
        expect(await bean.balanceOf(user.address)).to.be.equal(to6("250"));
        expect(this.deltaBeanstalkBeans).to.be.equal(to6("-50"));
      });

      it("gets balances", async function () {
        expect(
          await mockBeanstalk.balanceOfFertilized(user.address, [to6("2.5"), to6("3.5")])
        ).to.be.equal(to6("100"));
        expect(
          await mockBeanstalk.balanceOfUnfertilized(user.address, [to6("2.5"), to6("3.5")])
        ).to.be.equal(to6("50"));
        const batchBalance = await mockBeanstalk.balanceOfBatchFertilizer(
          [user.address, user.address],
          [to6("2.5"), to6("3.5")]
        );
        expect(batchBalance[0].amount).to.be.equal("100");
        expect(batchBalance[0].lastBpf).to.be.equal(to6("2.5"));
        expect(batchBalance[1].amount).to.be.equal("100");
        expect(batchBalance[1].lastBpf).to.be.equal(to6("2"));
      });
    });

    describe("Rest of Beans and new Fertilizer", async function () {
      beforeEach(async function () {
        await mockBeanstalk.rewardToFertilizerE(to6("200"));
        await mockBeanstalk.teleportSunrise("6474");
        this.result = await mockBeanstalk.connect(user).mintFertilizer(to18("0.1"), "0", "0");
        await mockBeanstalk.connect(user).claimFertilized([to6("2.5")], EXTERNAL);
        await mockBeanstalk.rewardToFertilizerE(to6("150"));

        const beansBefore = await bean.balanceOf(mockBeanstalk.address);
        await mockBeanstalk.connect(user).claimFertilized([to6("2.5"), to6("3.5")], EXTERNAL);
        this.deltaBeanstalkBeans = (await bean.balanceOf(mockBeanstalk.address)).sub(beansBefore);
      });

      it("transfer balances", async function () {
        expect(await bean.balanceOf(user.address)).to.be.equal(to6("350"));
        expect(this.deltaBeanstalkBeans).to.be.equal(to6("-150"));
      });

      it("gets balances", async function () {
        expect(
          await mockBeanstalk.balanceOfFertilized(user.address, [to6("2.5"), to6("3.5")])
        ).to.be.equal("0");
        expect(
          await mockBeanstalk.balanceOfUnfertilized(user.address, [to6("2.5"), to6("3.5")])
        ).to.be.equal(to6("50"));
        const batchBalance = await mockBeanstalk.balanceOfBatchFertilizer(
          [user.address, user.address],
          [to6("2.5"), to6("3.5")]
        );
        expect(batchBalance[0].amount).to.be.equal("100");
        expect(batchBalance[0].lastBpf).to.be.equal(to6("2.5"));
        expect(batchBalance[1].amount).to.be.equal("100");
        expect(batchBalance[1].lastBpf).to.be.equal(to6("3"));
      });
    });

    describe("all of both", async function () {
      beforeEach(async function () {
        await mockBeanstalk.rewardToFertilizerE(to6("200"));
        await mockBeanstalk.teleportSunrise("6474");
        this.result = await mockBeanstalk.connect(user).mintFertilizer(to18("0.1"), "0", "0");
        await mockBeanstalk.connect(user).claimFertilized([to6("2.5")], EXTERNAL);
        await mockBeanstalk.rewardToFertilizerE(to6("200"));

        const beansBefore = await bean.balanceOf(mockBeanstalk.address);
        await mockBeanstalk.connect(user).claimFertilized([to6("2.5"), to6("3.5")], EXTERNAL);
        this.deltaBeanstalkBeans = (await bean.balanceOf(mockBeanstalk.address)).sub(beansBefore);
      });

      it("transfer balances", async function () {
        expect(await bean.balanceOf(user.address)).to.be.equal(to6("400"));
        expect(this.deltaBeanstalkBeans).to.be.equal(to6("-200"));
      });

      it("gets balances", async function () {
        expect(
          await mockBeanstalk.balanceOfFertilized(user.address, [to6("2.5"), to6("3.5")])
        ).to.be.equal("0");
        expect(
          await mockBeanstalk.balanceOfUnfertilized(user.address, [to6("2.5"), to6("3.5")])
        ).to.be.equal(to6("0"));
        const batchBalance = await mockBeanstalk.balanceOfBatchFertilizer(
          [user.address, user.address],
          [to6("2.5"), to6("3.5")]
        );
        expect(batchBalance[0].amount).to.be.equal("100");
        expect(batchBalance[0].lastBpf).to.be.equal(to6("2.5"));
        expect(batchBalance[1].amount).to.be.equal("100");
        expect(batchBalance[1].lastBpf).to.be.equal(to6("3.5"));
      });
    });
  });

  describe("Transfer", async function () {
    beforeEach(async function () {
      await mockBeanstalk.teleportSunrise("6274");
      this.result = await mockBeanstalk.connect(user).mintFertilizer(to18("0.1"), "0", "0");
    });

    describe("no fertilized", async function () {
      beforeEach(async function () {
        await this.fert
          .connect(user)
          .safeTransferFrom(
            user.address,
            user2.address,
            to6("2.5"),
            "50",
            ethers.constants.HashZero
          );
      });

      it("transfers fertilizer", async function () {
        expect(await this.fert.balanceOf(user.address, to6("2.5"))).to.equal("50");
        expect(await this.fert.balanceOf(user2.address, to6("2.5"))).to.equal("50");
      });
    });

    describe("Some Beans", async function () {
      beforeEach(async function () {
        await mockBeanstalk.rewardToFertilizerE(to6("50"));
        await this.fert
          .connect(user)
          .safeTransferFrom(
            user.address,
            user2.address,
            to6("2.5"),
            "50",
            ethers.constants.HashZero
          );
      });

      it("transfer balances", async function () {
        expect(await beanstalk.getInternalBalance(user.address, BEAN)).to.be.equal(to6("50"));
        expect(await beanstalk.getInternalBalance(user2.address, BEAN)).to.be.equal(to6("0"));
      });

      it("gets balances", async function () {
        expect(await mockBeanstalk.balanceOfFertilized(user.address, [to6("2.5")])).to.be.equal(
          "0"
        );
        expect(await mockBeanstalk.balanceOfUnfertilized(user.address, [to6("2.5")])).to.be.equal(
          to6("100")
        );
        expect(await mockBeanstalk.balanceOfFertilized(user2.address, [to6("2.5")])).to.be.equal(
          "0"
        );
        expect(await mockBeanstalk.balanceOfUnfertilized(user2.address, [to6("2.5")])).to.be.equal(
          to6("100")
        );
      });

      it("transfers fertilizer", async function () {
        expect(await this.fert.balanceOf(user.address, to6("2.5"))).to.equal("50");
        expect(await this.fert.balanceOf(user2.address, to6("2.5"))).to.equal("50");
      });
    });

    describe("All Beans", async function () {
      beforeEach(async function () {
        await mockBeanstalk.rewardToFertilizerE(to6("250"));
        await this.fert
          .connect(user)
          .safeTransferFrom(
            user.address,
            user2.address,
            to6("2.5"),
            "50",
            ethers.constants.HashZero
          );
      });

      it("transfer balances", async function () {
        expect(await beanstalk.getInternalBalance(user.address, BEAN)).to.be.equal(to6("250"));
        expect(await beanstalk.getInternalBalance(user2.address, BEAN)).to.be.equal(to6("0"));
      });

      it("gets balances", async function () {
        expect(await mockBeanstalk.balanceOfFertilized(user.address, [to6("2.5")])).to.be.equal(
          "0"
        );
        expect(await mockBeanstalk.balanceOfUnfertilized(user.address, [to6("2.5")])).to.be.equal(
          to6("0")
        );
        expect(await mockBeanstalk.balanceOfFertilized(user2.address, [to6("2.5")])).to.be.equal(
          "0"
        );
        expect(await mockBeanstalk.balanceOfUnfertilized(user2.address, [to6("2.5")])).to.be.equal(
          to6("0")
        );
      });

      it("transfers fertilizer", async function () {
        expect(await this.fert.balanceOf(user.address, to6("2.5"))).to.equal("50");
        expect(await this.fert.balanceOf(user2.address, to6("2.5"))).to.equal("50");
      });
    });

    describe("Both some Beans", async function () {
      beforeEach(async function () {
        this.result = await mockBeanstalk.connect(user2).mintFertilizer(to18("0.1"), "0", "0");
        await mockBeanstalk.rewardToFertilizerE(to6("100"));
        await this.fert
          .connect(user)
          .safeTransferFrom(
            user.address,
            user2.address,
            to6("2.5"),
            "50",
            ethers.constants.HashZero
          );
      });

      it("transfer balances", async function () {
        expect(await beanstalk.getInternalBalance(user.address, BEAN)).to.be.equal(to6("50"));
        expect(await beanstalk.getInternalBalance(user2.address, BEAN)).to.be.equal(to6("50"));
      });

      it("gets balances", async function () {
        expect(await mockBeanstalk.balanceOfFertilized(user.address, [to6("2.5")])).to.be.equal(
          "0"
        );
        expect(await mockBeanstalk.balanceOfUnfertilized(user.address, [to6("2.5")])).to.be.equal(
          to6("100")
        );
        expect(await mockBeanstalk.balanceOfFertilized(user2.address, [to6("2.5")])).to.be.equal(
          "0"
        );
        expect(await mockBeanstalk.balanceOfUnfertilized(user2.address, [to6("2.5")])).to.be.equal(
          to6("300")
        );
      });

      it("transfers fertilizer", async function () {
        expect(await this.fert.balanceOf(user.address, to6("2.5"))).to.equal("50");
        expect(await this.fert.balanceOf(user2.address, to6("2.5"))).to.equal("150");
      });
    });

    describe("2 different types some Beans", async function () {
      beforeEach(async function () {
        await mockBeanstalk.rewardToFertilizerE(to6("200"));
        await mockBeanstalk.teleportSunrise("6474");
        this.result = await mockBeanstalk.connect(user).mintFertilizer(to18("0.1"), "0", "0");
        await mockBeanstalk.rewardToFertilizerE(to6("150"));
        await this.fert
          .connect(user)
          .safeBatchTransferFrom(
            user.address,
            user2.address,
            [to6("2.5"), to6("3.5")],
            ["50", "50"],
            ethers.constants.HashZero
          );
      });

      it("transfer balances", async function () {
        expect(await beanstalk.getInternalBalance(user.address, BEAN)).to.be.equal(to6("350"));
        expect(await beanstalk.getInternalBalance(user2.address, BEAN)).to.be.equal(to6("0"));
      });

      it("gets balances", async function () {
        expect(
          await mockBeanstalk.balanceOfFertilized(user.address, [to6("2.5"), to6("3.5")])
        ).to.be.equal("0");
        expect(
          await mockBeanstalk.balanceOfUnfertilized(user.address, [to6("2.5"), to6("3.5")])
        ).to.be.equal(to6("25"));
        expect(
          await mockBeanstalk.balanceOfFertilized(user2.address, [to6("2.5"), to6("3.5")])
        ).to.be.equal("0");
        expect(
          await mockBeanstalk.balanceOfUnfertilized(user2.address, [to6("2.5"), to6("3.5")])
        ).to.be.equal(to6("25"));
      });

      it("transfers fertilizer", async function () {
        let b = await this.fert.balanceOfBatch(
          [user.address, user.address, user2.address, user2.address],
          [to6("2.5"), to6("3.5"), to6("2.5"), to6("3.5")]
        );
        expect(b[0]).to.be.equal("50");
        expect(b[1]).to.be.equal("50");
        expect(b[2]).to.be.equal("50");
        expect(b[3]).to.be.equal("50");
      });
    });

    describe("Both some Beans", async function () {
      beforeEach(async function () {
        this.result = await mockBeanstalk.connect(user2).mintFertilizer(to18("0.1"), "0", "0");
        await mockBeanstalk.rewardToFertilizerE(to6("400"));
        await mockBeanstalk.teleportSunrise("6474");
        this.result = await mockBeanstalk.connect(user).mintFertilizer(to18("0.1"), "0", "0");
        this.result = await mockBeanstalk.connect(user2).mintFertilizer(to18("0.1"), "0", "0");
        await mockBeanstalk.rewardToFertilizerE(to6("300"));
        await this.fert
          .connect(user)
          .safeBatchTransferFrom(
            user.address,
            user2.address,
            [to6("2.5"), to6("3.5")],
            ["50", "50"],
            ethers.constants.HashZero
          );
      });

      it("transfer balances", async function () {
        expect(await beanstalk.getInternalBalance(user.address, BEAN)).to.be.equal(to6("350"));
        expect(await beanstalk.getInternalBalance(user2.address, BEAN)).to.be.equal(to6("350"));
      });

      it("gets balances", async function () {
        expect(
          await mockBeanstalk.balanceOfFertilized(user.address, [to6("2.5"), to6("3.5")])
        ).to.be.equal("0");
        expect(
          await mockBeanstalk.balanceOfUnfertilized(user.address, [to6("2.5"), to6("3.5")])
        ).to.be.equal(to6("25"));
        expect(
          await mockBeanstalk.balanceOfFertilized(user2.address, [to6("2.5"), to6("3.5")])
        ).to.be.equal("0");
        expect(
          await mockBeanstalk.balanceOfUnfertilized(user2.address, [to6("2.5"), to6("3.5")])
        ).to.be.equal(to6("75"));
      });

      it("transfers fertilizer", async function () {
        let b = await this.fert.balanceOfBatch(
          [user.address, user.address, user2.address, user2.address],
          [to6("2.5"), to6("3.5"), to6("2.5"), to6("3.5")]
        );
        expect(b[0]).to.be.equal("50");
        expect(b[1]).to.be.equal("50");
        expect(b[2]).to.be.equal("150");
        expect(b[3]).to.be.equal("150");
      });
    });
  });
});
