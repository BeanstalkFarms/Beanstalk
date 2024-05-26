const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { getBeanstalk, getBean, getUsdc } = require("../utils/contracts.js");
const { toBN, encodeAdvancedData } = require("../utils/index.js");
const { impersonateSigner } = require("../utils/signer.js");
const { INTERNAL } = require("./utils/balances.js");
const {
  WETH,
  ZERO_ADDRESS,
  PIPELINE
} = require("./utils/constants.js");
const { to6, to18 } = require("./utils/helpers.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

let user, user2, owner;

let timestamp;

async function getTimestamp() {
  return (await ethers.provider.getBlock("latest")).timestamp;
}

async function getTimepassed() {
  return ethers.BigNumber.from(`${(await getTimestamp()) - timestamp}`);
}

// TODO: make sure this gets fixed, seems to have broken in the tractor branch
describe.skip('Farm Advanced', function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();

    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    beanstalk = await getBeanstalk(contracts.beanstalkDiamond.address);
    bean = await getBean();
    this.usdc = await getUsdc();
    this.weth = await ethers.getContractAt("MockWETH", WETH);
    pipeline = await ethers.getContractAt("Pipeline", PIPELINE);
    this.mockContract = await (await ethers.getContractFactory("MockContract", owner)).deploy();
    await this.mockContract.deployed();
    await this.mockContract.setAccount(user2.address);
    await bean.mint(user.address, to6("1000"));
    await this.usdc.mint(user.address, to6("1000"));
    await bean.connect(user).approve(beanstalk.address, to18("1"));
    await this.usdc.connect(user).approve(beanstalk.address, to18("1"));
    await bean.connect(user).approve(beanstalk.address, "100000000000");
    await bean.mint(user.address, to6("10000"));
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  it("reverts if non-existent type", async function () {
    selector = beanstalk.interface.encodeFunctionData("sunrise", []);
    data = encodeAdvancedData(9);
    await expect(beanstalk.connect(user).advancedFarm([[selector, data]])).to.be.revertedWith(
      "Clipboard: Type not supported"
    );
  });

  describe("1 Return data", async function () {
    beforeEach(async function () {
      await beanstalk.connect(user).transferToken(bean.address, user.address, to6("100"), 0, 1);
      selector = beanstalk.interface.encodeFunctionData("getInternalBalance", [
        user.address,
        bean.address
      ]);
      data = encodeAdvancedData(0);
      selector2 = beanstalk.interface.encodeFunctionData("transferToken", [
        bean.address,
        user2.address,
        to6("0"),
        1,
        1
      ]);
      // [read from 0th return value, copy from 32nd byte result, paste starting from 100th byte]
      data2 = encodeAdvancedData(1, (value = to6("0")), [0, 32, 100]);
      await beanstalk.connect(user).advancedFarm([
        [selector, data],
        [selector2, data2]
      ]);
    });

    it("Transfers Beans to user internal", async function () {
      expect(await beanstalk.getInternalBalance(user.address, bean.address)).to.be.equal(toBN("0"));
      expect(await beanstalk.getInternalBalance(user2.address, bean.address)).to.be.equal(
        to6("100")
      );
    });
  });

  describe("Multiple return data", async function () {
    beforeEach(async function () {
      await beanstalk.connect(user).transferToken(bean.address, user.address, to6("100"), 0, 1);
      selector = beanstalk.interface.encodeFunctionData("getInternalBalance", [
        user.address,
        bean.address
      ]);
      pipe = this.mockContract.interface.encodeFunctionData("getAccount", []);
      selector2 = beanstalk.interface.encodeFunctionData("readPipe", [
        [this.mockContract.address, pipe]
      ]);
      data12 = encodeAdvancedData(0);
      selector3 = beanstalk.interface.encodeFunctionData("transferToken", [
        bean.address,
        ZERO_ADDRESS,
        to6("0"),
        1,
        1
      ]);
      data3 = encodeAdvancedData(2, toBN("0"), [
        [0, 32, 100],
        [1, 96, 68]
      ]);
      await beanstalk.connect(user).advancedFarm([
        [selector, data12],
        [selector2, data12],
        [selector3, data3]
      ]);
    });

    it("Transfers Beans to user internal", async function () {
      expect(await beanstalk.getInternalBalance(user.address, bean.address)).to.be.equal(toBN("0"));
      expect(await beanstalk.getInternalBalance(user2.address, bean.address)).to.be.equal(
        to6("100")
      );
    });
  });
});
