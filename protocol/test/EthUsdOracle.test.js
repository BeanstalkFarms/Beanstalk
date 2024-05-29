const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { getBeanstalk, getBean } = require("../utils/contracts.js");
const { WETH, ETH_USD_CHAINLINK_AGGREGATOR } = require("./utils/constants.js");
const { to6, to18 } = require("./utils/helpers.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { setEthUsdChainlinkPrice } = require("../utils/oracle.js");
const { getAllBeanstalkContracts } = require("../utils/contracts");

let user, user2, owner;

async function setToSecondsAfterHour(seconds = 0) {
  const lastTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
  const hourTimestamp = parseInt(lastTimestamp / 3600 + 1) * 3600 + seconds;
  await network.provider.send("evm_setNextBlockTimestamp", [hourTimestamp]);
}

describe("USD Oracle", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();
    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(contracts.beanstalkDiamond.address);

    bean = await getBean();
    await setToSecondsAfterHour(0);
    await owner.sendTransaction({ to: user.address, value: 0 });

    await setEthUsdChainlinkPrice("10000");
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  it("it gets the USD price", async function () {
    expect(await mockBeanstalk.getEthUsdPrice()).to.be.equal(to6("10000")); // About 1e14
    expect(await mockBeanstalk.getEthUsdTwap(900)).to.be.equal(to6("10000")); // About 1e14
    expect(await mockBeanstalk.getUsdPrice(WETH)).to.be.equal(to18("0.0001")); // About 1e14
  });

  it("it gets the USD TWA", async function () {
    await setEthUsdChainlinkPrice("20000", (lookback = 449));
    expect(await mockBeanstalk.getEthUsdTwap(900)).to.be.equal(to6("15000")); // About 1e14
  });

  it("Handles Chainlink Oracle Failure", async function () {
    const chainlinkAggregator = await ethers.getContractAt(
      "MockChainlinkAggregator",
      ETH_USD_CHAINLINK_AGGREGATOR
    );
    await chainlinkAggregator.setRound("1", "0", to18("1"), "0", "0");
    expect(await mockBeanstalk.getEthUsdPrice()).to.be.equal("0"); // About 1e14
    expect(await mockBeanstalk.getEthUsdTwap(900)).to.be.equal("0"); // About 1e14
    expect(await mockBeanstalk.getUsdPrice(WETH)).to.be.equal("0"); // About 1e14
  });
});
