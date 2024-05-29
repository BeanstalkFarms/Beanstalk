const { expect } = require("chai");
const { EXTERNAL, INTERNAL, INTERNAL_TOLERANT } = require("./utils/balances.js");
const { deploy } = require("../scripts/deploy.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { BEAN, UNRIPE_BEAN, UNRIPE_LP, USDT, ZERO_BYTES } = require("./utils/constants");
const { to6 } = require("./utils/helpers.js");
const { getAllBeanstalkContracts } = require("../utils/contracts");

let user, user2, owner;

describe("Unripe", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();

    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    bean = await ethers.getContractAt("MockToken", BEAN);
    await bean.connect(owner).approve(this.diamond.address, to6("100000000"));

    this.unripeBean = await ethers.getContractAt("MockToken", UNRIPE_BEAN);
    this.unripeLP = await ethers.getContractAt("MockToken", UNRIPE_LP);
    await this.unripeLP.mint(user.address, to6("1000"));
    await this.unripeLP.connect(user).approve(this.diamond.address, to6("100000000"));
    await this.unripeBean.mint(user.address, to6("1000"));
    await this.unripeBean.connect(user).approve(this.diamond.address, to6("100000000"));
    await mockBeanstalk.setFertilizerE(true, to6("10000"));
    await mockBeanstalk.addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES);
    await bean.mint(ownerAddress, to6("100"));

    await mockBeanstalk.siloSunrise(0);
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  it("reverts on non-unripe address", async function () {
    await expect(mockBeanstalk.getPenalty(bean.address)).to.be.reverted;
    await expect(mockBeanstalk.getRecapFundedPercent(bean.address)).to.be.reverted;
  });

  it("getters", async function () {
    expect(await mockBeanstalk.getRecapPaidPercent()).to.be.equal("0");
    expect(await mockBeanstalk.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal("0");
    expect(await mockBeanstalk.getPenalty(UNRIPE_BEAN)).to.be.equal(to6("0"));
    expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal("0");
    expect(await mockBeanstalk.isUnripe(UNRIPE_BEAN)).to.be.equal(true);
    expect(await mockBeanstalk.getPenalizedUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal("0");
    expect(await mockBeanstalk.getUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal("0");
    expect(await mockBeanstalk.balanceOfUnderlying(UNRIPE_BEAN, user.address)).to.be.equal("0");
  });

  describe("deposit underlying", async function () {
    beforeEach(async function () {
      await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_BEAN, to6("100"));
      await mockBeanstalk.connect(owner).setPenaltyParams(to6("100"), to6("0"));
    });

    it("getters", async function () {
      expect(await mockBeanstalk.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal(to6("0.1"));
      expect(await mockBeanstalk.getPenalty(UNRIPE_BEAN)).to.be.equal(to6("0"));
      expect(await mockBeanstalk.getPenalizedUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal("0");
      expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6("100"));
      expect(await mockBeanstalk.isUnripe(UNRIPE_BEAN)).to.be.equal(true);
      expect(await mockBeanstalk.getUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal(to6("0.1"));
      expect(await mockBeanstalk.balanceOfUnderlying(UNRIPE_BEAN, user.address)).to.be.equal(
        to6("100")
      );
      expect(
        await mockBeanstalk.balanceOfPenalizedUnderlying(UNRIPE_BEAN, user.address)
      ).to.be.equal("0");
    });

    it("gets percents", async function () {
      expect(await mockBeanstalk.getRecapPaidPercent()).to.be.equal("0");
      expect(await mockBeanstalk.getRecapFundedPercent(UNRIPE_BEAN)).to.be.equal(to6("0.1"));
      expect(await mockBeanstalk.getRecapFundedPercent(UNRIPE_LP)).to.be.equal(to6("0.188459"));
      expect(await mockBeanstalk.getPercentPenalty(UNRIPE_BEAN)).to.be.equal(to6("0"));
      expect(await mockBeanstalk.getPercentPenalty(UNRIPE_LP)).to.be.equal(to6("0"));
    });
  });

  describe("penalty go down", async function () {
    beforeEach(async function () {
      await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_BEAN, to6("100"));
      await mockBeanstalk.connect(owner).setPenaltyParams(to6("100"), to6("100"));
    });

    it("getters", async function () {
      expect(await mockBeanstalk.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal(to6("0.1"));
      expect(await mockBeanstalk.getPenalty(UNRIPE_BEAN)).to.be.equal(to6("0.001"));
      expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6("100"));
      expect(await mockBeanstalk.isUnripe(UNRIPE_BEAN)).to.be.equal(true);
      expect(await mockBeanstalk.getPenalizedUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal(
        to6("0.001")
      );
      expect(await mockBeanstalk.getUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal(to6("0.1"));
      expect(await mockBeanstalk.balanceOfUnderlying(UNRIPE_BEAN, user.address)).to.be.equal(
        to6("100")
      );
      expect(
        await mockBeanstalk.balanceOfPenalizedUnderlying(UNRIPE_BEAN, user.address)
      ).to.be.equal(to6("1"));
    });

    it("gets percents", async function () {
      expect(await mockBeanstalk.getRecapPaidPercent()).to.be.equal(to6("0.01"));
      expect(await mockBeanstalk.getRecapFundedPercent(UNRIPE_BEAN)).to.be.equal(to6("0.1"));
      expect(await mockBeanstalk.getRecapFundedPercent(UNRIPE_LP)).to.be.equal(to6("0.188459"));
      expect(await mockBeanstalk.getPercentPenalty(UNRIPE_BEAN)).to.be.equal(to6("0.001"));
      expect(await mockBeanstalk.getPercentPenalty(UNRIPE_LP)).to.be.equal(to6("0.001884"));
    });
  });

  describe("chop", async function () {
    beforeEach(async function () {
      await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_BEAN, to6("100"));
      await mockBeanstalk.connect(owner).setPenaltyParams(to6("100"), to6("100"));
      this.result = await mockBeanstalk
        .connect(user)
        .chop(UNRIPE_BEAN, to6("1"), EXTERNAL, EXTERNAL);
    });

    it("getters", async function () {
      expect(await mockBeanstalk.getRecapPaidPercent()).to.be.equal(to6("0.01"));
      expect(await mockBeanstalk.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal("100099");
      expect(await mockBeanstalk.getPenalty(UNRIPE_BEAN)).to.be.equal(to6("0.001"));
      expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6("99.999"));
      expect(await mockBeanstalk.isUnripe(UNRIPE_BEAN)).to.be.equal(true);
      expect(await mockBeanstalk.getPenalizedUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal(
        to6("0.001")
      );
      expect(await mockBeanstalk.getUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal(to6("0.100099"));
      expect(await mockBeanstalk.balanceOfUnderlying(UNRIPE_BEAN, user.address)).to.be.equal(
        to6("99.999")
      );
      expect(
        await mockBeanstalk.balanceOfPenalizedUnderlying(UNRIPE_BEAN, user.address)
      ).to.be.equal(to6("0.99999"));
    });

    it("changes balaces", async function () {
      expect(await this.unripeBean.balanceOf(user.address)).to.be.equal(to6("999"));
      expect(await bean.balanceOf(user.address)).to.be.equal(to6("0.001"));
      expect(await this.unripeBean.totalSupply()).to.be.equal(to6("999"));
      expect(await bean.balanceOf(mockBeanstalk.address)).to.be.equal(to6("99.999"));
    });

    it("emits an event", async function () {
      await expect(this.result)
        .to.emit(mockBeanstalk, "Chop")
        .withArgs(user.address, UNRIPE_BEAN, to6("1"), to6("0.001"));
    });
  });

  describe("chop", async function () {
    beforeEach(async function () {
      await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_BEAN, to6("100"));
      await mockBeanstalk.connect(owner).setPenaltyParams(to6("100"), to6("100"));
      await beanstalk
        .connect(user)
        .transferToken(UNRIPE_BEAN, user.address, to6("1"), EXTERNAL, INTERNAL);
      this.result = await mockBeanstalk
        .connect(user)
        .chop(UNRIPE_BEAN, to6("10"), INTERNAL_TOLERANT, EXTERNAL);
    });

    it("getters", async function () {
      expect(await mockBeanstalk.getRecapPaidPercent()).to.be.equal(to6("0.01"));
      expect(await mockBeanstalk.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal("100099");
      expect(await mockBeanstalk.getPenalty(UNRIPE_BEAN)).to.be.equal(to6("0.001"));
      expect(await mockBeanstalk.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6("99.999"));
      expect(await mockBeanstalk.isUnripe(UNRIPE_BEAN)).to.be.equal(true);
      expect(await mockBeanstalk.getPenalizedUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal(
        to6("0.001")
      );
      expect(await mockBeanstalk.getUnderlying(UNRIPE_BEAN, to6("1"))).to.be.equal(to6("0.100099"));
      expect(await mockBeanstalk.balanceOfUnderlying(UNRIPE_BEAN, user.address)).to.be.equal(
        to6("99.999")
      );
      expect(
        await mockBeanstalk.balanceOfPenalizedUnderlying(UNRIPE_BEAN, user.address)
      ).to.be.equal(to6("0.99999"));
    });

    it("changes balaces", async function () {
      expect(await this.unripeBean.balanceOf(user.address)).to.be.equal(to6("999"));
      expect(await bean.balanceOf(user.address)).to.be.equal(to6("0.001"));
      expect(await this.unripeBean.totalSupply()).to.be.equal(to6("999"));
      expect(await bean.balanceOf(mockBeanstalk.address)).to.be.equal(to6("99.999"));
    });

    it("emits an event", async function () {
      await expect(this.result)
        .to.emit(mockBeanstalk, "Chop")
        .withArgs(user.address, UNRIPE_BEAN, to6("1"), to6("0.001"));
    });
  });

  describe("change underlying", async function () {
    it("changes underlying token", async function () {
      this.result = await mockBeanstalk.connect(owner).switchUnderlyingToken(UNRIPE_BEAN, USDT);
      expect(await mockBeanstalk.getUnderlyingToken(UNRIPE_BEAN)).to.be.equal(USDT);
      await expect(this.result)
        .to.emit(mockBeanstalk, "SwitchUnderlyingToken")
        .withArgs(UNRIPE_BEAN, USDT);
    });

    it("reverts if underlying balance > 0", async function () {
      await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_BEAN, to6("100"));
      await expect(
        mockBeanstalk.connect(owner).switchUnderlyingToken(UNRIPE_BEAN, USDT)
      ).to.be.revertedWith("Unripe: Underlying balance > 0");
    });

    it("reverts if not owner", async function () {
      await expect(
        mockBeanstalk.connect(user).switchUnderlyingToken(UNRIPE_BEAN, USDT)
      ).to.be.revertedWith("LibDiamond: Must be contract owner");
    });
  });
});
