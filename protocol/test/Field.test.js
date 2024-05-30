const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { EXTERNAL, INTERNAL, INTERNAL_TOLERANT } = require("./utils/balances.js");
const { BEAN } = require("./utils/constants");
const { to6 } = require("./utils/helpers.js");
const { MAX_UINT32, MAX_UINT256 } = require("./utils/constants.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { getAllBeanstalkContracts } = require("../utils/contracts");
const {
  initalizeUsersForToken,
  endGermination,
  addMockUnderlying,
  endGerminationWithMockToken
} = require("./utils/testHelpers.js");

// TODO
// Tests to add
// - Harvest/Sow/Read from Field that does not exist.
// - Alter Fields as owner/non-owner.

let user, user2, owner;

describe("newField", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();
    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    owner.address = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    bean = await initalizeUsersForToken(BEAN, [user, user2], to6("10000"));
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Reverts", function () {
    it("No Soil", async function () {
      await expect(beanstalk.connect(user).sow("1", "1", EXTERNAL)).to.be.revertedWith(
        "Field: Soil Slippage"
      );
    });

    it("minSoil > minBeans", async function () {
      await expect(beanstalk.connect(user).sowWithMin("0", "1", "1", EXTERNAL)).to.be.revertedWith(
        "Field: Soil Slippage"
      );
    });

    it("minTemp > temp", async function () {
      await mockBeanstalk.incrementTotalSoilE(to6("100"));
      await expect(
        beanstalk.connect(user).sowWithMin("1", to6("2"), "1", EXTERNAL)
      ).to.be.revertedWith("Field: Temperature Slippage");
    });
  });

  /**
   * @dev sowing here demonstrates how the field works below peg.
   * To see how the field works above peg, see {Morning Auction} test.
   */
  describe("Sow", async function () {
    describe("all soil", async function () {
      beforeEach(async function () {
        await mockBeanstalk.incrementTotalSoilE(to6("100"));
        this.result = await beanstalk.connect(user).sow(to6("100"), 0, EXTERNAL);
      });

      it("updates user's balance", async function () {
        expect(await bean.balanceOf(user.address)).to.eq(to6("9900"));
        expect(await beanstalk.plot(user.address, 0, 0)).to.eq(to6("101"));
      });

      it("updates total balance", async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.eq("0");
        expect(await bean.totalSupply()).to.eq(to6("19900"));
        expect(await beanstalk.totalPods(0)).to.eq(to6("101"));
        expect(await beanstalk.totalSoil()).to.eq("0");
        expect(await beanstalk.totalUnharvestable(0)).to.eq(to6("101"));
        expect(await beanstalk.podIndex(0)).to.eq(to6("101"));
        expect(await beanstalk.harvestableIndex(0)).to.eq("0");
      });

      it("emits Sow event", async function () {
        await expect(this.result)
          .to.emit(beanstalk, "Sow")
          .withArgs(user.address, 0, "0", to6("100"), to6("101"));
      });
    });

    describe("some soil", async function () {
      beforeEach(async function () {
        await mockBeanstalk.incrementTotalSoilE(to6("200"));
        this.result = await beanstalk.connect(user).sow(to6("100"), 0, EXTERNAL);
      });

      it("updates user's balance", async function () {
        expect(await bean.balanceOf(user.address)).to.eq(to6("9900"));
        expect(await beanstalk.plot(user.address, 0, 0)).to.eq(to6("101"));
      });

      it("updates total balance", async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.eq("0");
        expect(await bean.totalSupply()).to.eq(to6("19900"));
        expect(await beanstalk.totalPods(0)).to.eq(to6("101"));
        expect(await beanstalk.totalSoil()).to.eq(to6("100"));
        expect(await beanstalk.totalUnharvestable(0)).to.eq(to6("101"));
        expect(await beanstalk.podIndex(0)).to.eq(to6("101"));
        expect(await beanstalk.harvestableIndex(0)).to.eq("0");
      });

      it("emits Sow event", async function () {
        await expect(this.result)
          .to.emit(mockBeanstalk, "Sow")
          .withArgs(user.address, 0, "0", to6("100"), to6("101"));
      });
    });

    describe("some soil from internal", async function () {
      beforeEach(async function () {
        await mockBeanstalk.incrementTotalSoilE(to6("200"));
        await beanstalk
          .connect(user)
          .transferToken(bean.address, user.address, to6("100"), EXTERNAL, INTERNAL);
        this.result = await beanstalk.connect(user).sow(to6("100"), 0, INTERNAL);
      });

      it("updates user's balance", async function () {
        expect(await bean.balanceOf(user.address)).to.eq(to6("9900"));
        expect(await beanstalk.plot(user.address, 0, 0)).to.eq(to6("101"));
      });

      it("updates total balance", async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.eq("0");
        expect(await bean.totalSupply()).to.eq(to6("19900"));
        expect(await beanstalk.totalPods(0)).to.eq(to6("101"));
        expect(await beanstalk.totalSoil()).to.eq(to6("100"));
        expect(await beanstalk.totalUnharvestable(0)).to.eq(to6("101"));
        expect(await beanstalk.podIndex(0)).to.eq(to6("101"));
        expect(await beanstalk.harvestableIndex(0)).to.eq("0");
      });

      it("emits Sow event", async function () {
        await expect(this.result)
          .to.emit(mockBeanstalk, "Sow")
          .withArgs(user.address, 0, "0", to6("100"), to6("101"));
      });
    });

    describe("some soil from internal tolerant", async function () {
      beforeEach(async function () {
        await mockBeanstalk.incrementTotalSoilE(to6("200"));
        await beanstalk
          .connect(user)
          .transferToken(bean.address, user.address, to6("50"), EXTERNAL, INTERNAL);
        this.result = await beanstalk.connect(user).sow(to6("100"), 0, INTERNAL_TOLERANT);
      });

      it("updates user's balance", async function () {
        expect(await bean.balanceOf(user.address)).to.eq(to6("9950"));
        expect(await beanstalk.plot(user.address, 0, 0)).to.eq(to6("50.5"));
      });

      it("updates total balance", async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.eq("0");
        expect(await bean.totalSupply()).to.eq(to6("19950"));
        expect(await beanstalk.totalPods(0)).to.eq(to6("50.5"));
        expect(await beanstalk.totalSoil()).to.eq(to6("150"));
        expect(await beanstalk.totalUnharvestable(0)).to.eq(to6("50.5"));
        expect(await beanstalk.podIndex(0)).to.eq(to6("50.5"));
        expect(await beanstalk.harvestableIndex(0)).to.eq("0");
      });

      it("emits Sow event", async function () {
        await expect(this.result)
          .to.emit(mockBeanstalk, "Sow")
          .withArgs(user.address, 0, "0", to6("50"), to6("50.5"));
      });
    });

    describe("with min", async function () {
      beforeEach(async function () {
        await mockBeanstalk.incrementTotalSoilE(to6("100"));
        this.result = await beanstalk.connect(user).sowWithMin(to6("200"), 0, to6("100"), EXTERNAL);
      });

      it("updates user's balance", async function () {
        expect(await bean.balanceOf(user.address)).to.eq(to6("9900"));
        expect(await beanstalk.plot(user.address, 0, 0)).to.eq(to6("101"));
      });

      it("updates total balance", async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.eq("0");
        expect(await bean.totalSupply()).to.eq(to6("19900"));
        expect(await beanstalk.totalPods(0)).to.eq(to6("101"));
        expect(await beanstalk.totalSoil()).to.eq(to6("0"));
        expect(await beanstalk.totalUnharvestable(0)).to.eq(to6("101"));
        expect(await beanstalk.podIndex(0)).to.eq(to6("101"));
        expect(await beanstalk.harvestableIndex(0)).to.eq("0");
      });

      it("emits Sow event", async function () {
        await expect(this.result)
          .to.emit(mockBeanstalk, "Sow")
          .withArgs(user.address, 0, "0", to6("100"), to6("101"));
      });
    });

    describe("with min, but enough soil", async function () {
      beforeEach(async function () {
        await mockBeanstalk.incrementTotalSoilE(to6("200"));
        this.result = await beanstalk.connect(user).sowWithMin(to6("100"), 0, to6("50"), EXTERNAL);
      });

      it("updates user's balance", async function () {
        expect(await bean.balanceOf(user.address)).to.eq(to6("9900"));
        expect(await beanstalk.plot(user.address, 0, 0)).to.eq(to6("101"));
      });

      it("updates total balance", async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.eq("0");
        expect(await bean.totalSupply()).to.eq(to6("19900"));
        expect(await beanstalk.totalPods(0)).to.eq(to6("101"));
        expect(await beanstalk.totalSoil()).to.eq(to6("100"));
        expect(await beanstalk.totalUnharvestable(0)).to.eq(to6("101"));
        expect(await beanstalk.podIndex(0)).to.eq(to6("101"));
        expect(await beanstalk.harvestableIndex(0)).to.eq("0");
      });

      it("emits Sow event", async function () {
        await expect(this.result)
          .to.emit(mockBeanstalk, "Sow")
          .withArgs(user.address, 0, "0", to6("100"), to6("101"));
      });
    });

    describe("second plot", async function () {
      beforeEach(async function () {
        await mockBeanstalk.incrementTotalSoilE(to6("200"));
        this.result = await beanstalk.connect(user2).sow(to6("100"), 0, EXTERNAL);
        this.result = await beanstalk.connect(user).sow(to6("100"), 0, EXTERNAL);
      });

      it("updates user's balance", async function () {
        expect(await bean.balanceOf(user.address)).to.eq(to6("9900"));
        expect(await beanstalk.plot(user.address, 0, to6("101"))).to.eq(to6("101"));
      });

      it("updates total balance", async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.eq("0");
        expect(await bean.totalSupply()).to.eq(to6("19800"));
        expect(await beanstalk.totalPods(0)).to.eq(to6("202"));
        expect(await beanstalk.totalSoil()).to.eq(to6("0"));
        expect(await beanstalk.totalUnharvestable(0)).to.eq(to6("202"));
        expect(await beanstalk.podIndex(0)).to.eq(to6("202"));
        expect(await beanstalk.harvestableIndex(0)).to.eq("0");
      });

      it("emits Sow event", async function () {
        await expect(this.result)
          .to.emit(mockBeanstalk, "Sow")
          .withArgs(user.address, 0, to6("101"), to6("100"), to6("101"));
      });
    });
  });

  describe("Morning Auction", async function () {
    it("correctly scales up the temperature", async function () {
      let ScaleValues = [
        "1000000", // Delta = 0
        "279415312704", // Delta = 1
        "409336034395", // 2
        "494912626048", // 3
        "558830625409", // 4
        "609868162219", // 5
        "652355825780", // 6
        "688751347100", // 7
        "720584687295", // 8
        "748873234524", // 9
        "774327938752", // 10
        "797465225780", // 11
        "818672068791", // 12
        "838245938114", // 13
        "856420437864", // 14
        "873382373802", // 15
        "889283474924", // 16
        "904248660443", // 17
        "918382006208", // 18
        "931771138485", // 19
        "944490527707", // 20
        "956603996980", // 21
        "968166659804", // 22
        "979226436102", // 23
        "989825252096", // 24
        "1000000000000" // 25
      ];

      // loop from i = 0 to 25:
      initTemp = 100;
      for (let i = 0; i <= 25; i++) {
        temperature = await mockBeanstalk.mockGetMorningTemp(to6("100"), i);
        if (i == 0) {
          expect(temperature).to.be.equal(ScaleValues[i]);
        } else {
          expect(temperature).to.be.equal(ScaleValues[i] * initTemp);
        }
      }
    });

    // Above peg, beanstalk can issue a certain amount
    // of pods in order to measure soil demand.
    // this is calculated as s.sys.f.soil_inital * (s.sys.w.t + 100) .
    // Since the morning auction raises the temperature from 1% to s.sys.w.t,
    // the soil that can be issued should increase.
    // rather than increase the soil, we decrease the amount of soil
    // that is sown per bean. (during non-morning conditions, 1 bean = 1 soil)
    // ex: if morning temp is 50% of max, then 1 bean is sown for 0.5 soil
    it("decrements soil above peg", async function () {
      const morningTemperature = to6("50");
      const maxTemperature = 200;
      await mockBeanstalk.incrementTotalSoilE(to6("10"));
      // 200% temperature
      await mockBeanstalk.setMaxTemp(maxTemperature);

      expect(await beanstalk.totalSoil()).to.eq(to6("10"));
      expect(await mockBeanstalk.totalSoilAtMorningTemp(morningTemperature)).to.eq(to6("20"));
      // sow 10 beans at half the max temp:
      // max temp: 200 + 100 = 300%
      // morning temp: 50 + 100 = 150%
      await mockBeanstalk.mockSow(
        to6("10"), // beans burnt
        morningTemperature, // morning temp
        200, // max temp (note max temp is stored with 1e2 precision)
        true // above peg?
      );

      // 10 soil was sown out of 20, 50% of the initial soil was sown.
      expect(await beanstalk.totalSoil()).to.eq(to6("5"));
      expect(await mockBeanstalk.totalSoilAtMorningTemp(morningTemperature)).to.eq(to6("10"));
      // 10 * 150% = 15 pods.
      expect(await beanstalk.totalPods(0)).to.eq(to6("15"));
    });
  });

  describe("complex DPD", async function () {
    it("Does not set thisSowTime if Soil > 1", async function () {
      mockBeanstalk.setSoilE(to6("3"));
      await beanstalk.connect(user).sow(to6("1"), 0, EXTERNAL);
      const weather = await beanstalk.weather();
      expect(weather.thisSowTime).to.be.equal(parseInt(MAX_UINT32));
    });

    it("Does set thisSowTime if Soil = 1", async function () {
      mockBeanstalk.setSoilE(to6("1"));
      await beanstalk.connect(user).sow(to6("1"), 0, EXTERNAL);
      const weather = await beanstalk.weather();
      expect(weather.thisSowTime).to.be.not.equal(parseInt(MAX_UINT32));
    });

    it("Does set thisSowTime if Soil < 1", async function () {
      mockBeanstalk.setSoilE(to6("1.5"));
      await beanstalk.connect(user).sow(to6("1"), 0, EXTERNAL);
      const weather = await beanstalk.weather();
      expect(weather.thisSowTime).to.be.not.equal(parseInt(MAX_UINT32));
    });

    it("Does not set thisSowTime if Soil already < 1", async function () {
      mockBeanstalk.setSoilE(to6("1.5"));
      await beanstalk.connect(user).sow(to6("1"), 0, EXTERNAL);
      const weather = await beanstalk.weather();
      await beanstalk.connect(user).sow(to6("0.5"), 0, EXTERNAL);
      const weather2 = await beanstalk.weather();
      expect(weather2.thisSowTime).to.be.equal(weather.thisSowTime);
    });
  });

  describe("Harvest", async function () {
    beforeEach(async function () {
      await mockBeanstalk.incrementTotalSoilE(to6("200"));
      await beanstalk.connect(user).sow(to6("100"), 0, EXTERNAL);
      await beanstalk.connect(user2).sow(to6("100"), 0, EXTERNAL);
    });

    describe("Revert", async function () {
      it("reverts if plot not owned", async function () {
        await mockBeanstalk.incrementTotalHarvestableE(0, to6("101"));
        await expect(beanstalk.connect(user2).harvest(0, ["0"], EXTERNAL)).to.be.revertedWith(
          "Field: no plot"
        );
      });

      it("reverts if plot harvestable", async function () {
        await expect(beanstalk.connect(user).harvest(0, ["0"], EXTERNAL)).to.be.revertedWith(
          "Field: Plot not Harvestable"
        );
      });
    });

    describe("Full", async function () {
      beforeEach(async function () {
        await mockBeanstalk.incrementTotalHarvestableE(0, to6("101"));
        this.result = await beanstalk.connect(user).harvest(0, ["0"], EXTERNAL);
      });

      it("updates user's balance", async function () {
        expect(await bean.balanceOf(user.address)).to.eq(to6("10001"));
        expect(await beanstalk.plot(user.address, 0, to6("0"))).to.eq(to6("0"));
      });

      it("updates total balance", async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.eq("0");
        expect(await bean.totalSupply()).to.eq(to6("19901"));
        expect(await beanstalk.totalPods(0)).to.eq(to6("101"));
        expect(await beanstalk.totalSoil()).to.eq(to6("0"));
        expect(await beanstalk.totalUnharvestable(0)).to.eq(to6("101"));
        expect(await beanstalk.totalHarvestable(0)).to.eq(to6("0"));
        expect(await beanstalk.harvestableIndex(0)).to.eq(to6("101"));
        expect(await beanstalk.harvestableIndex(0)).to.eq(to6("101"));
        expect(await beanstalk.podIndex(0)).to.eq(to6("202"));
      });

      it("emits Sow event", async function () {
        await expect(this.result)
          .to.emit(mockBeanstalk, "Harvest")
          .withArgs(user.address, 0, ["0"], to6("101"));
      });
    });

    describe("Partial", async function () {
      beforeEach(async function () {
        await mockBeanstalk.incrementTotalHarvestableE(0, to6("50"));
        this.result = await beanstalk.connect(user).harvest(0, ["0"], EXTERNAL);
      });

      it("updates user's balance", async function () {
        expect(await bean.balanceOf(user.address)).to.eq(to6("9950"));
        expect(await beanstalk.plot(user.address, 0, to6("0"))).to.eq(to6("0"));
        expect(await beanstalk.plot(user.address, 0, to6("50"))).to.eq(to6("51"));
      });

      it("updates total balance", async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.eq("0");
        expect(await bean.totalSupply()).to.eq(to6("19850"));
        expect(await beanstalk.totalPods(0)).to.eq(to6("152"));
        expect(await beanstalk.totalSoil()).to.eq(to6("0"));
        expect(await beanstalk.totalHarvestable(0)).to.eq(to6("0"));
        expect(await beanstalk.totalUnharvestable(0)).to.eq(to6("152"));
        expect(await beanstalk.harvestableIndex(0)).to.eq(to6("50"));
        expect(await beanstalk.harvestableIndex(0)).to.eq(to6("50"));
        expect(await beanstalk.podIndex(0)).to.eq(to6("202"));
      });

      it("emits Sow event", async function () {
        await expect(this.result)
          .to.emit(mockBeanstalk, "Harvest")
          .withArgs(user.address, 0, ["0"], to6("50"));
      });
    });

    describe("Full With Listing", async function () {
      beforeEach(async function () {
        await mockBeanstalk.incrementTotalHarvestableE(0, to6("101"));
        this.result = await beanstalk.connect(user).createPodListing({
          lister: user.address,
          fieldId: 0,
          index: 0,
          start: 0,
          podAmount: 500,
          pricePerPod: 500000,
          maxHarvestableIndex: to6("200"),
          minFillAmount: 0,
          mode: EXTERNAL
        });
        this.result = await beanstalk.connect(user).harvest(0, ["0"], EXTERNAL);
      });

      it("updates user's balance", async function () {
        expect(await bean.balanceOf(user.address)).to.eq(to6("10001"));
        expect(await beanstalk.plot(user.address, 0, 0)).to.eq(to6("0"));
      });

      it("updates total balance", async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.eq("0");
        expect(await bean.totalSupply()).to.eq(to6("19901"));
        expect(await beanstalk.totalPods(0)).to.eq(to6("101"));
        expect(await beanstalk.totalSoil()).to.eq(to6("0"));
        expect(await beanstalk.totalUnharvestable(0)).to.eq(to6("101"));
        expect(await beanstalk.totalHarvestable(0)).to.eq(to6("0"));
        expect(await beanstalk.harvestableIndex(0)).to.eq(to6("101"));
        expect(await beanstalk.harvestableIndex(0)).to.eq(to6("101"));
        expect(await beanstalk.podIndex(0)).to.eq(to6("202"));
      });

      it("deletes", async function () {
        expect(await beanstalk.getPodListing(0, 0)).to.be.equal(ethers.constants.HashZero);
      });

      it("emits Sow event", async function () {
        await expect(this.result)
          .to.emit(mockBeanstalk, "Harvest")
          .withArgs(user.address, 0, ["0"], to6("101"));
      });
    });
  });
});

describe("twoField", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();
    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    owner.address = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    // Add and initialize Field with ID of 0.
    await mockBeanstalk.addField();
    await mockBeanstalk.incrementTotalHarvestableE(0, to6("1000"));
    await mockBeanstalk.incrementTotalPodsE(0, to6("2000"));

    // Add and initialize Field with ID of 1.
    await mockBeanstalk.addField();
    // await mockBeanstalk.incrementTotalHarvestableE(1, to6("30000"));
    // await mockBeanstalk.incrementTotalPodsE(1, to6("400000"));

    // Set active field.
    this.activeField = 1;
    mockBeanstalk.setActiveField(this.activeField, 1);

    bean = await initalizeUsersForToken(BEAN, [user, user2], to6("10000"));
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Sow", async function () {
    describe("all soil", async function () {
      beforeEach(async function () {
        await mockBeanstalk.incrementTotalSoilE(to6("100"));
        this.result = await beanstalk.connect(user).sow(to6("100"), 0, EXTERNAL);
      });

      it("updates user's balance", async function () {
        expect(await bean.balanceOf(user.address)).to.eq(to6("9900"));
        expect(await beanstalk.plot(user.address, 1, 0)).to.eq(to6("101"));
      });

      it("updates total balance", async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.eq(to6("1000"));
        expect(await bean.totalSupply()).to.eq(to6("20900"));
        expect(await beanstalk.totalPods(0)).to.eq(to6("2000"));
        expect(await beanstalk.totalPods(1)).to.eq(to6("101"));
        expect(await beanstalk.totalSoil()).to.eq("0");
        expect(await beanstalk.totalUnharvestable(0)).to.eq(to6("1000"));
        expect(await beanstalk.totalUnharvestable(1)).to.eq(to6("101"));
        expect(await beanstalk.podIndex(0)).to.eq(to6("2000"));
        expect(await beanstalk.podIndex(1)).to.eq(to6("101"));
        expect(await beanstalk.harvestableIndex(0)).to.eq(to6("1000"));
        expect(await beanstalk.harvestableIndex(1)).to.eq(to6("0"));
      });

      it("emits Sow event", async function () {
        await expect(this.result)
          .to.emit(beanstalk, "Sow")
          .withArgs(user.address, 1, "0", to6("100"), to6("101"));
      });
    });

    describe("some soil", async function () {
      beforeEach(async function () {
        await mockBeanstalk.incrementTotalSoilE(to6("200"));
        this.result = await beanstalk.connect(user).sow(to6("100"), 1, EXTERNAL);
      });

      it("updates user's balance", async function () {
        expect(await bean.balanceOf(user.address)).to.eq(to6("9900"));
        expect(await beanstalk.plot(user.address, 1, 0)).to.eq(to6("101"));
      });

      it("updates total balance", async function () {
        expect(await bean.balanceOf(beanstalk.address)).to.eq(to6("1000"));
        expect(await bean.totalSupply()).to.eq(to6("20900"));
        expect(await beanstalk.totalPods(0)).to.eq(to6("2000"));
        expect(await beanstalk.totalPods(1)).to.eq(to6("101"));
        expect(await beanstalk.totalSoil()).to.eq(to6("100"));
        expect(await beanstalk.totalUnharvestable(0)).to.eq(to6("1000"));
        expect(await beanstalk.totalUnharvestable(1)).to.eq(to6("101"));
        expect(await beanstalk.podIndex(0)).to.eq(to6("2000"));
        expect(await beanstalk.podIndex(1)).to.eq(to6("101"));
        expect(await beanstalk.harvestableIndex(0)).to.eq(to6("1000"));
        expect(await beanstalk.harvestableIndex(1)).to.eq(to6("0"));
      });

      it("emits Sow event", async function () {
        await expect(this.result)
          .to.emit(mockBeanstalk, "Sow")
          .withArgs(user.address, 1, "0", to6("100"), to6("101"));
      });
    });

    describe("Harvest", async function () {
      beforeEach(async function () {
        await mockBeanstalk.incrementTotalSoilE(to6("200"));
        await beanstalk.connect(user).sow(to6("100"), 1, EXTERNAL);
        await beanstalk.connect(user2).sow(to6("100"), 1, EXTERNAL);
      });

      describe("Revert", async function () {
        it("reverts if plot not owned", async function () {
          await mockBeanstalk.incrementTotalHarvestableE(1, to6("101"));
          await expect(beanstalk.connect(user2).harvest(1, ["0"], EXTERNAL)).to.be.revertedWith(
            "Field: no plot"
          );
        });

        it("reverts if plot not harvestable", async function () {
          await expect(beanstalk.connect(user).harvest(1, ["0"], EXTERNAL)).to.be.revertedWith(
            "Field: Plot not Harvestable"
          );
        });
      });

      describe("Full", async function () {
        beforeEach(async function () {
          await mockBeanstalk.incrementTotalHarvestableE(1, to6("101"));
          this.result = await beanstalk.connect(user).harvest(1, ["0"], EXTERNAL);
        });

        it("updates user's balance", async function () {
          expect(await bean.balanceOf(user.address)).to.eq(to6("10001"));
          expect(await beanstalk.plot(user.address, 1, to6("0"))).to.eq(to6("0"));
        });

        it("updates total balance", async function () {
          expect(await bean.balanceOf(beanstalk.address)).to.eq(to6("1000"));
          expect(await bean.totalSupply()).to.eq(to6("20901"));
          expect(await beanstalk.totalPods(0)).to.eq(to6("2000"));
          expect(await beanstalk.totalPods(1)).to.eq(to6("101"));
          expect(await beanstalk.totalSoil()).to.eq(to6("0"));
          expect(await beanstalk.totalUnharvestable(0)).to.eq(to6("1000"));
          expect(await beanstalk.totalUnharvestable(1)).to.eq(to6("101"));
          expect(await beanstalk.totalHarvestable(0)).to.eq(to6("1000"));
          expect(await beanstalk.totalHarvestable(1)).to.eq(to6("0"));
          expect(await beanstalk.harvestableIndex(0)).to.eq(to6("1000"));
          expect(await beanstalk.harvestableIndex(1)).to.eq(to6("101"));
          expect(await beanstalk.podIndex(0)).to.eq(to6("2000"));
          expect(await beanstalk.podIndex(1)).to.eq(to6("202"));
        });

        it("emits Sow event", async function () {
          await expect(this.result)
            .to.emit(mockBeanstalk, "Harvest")
            .withArgs(user.address, 1, ["0"], to6("101"));
        });
      });

      describe("Partial", async function () {
        beforeEach(async function () {
          await mockBeanstalk.incrementTotalHarvestableE(1, to6("50"));
          this.result = await beanstalk.connect(user).harvest(1, [to6("0")], EXTERNAL);
        });

        it("updates user's balance", async function () {
          expect(await bean.balanceOf(user.address)).to.eq(to6("9950"));
          expect(await beanstalk.plot(user.address, 1, to6("0"))).to.eq(to6("0"));
          expect(await beanstalk.plot(user.address, 1, to6("50"))).to.eq(to6("51"));
        });

        it("updates total balance", async function () {
          expect(await bean.balanceOf(beanstalk.address)).to.eq(to6("1000"));
          expect(await bean.totalSupply()).to.eq(to6("20850"));
          expect(await beanstalk.totalPods(0)).to.eq(to6("2000"));
          expect(await beanstalk.totalPods(1)).to.eq(to6("152"));
          expect(await beanstalk.totalSoil()).to.eq(to6("0"));
          expect(await beanstalk.totalHarvestable(0)).to.eq(to6("1000"));
          expect(await beanstalk.totalHarvestable(1)).to.eq(to6("0"));
          expect(await beanstalk.totalUnharvestable(0)).to.eq(to6("1000"));
          expect(await beanstalk.totalUnharvestable(1)).to.eq(to6("152"));
          expect(await beanstalk.harvestableIndex(0)).to.eq(to6("1000"));
          expect(await beanstalk.harvestableIndex(1)).to.eq(to6("50"));
          expect(await beanstalk.podIndex(0)).to.eq(to6("2000"));
          expect(await beanstalk.podIndex(1)).to.eq(to6("202"));
        });

        it("emits Sow event", async function () {
          await expect(this.result)
            .to.emit(mockBeanstalk, "Harvest")
            .withArgs(user.address, 1, ["0"], to6("50"));
        });
      });
    });
  });
});

// when beanstalk is above peg, and soil is
async function setSoilAndSow() {}
