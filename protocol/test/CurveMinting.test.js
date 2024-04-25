const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { THREE_POOL, BEAN_3_CURVE, BEAN } = require("./utils/constants");
const { to6, to18 } = require("./utils/helpers.js");
let user, user2, owner;

let lastTimestamp;
let timestamp;

async function resetTime() {
  timestamp = lastTimestamp + 100000000;
  lastTimestamp = timestamp;
  await hre.network.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [timestamp]
  });
}

async function advanceTime(time) {
  timestamp += time;
  await hre.network.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [timestamp]
  });
}

// with bean:3crv dewhitelisted, many of the tests here will fail.
describe.skip("Oracle", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();

    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    bean = await getBean();

    await mockBeanstalk.siloSunrise(0);

    lastTimestamp = 1700000000;

    this.threePool = await ethers.getContractAt("Mock3Curve", THREE_POOL);
    await this.threePool.set_virtual_price(to18("1"));
    this.beanThreeCurve = await ethers.getContractAt("MockMeta3Curve", BEAN_3_CURVE);
    await this.beanThreeCurve.set_supply("100000");
    await this.beanThreeCurve.set_A_precise("1000");
    await this.beanThreeCurve.set_balances([to6("1000000"), to18("1000000")]);
    await bean.mint(user2.address, to6("1000000000"));
  });

  beforeEach(async function () {
    await beanstalk.resetState();
    await this.beanThreeCurve.set_balances([to6("1000000"), to18("1000000")]);
    await mockBeanstalk.siloSunrise(0);
    await mockBeanstalk.teleportSunrise("250");
    await resetTime();
    await beanstalk.resetPools([this.beanThreeCurve.address]);
    await resetTime();
    await beanstalk.captureCurveE();
  });

  describe("Curve", async function () {
    it("initializes the oracle", async function () {
      const o = await this.seasonGetter.curveOracle();
      expect(o.initialized).to.equal(true);
      expect(o.balances[0]).to.equal(to6("100000001000000"));
      expect(o.balances[1]).to.equal(to18("100000001000000"));
      const block = await ethers.provider.getBlock("latest");
      expect(o.timestamp).to.equal(block.timestamp);
    });

    it("tracks a basic TWAL", async function () {
      this.result = await beanstalk.updateTWAPCurveE();
      await expect(this.result)
        .to.emit(beanstalk, "UpdateTWAPs")
        .withArgs([to6("1000000"), to18("1000000")]);
    });

    it("tracks a TWAL with a change", async function () {
      await advanceTime(900);
      await this.beanThreeCurve.update([to6("2000000"), to18("1000000")]);
      await advanceTime(900);
      this.result = await beanstalk.updateTWAPCurveE();
      await expect(this.result)
        .to.emit(beanstalk, "UpdateTWAPs")
        .withArgs([ethers.utils.parseUnits("1500000", 6), ethers.utils.parseEther("1000000")]);
    });

    it("2 separate TWAL", async function () {
      await advanceTime(900);
      await this.beanThreeCurve.update([to6("2000000"), to18("1000000")]);
      await advanceTime(900);
      await this.beanThreeCurve.update([to6("1000000"), to18("1000000")]);
      await advanceTime(1800);
      this.result = await beanstalk.updateTWAPCurveE();

      await expect(this.result)
        .to.emit(beanstalk, "UpdateTWAPs")
        .withArgs([ethers.utils.parseUnits("1250000", 6), ethers.utils.parseEther("1000000")]);
      await advanceTime(900);
      await this.beanThreeCurve.update([to6("500000"), to18("1000000")]);
      await advanceTime(900);
      this.result = await beanstalk.updateTWAPCurveE();

      await expect(this.result)
        .to.emit(beanstalk, "UpdateTWAPs")
        .withArgs([to6("750000"), to18("1000000")]);
    });

    describe("above Max Delta B", async function () {
      it("tracks a basic Delta B", async function () {
        this.result = await beanstalk.captureCurveE();
        await expect(this.result).to.emit(beanstalk, "DeltaB").withArgs("0");
      });

      it("tracks a TWAL with a change", async function () {
        await advanceTime(900);
        await this.beanThreeCurve.update([to6("2000000"), to18("1000000")]);
        await advanceTime(900);
        this.result = await beanstalk.captureCurveE();
        await expect(this.result).to.emit(beanstalk, "DeltaB").withArgs("-252354675068");
      });

      it("tracks a TWAL during ramping up season", async function () {
        await mockBeanstalk.teleportSunrise("120");
        await resetTime();
        await beanstalk.captureCurveE();
        await advanceTime(900);
        await this.beanThreeCurve.update([to6("2000000"), to18("1000000")]);
        await advanceTime(900);
        this.result = await beanstalk.captureCurveE();
        await expect(this.result).to.emit(beanstalk, "DeltaB").withArgs("-252354675068");
        this.result = await beanstalk.updateTWAPCurveE();
      });

      it("tracks a TWAL with a change", async function () {
        await advanceTime(900);
        await this.beanThreeCurve.update([to6("2000000"), to18("1000000")]);
        await advanceTime(900);
        this.result = await beanstalk.captureCurveE();
        await expect(this.result).to.emit(beanstalk, "DeltaB").withArgs("-252354675068");
      });

      it("tracks a TWAL with a change", async function () {
        await advanceTime(1800);
        await this.beanThreeCurve.update([to6("2000000"), to18("2020000")]);
        await advanceTime(900);
        this.result = await beanstalk.captureCurveE();
        await expect(this.result).to.emit(beanstalk, "DeltaB").withArgs("3332955488");
      });
    });

    describe("Get Delta B", async function () {
      it("reverts if not a minting pool", async function () {
        await expect(beanstalk.poolDeltaB(BEAN)).to.be.revertedWith("Oracle: Pool not supported");
      });

      it("tracks a basic Delta B", async function () {
        await advanceTime(900);
        await hre.network.provider.send("evm_mine");
        expect(await beanstalk.poolDeltaB(BEAN_3_CURVE)).to.equal("0");
        expect(await this.seasonGetter.totalDeltaB()).to.equal("0");
      });

      it("tracks a TWAL with a change", async function () {
        await advanceTime(900);
        await this.beanThreeCurve.update([to6("2000000"), to18("1000000")]);
        await advanceTime(900);
        await hre.network.provider.send("evm_mine");
        expect(await beanstalk.poolDeltaB(BEAN_3_CURVE)).to.equal("-252354675068");
        expect(await this.seasonGetter.totalDeltaB()).to.equal("-252354675068");
      });
    });

    describe("Below max Delta B", async function () {
      beforeEach(async function () {
        await bean.connect(user2).burn(await bean.balanceOf(user2.address));
        await bean.mint(user2.address, to6("100"));
      });

      it("tracks a basic Delta B", async function () {
        this.result = await beanstalk.captureCurveE();
        await expect(this.result).to.emit(beanstalk, "DeltaB").withArgs("0");
      });

      it("tracks a TWAL with a change", async function () {
        await advanceTime(900);
        await this.beanThreeCurve.update([to6("2000000"), to18("1000000")]);
        await advanceTime(900);
        this.result = await beanstalk.captureCurveE();
        await expect(this.result).to.emit(beanstalk, "DeltaB").withArgs(to6("-1"));
      });

      it("tracks a TWAL during ramping up season", async function () {
        await bean.mint(user2.address, to6("100"));
        await mockBeanstalk.teleportSunrise("120");
        await resetTime();
        await beanstalk.captureCurveE();
        await advanceTime(900);
        await this.beanThreeCurve.update([to6("2000000"), to18("1000000")]);
        await advanceTime(900);
        this.result = await beanstalk.captureCurveE();
        await expect(this.result).to.emit(beanstalk, "DeltaB").withArgs(to6("-2"));
        this.result = await beanstalk.updateTWAPCurveE();
      });

      it("tracks a TWAL with a change", async function () {
        await bean.mint(user2.address, to6("1000"));
        await advanceTime(900);
        await this.beanThreeCurve.update([to6("2000000"), to18("1000000")]);
        await advanceTime(900);
        this.result = await beanstalk.captureCurveE();
        await expect(this.result).to.emit(beanstalk, "DeltaB").withArgs(to6("-11"));
      });

      it("tracks a TWAL with a change", async function () {
        await bean.mint(user2.address, to6("1000"));
        await advanceTime(1800);
        await this.beanThreeCurve.update([to6("2000000"), to18("2020000")]);
        await advanceTime(900);
        this.result = await beanstalk.captureCurveE();
        await expect(this.result).to.emit(beanstalk, "DeltaB").withArgs(to6("11"));
      });

      it("tracks a basic Delta B", async function () {
        await advanceTime(900);
        await hre.network.provider.send("evm_mine");
        expect(await beanstalk.poolDeltaB(BEAN_3_CURVE)).to.equal("0");
        expect(await this.seasonGetter.totalDeltaB()).to.equal("0");
      });

      it("tracks a TWAL with a change", async function () {
        await advanceTime(900);
        await this.beanThreeCurve.update([to6("2000000"), to18("1000000")]);
        await advanceTime(900);
        await hre.network.provider.send("evm_mine");
        expect(await beanstalk.poolDeltaB(BEAN_3_CURVE)).to.equal(to6("-1"));
        expect(await this.seasonGetter.totalDeltaB()).to.equal(to6("-1"));
      });
    });
  });
});
