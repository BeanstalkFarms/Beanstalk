const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { EXTERNAL } = require("./utils/balances.js");
const { to18, to6, advanceTime } = require("./utils/helpers.js");
const {
  BEAN,
  STABLE_FACTORY,
  BEAN_ETH_WELL,
  BEAN_WSTETH_WELL
} = require("./utils/constants.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const {
  setReserves,
  impersonateBeanWstethWell,
  impersonateBeanEthWell
} = require("../utils/well.js");
const { setEthUsdChainlinkPrice } = require("../utils/oracle.js");
const { getAllBeanstalkContracts } = require("../utils/contracts");
const fs = require("fs");

let user, user2, owner;

describe("BeanstalkPrice", function () {
  before(async function () {
    [owner, user] = await ethers.getSigners();
    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    await impersonateBeanEthWell();
    await impersonateBeanWstethWell();
    console.log("test");
    this.beanEthWell = await ethers.getContractAt("IWell", BEAN_ETH_WELL);
    this.beanWstethWell = await ethers.getContractAt("IWell", BEAN_WSTETH_WELL);
    this.wellToken = await ethers.getContractAt("IERC20", this.beanEthWell.address);
    bean = await ethers.getContractAt("MockToken", BEAN);
    await bean.mint(user.address, to6("10000000000"));
    await bean.mint(ownerAddress, to6("1000000000"));
    await this.wellToken.connect(owner).approve(beanstalk.address, ethers.constants.MaxUint256);
    await bean.connect(owner).approve(beanstalk.address, ethers.constants.MaxUint256);
    // set reserves of bean eth and bean wsteth wells.
    await setReserves(owner, this.beanEthWell, [to6("1000000"), to18("1000")]);
    await setReserves(owner, this.beanWstethWell, [to6("1000000"), to18("1000")]);
    await setEthUsdChainlinkPrice("1000");

    const BeanstalkPrice = await ethers.getContractFactory("BeanstalkPrice");
    const _beanstalkPrice = await BeanstalkPrice.deploy(beanstalk.address);
    await _beanstalkPrice.deployed();
    this.beanstalkPrice = await ethers.getContractAt("BeanstalkPrice", _beanstalkPrice.address);
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Price", async function () {
    it("deltaB = 0", async function () {
      const p = await this.beanstalkPrice.price();
      // price is within +/- 1 due to rounding
      expect(p.price).to.equal("999999");
      expect(p.liquidity).to.equal("1999998000000");
      expect(p.deltaB).to.be.eq("0");
    });

    it("deltaB > 0, wells only", async function () {
      await advanceTime(1800);
      await setReserves(owner, this.beanEthWell, [to6("500000"), to18("1000")]);
      await advanceTime(1800);
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      });

      const p = await this.beanstalkPrice.price();
      const w = await this.beanstalkPrice.getConstantProductWell(this.beanEthWell.address);

      expect(p.price).to.equal("1999996");
      expect(p.liquidity).to.equal("1999996000000");
      expect(p.deltaB).to.equal("207106781186");

      expect(w.price).to.equal("1999996");
      expect(w.liquidity).to.equal("1999996000000");
      expect(w.deltaB).to.equal("207106781186");
    });

    it("deltaB < 0, wells only", async function () {
      await advanceTime(1800);
      await setReserves(owner, this.beanEthWell, [to6("2000000"), to18("1000")]);
      await advanceTime(1800);
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      });

      const p = await this.beanstalkPrice.price();
      const w = await this.beanstalkPrice.getConstantProductWell(this.beanEthWell.address);

      expect(p.price).to.equal("499999");
      expect(p.liquidity).to.equal("1999996000000");
      expect(p.deltaB).to.equal("-585786437627");

      expect(w.price).to.equal("499999");
      expect(w.liquidity).to.equal("1999996000000");
      expect(w.deltaB).to.equal("-585786437627");
    });
  });
});
