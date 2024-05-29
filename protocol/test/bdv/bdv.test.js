const { expect } = require("chai");
const { deploy } = require("../../scripts/deploy.js");
const { takeSnapshot, revertToSnapshot } = require("../utils/snapshot");
const {
  BEAN,
  UNRIPE_LP,
  UNRIPE_BEAN,
  ZERO_ADDRESS,
  WETH,
  BEAN_WSTETH_WELL,
  WSTETH
} = require("../utils/constants");
const { to18, to6 } = require("../utils/helpers.js");
const {
  deployMockPump,
  getWellContractFactory,
  deployMockWellWithMockPump
} = require("../../utils/well.js");
const { getAllBeanstalkContracts } = require("../../utils/contracts.js");
const { getBean } = require("../../utils/index.js");

let user, user2, owner;

const ZERO_BYTES = ethers.utils.formatBytes32String("0x0");

let snapshotId;

describe("BDV", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();

    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    bean = await getBean();

    [this.well, this.wellFunction, this.pump] = await deployMockWellWithMockPump(
      BEAN_WSTETH_WELL,
      WSTETH
    );

    await mockBeanstalk.siloSunrise(0);
    await bean.mint(user.address, "1000000000");
    await bean.mint(ownerAddress, "1000000000");
    await this.well.connect(user).approve(beanstalk.address, "100000000000");
    await bean.connect(user).approve(beanstalk.address, "100000000000");
    await bean.connect(owner).approve(beanstalk.address, "100000000000");
    await this.well.mint(user.address, "10000");
    await this.well.mint(ownerAddress, to18("1000"));
    await this.well.approve(beanstalk.address, to18("1000"));

    this.unripeLP = await ethers.getContractAt("MockToken", UNRIPE_LP);
    await this.unripeLP.connect(user).mint(user.address, to18("10000"));
    await this.unripeLP.connect(user).approve(beanstalk.address, to18("10000"));
    await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_LP, to18("1000"));

    this.unripeBean = await ethers.getContractAt("MockToken", UNRIPE_BEAN);
    await this.unripeBean.connect(user).mint(user.address, to6("10000"));
    await this.unripeBean.connect(user).approve(beanstalk.address, to6("10000"));
    await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_BEAN, to6("1000"));
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Bean BDV", async function () {
    it("properly checks bdv", async function () {
      expect(await beanstalk.bdv(BEAN, to6("200"))).to.equal(to6("200"));
    });
  });

  describe("Unripe Bean BDV", async function () {
    it("properly checks bdv", async function () {
      expect(await beanstalk.bdv(UNRIPE_BEAN, to6("200"))).to.equal(to6("20"));
    });
  });

  describe("Unripe LP BDV", async function () {
    before(async function () {
      this.pump = await deployMockPump();

      this.wellFunction = await (await getWellContractFactory("ConstantProduct2")).deploy();
      await this.wellFunction.deployed();

      await this.well.setPumps([[this.pump.address, "0x"]]);
      await this.well.setWellFunction([this.wellFunction.address, "0x"]);
      await this.well.setTokens([BEAN, WETH]);
      await this.pump.setInstantaneousReserves(this.well.address, [to18("1"), to18("1")]);
    });

    it("properly checks bdv", async function () {
      const wellBdv = await beanstalk.bdv(this.well.address, to18("200"));
      expect(await beanstalk.unripeLPToBDV(to18("2000"))).to.eq(wellBdv);
      expect(await beanstalk.bdv(UNRIPE_LP, to18("2000"))).to.equal(wellBdv);
    });

    it("properly checks bdv", async function () {
      await this.pump.setInstantaneousReserves(this.well.address, [to18("1.02"), to18("1")]);
      const wellBdv = await beanstalk.bdv(this.well.address, to18("2"));
      expect(await beanstalk.unripeLPToBDV(to18("20"))).to.equal(wellBdv);
      expect(await beanstalk.bdv(UNRIPE_LP, to18("20"))).to.equal(wellBdv);
    });
  });

  it("reverts if not correct", async function () {
    await expect(beanstalk.bdv(ZERO_ADDRESS, to18("2000"))).to.be.revertedWith(
      "Silo: Token not whitelisted"
    );
  });
});
