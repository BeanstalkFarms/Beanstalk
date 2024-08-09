const { expect } = require("chai");
const { deploy } = require("../../scripts/deploy.js");
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require("./utils/balances.js");
const {
  BEAN,
  BEAN_ETH_WELL,
  WETH,
  MAX_UINT256,
  ZERO_ADDRESS,
  BEAN_WSTETH_WELL,
  WSTETH
} = require("./utils/constants.js");
const { to18, to6, advanceTime } = require("./utils/helpers.js");
const {
  deployMockWell,
  whitelistWell,
  deployMockWellWithMockPump
} = require("../../utils/well.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const {
  setStethEthChainlinkPrice,
  setWstethEthUniswapPrice,
  setEthUsdChainlinkPrice
} = require("../../utils/oracle.js");
const { getAllBeanstalkContracts } = require("../../utils/contracts.js");

let user, user2, owner;

describe("Sop Test Cases", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();

    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;

    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    bean = await ethers.getContractAt("Bean", BEAN);
    this.weth = await ethers.getContractAt("MockToken", WETH);

    mockBeanstalk.deployStemsUpgrade();

    await mockBeanstalk.siloSunrise(0);

    await bean.connect(user).approve(beanstalk.address, "100000000000");
    await bean.connect(user2).approve(beanstalk.address, "100000000000");
    await bean.mint(user.address, to6("10000"));
    await bean.mint(user2.address, to6("10000"));

    // init wells
    [this.well, this.wellFunction, this.pump] = await deployMockWellWithMockPump();
    await deployMockWellWithMockPump(BEAN_WSTETH_WELL, WSTETH);
    await this.well.connect(owner).approve(this.diamond.address, to18("100000000"));
    await this.well.connect(user).approve(this.diamond.address, to18("100000000"));

    // set reserves at a 1000:1 ratio.
    await this.pump.setCumulativeReserves(this.well.address, [to6("1000000"), to18("1000")]);
    await this.well.mint(ownerAddress, to18("500"));
    await this.well.mint(user.address, to18("500"));
    await mockBeanstalk.siloSunrise(0);
    await mockBeanstalk.captureWellE(this.well.address);

    await setEthUsdChainlinkPrice("1000");
    await setStethEthChainlinkPrice("1000");
    await setStethEthChainlinkPrice("1");
    await setWstethEthUniswapPrice("1");

    await this.well.setReserves([to6("1000000"), to18("1100")]);
    await this.pump.setInstantaneousReserves(this.well.address, [to6("1000000"), to18("1100")]);

    await mockBeanstalk.siloSunrise(0); // 3 -> 4
    await mockBeanstalk.siloSunrise(0); // 4 -> 5
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("consecutive floods scenarios", async function () {
    it("mowing between two consecutive floods, loses the rewards in the second flood", async function () {
      console.log("current season: ", await beanstalk.season()); // 5

      await beanstalk.connect(user).deposit(bean.address, to6("1000"), EXTERNAL);

      await mockBeanstalk.siloSunrise(0); // 5 => 6

      await beanstalk.mow(user.address, bean.address);

      // rain starts in season 7
      await mockBeanstalk.rainSunrise(); // 6 => 7

      const rain = await beanstalk.rain();
      let season = await beanstalk.time();

      // there is a flood in season 8
      await mockBeanstalk.rainSunrise(); // 7 => 8

      await beanstalk.mow(user.address, bean.address);

      const balanceOfPlentyFirst = await beanstalk
        .connect(user)
        .balanceOfPlenty(user.address, this.well.address);
      console.log("balanceOfPlentyFirst: ", balanceOfPlentyFirst);

      // Changing the reserves to have SoP rewards in the next season, otherwise deltaB would be zero
      // This is just to simulate a situation  when after the flood in season 8, still the condition of
      // P > 1 and pod rate < %5 are met, leading to another flood in the next season
      await this.well.setReserves([to6("1000000"), to18("1100")]);
      await this.pump.setInstantaneousReserves(this.well.address, [to6("1000000"), to18("1100")]);

      // there is a flood in season 9
      await mockBeanstalk.rainSunrise(); // 8 => 9

      await beanstalk.mow(user.address, bean.address);

      const balanceOfPlenty = await beanstalk
        .connect(user)
        .balanceOfPlenty(user.address, this.well.address);

      console.log("user's balanceOfPlenty: ", balanceOfPlenty);

      await beanstalk.connect(user).claimPlenty(this.well.address, EXTERNAL);
      console.log("balance: ", await this.weth.balanceOf(user.address));

      expect(await this.weth.balanceOf(user.address)).to.be.equal(balanceOfPlenty);
    });
  });

  it("mowing after two consecutive floods, gain the rewards of both floods", async function () {
    console.log("current season: ", await beanstalk.season()); // 5

    await beanstalk.connect(user).deposit(bean.address, to6("1000"), EXTERNAL);

    await mockBeanstalk.siloSunrise(0); // 5 => 6

    await beanstalk.mow(user.address, bean.address);

    // rain starts in season 7
    await mockBeanstalk.rainSunrise(); // 6 => 7

    const rain = await beanstalk.rain();
    let season = await beanstalk.time();

    // there is a flood in season 8
    await mockBeanstalk.rainSunrise(); // 7 => 8

    const balanceOfPlentyFirst = await beanstalk
      .connect(user)
      .balanceOfPlenty(user.address, this.well.address);
    console.log("balanceOfPlentyFirst: ", balanceOfPlentyFirst);

    // Changing the reserves to have SoP rewards in the next season, otherwise deltaB would be zero
    // This is just to simulate a situation  when after the flood in season 8, still the condition of
    // P > 1 and pod rate < %5 are met, leading to another flood in the next season
    await this.well.setReserves([to6("1000000"), to18("1100")]);
    await this.pump.setInstantaneousReserves(this.well.address, [to6("1000000"), to18("1100")]);

    // there is a flood in season 9
    await mockBeanstalk.rainSunrise(); // 8 => 9

    await beanstalk.mow(user.address, bean.address);

    const balanceOfPlenty = await beanstalk
      .connect(user)
      .balanceOfPlenty(user.address, this.well.address);

    console.log("user's balanceOfPlenty: ", balanceOfPlenty);

    await beanstalk.connect(user).claimPlenty(this.well.address, EXTERNAL);
    console.log("balance: ", await this.weth.balanceOf(user.address));

    expect(await this.weth.balanceOf(user.address)).to.be.equal(balanceOfPlenty);
  });
});
