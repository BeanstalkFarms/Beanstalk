const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { EXTERNAL } = require("./utils/balances.js");
const {
  BEAN,
  THREE_CURVE,
  THREE_POOL,
  BEAN_3_CURVE,
  UNRIPE_BEAN,
  UNRIPE_LP,
} = require("./utils/constants");
const { ConvertEncoder } = require("./utils/encoder.js");
const { to6, to18, toBean, toStalk } = require("./utils/helpers.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const {
  getBlueprintHash,
  signBlueprint,
  getNormalBlueprintData,
  getAdvancedBlueprintData,
  generateCalldataCopyParams,
} = require("./utils/tractor.js");
const ZERO_BYTES = ethers.utils.formatBytes32String("0x0");
let user, user2, user3, owner;
let userAddress, ownerAddress, user2Address;

describe("Unripe Convert Tractor", function () {
  before(async function () {
    [owner, user, user2, user3] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.tractor = await ethers.getContractAt(
      "TractorFacet",
      this.diamond.address
    );
    this.season = await ethers.getContractAt(
      "MockSeasonFacet",
      this.diamond.address
    );
    this.diamondLoupeFacet = await ethers.getContractAt(
      "DiamondLoupeFacet",
      this.diamond.address
    );
    this.silo = await ethers.getContractAt("SiloFacet", this.diamond.address);
    this.convert = await ethers.getContractAt(
      "ConvertFacet",
      this.diamond.address
    );
    this.bean = await ethers.getContractAt("MockToken", BEAN);
    this.threePool = await ethers.getContractAt("Mock3Curve", THREE_POOL);
    this.threeCurve = await ethers.getContractAt("MockToken", THREE_CURVE);
    this.beanMetapool = await ethers.getContractAt(
      "IMockCurvePool",
      BEAN_3_CURVE
    );

    await this.threeCurve.mint(userAddress, to18("100000"));
    await this.threePool.set_virtual_price(to18("1"));
    await this.threeCurve
      .connect(user)
      .approve(this.beanMetapool.address, to18("100000000000"));

    await this.beanMetapool
      .connect(user)
      .approve(this.threeCurve.address, to18("100000000000"));
    await this.beanMetapool
      .connect(user)
      .approve(this.silo.address, to18("100000000000"));

    await this.season.siloSunrise(0);
    await this.bean.mint(userAddress, toBean("1000000000"));
    await this.bean.mint(user2Address, toBean("1000000000"));
    await this.bean
      .connect(user)
      .approve(this.beanMetapool.address, to18("100000000000"));
    await this.bean
      .connect(user2)
      .approve(this.beanMetapool.address, to18("100000000000"));
    await this.bean.connect(user).approve(this.silo.address, "100000000000");
    await this.bean.connect(user2).approve(this.silo.address, "100000000000");
    await this.beanMetapool
      .connect(user)
      .add_liquidity([toBean("1000"), to18("1000")], to18("2000"));
    await this.beanMetapool.connect(user).transfer(ownerAddress, to18("1000"));

    this.unripe = await ethers.getContractAt(
      "MockUnripeFacet",
      this.diamond.address
    );
    this.unripeBean = await ethers.getContractAt("MockToken", UNRIPE_BEAN);
    this.unripeLP = await ethers.getContractAt("MockToken", UNRIPE_LP);
    this.fertilizer = await ethers.getContractAt(
      "MockFertilizerFacet",
      this.diamond.address
    );
    await this.unripeBean.mint(userAddress, to6("10000"));
    await this.unripeLP.mint(userAddress, to6("9422.960000"));
    await this.unripeBean
      .connect(user)
      .approve(this.diamond.address, to18("100000000"));
    await this.unripeLP
      .connect(user)
      .approve(this.diamond.address, to18("100000000"));
    await this.fertilizer.setFertilizerE(true, to6("10000"));
    await this.unripe.addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES);
    await this.unripe.addUnripeToken(UNRIPE_LP, BEAN_3_CURVE, ZERO_BYTES);
    await this.bean.mint(ownerAddress, to6("5000"));
    await this.bean.approve(this.diamond.address, to6("5000"));
    await this.beanMetapool.approve(this.diamond.address, to18("10000"));
    await this.fertilizer.setPenaltyParams(to6("500"), "0");
    await this.unripe.connect(owner).addUnderlying(UNRIPE_BEAN, to6("1000"));
    await this.unripe
      .connect(owner)
      .addUnderlying(UNRIPE_LP, to18("942.2960000"));
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("convert beans to lp", async function () {
    beforeEach(async function () {
      await this.silo
        .connect(user)
        .deposit(this.unripeBean.address, to6("1000"), EXTERNAL);
      await this.season.siloSunrise(0);
      await this.season.siloSunrise(0);
      await this.season.siloSunrise(0);
      await this.season.siloSunrise(0);
      await this.silo
        .connect(user)
        .deposit(this.unripeBean.address, to6("1000"), EXTERNAL);
      await this.beanMetapool
        .connect(user)
        .add_liquidity([toBean("0"), to18("200")], to18("150"));

      const convert = await this.convert.interface.encodeFunctionData(
        "tractorConvert",
        [
          ConvertEncoder.convertUnripeBeansToLP(to6("2500"), to6("1900")),
          ["2", "6"],
          [to6("1000"), to6("1000")],
        ]
      );

      const blueprint = {
        publisher: userAddress,
        data: getNormalBlueprintData([convert]),
        calldataCopyParams: [],
        maxNonce: 100,
        startTime: Math.floor(Date.now() / 1000) - 10 * 3600,
        endTime: Math.floor(Date.now() / 1000) + 10 * 3600,
      };

      await signBlueprint(blueprint, user);

      this.result = await this.tractor.connect(user3).tractor(blueprint, "0x");
    });

    it("properly updates total values", async function () {
      expect(await this.silo.getTotalDeposited(this.unripeBean.address)).to.eq(
        to18("0")
      );
      expect(await this.silo.getTotalDeposited(this.unripeLP.address)).to.eq(
        "2008324306"
      );
      expect(await this.silo.totalSeeds()).to.eq(toBean("800"));
      expect(await this.silo.balanceOfStalk(userAddress)).to.eq(
        toStalk("200.08")
      );
    });

    it("properly updates user values", async function () {
      expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(toBean("800"));
      expect(await this.silo.balanceOfStalk(userAddress)).to.eq(
        toStalk("200.08")
      );
    });

    it("properly updates user deposits", async function () {
      expect(
        (await this.silo.getDeposit(userAddress, this.unripeBean.address, 2))[0]
      ).to.eq(toBean("0"));
      expect(
        (await this.silo.getDeposit(userAddress, this.unripeBean.address, 6))[0]
      ).to.eq(toBean("0"));
      const deposit = await this.silo.getDeposit(
        userAddress,
        this.unripeLP.address,
        5
      );
      expect(deposit[0]).to.eq("2008324306");
      expect(deposit[1]).to.eq(toBean("200"));
    });

    it("emits events", async function () {
      await expect(this.result)
        .to.emit(this.silo, "RemoveDeposits")
        .withArgs(
          userAddress,
          this.unripeBean.address,
          [2, 6],
          [to6("1000"), to6("1000")],
          to6("2000")
        );
      await expect(this.result)
        .to.emit(this.silo, "AddDeposit")
        .withArgs(
          userAddress,
          this.unripeLP.address,
          5,
          "2008324306",
          toBean("200")
        );
    });
  });
});
