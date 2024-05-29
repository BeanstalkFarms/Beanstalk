const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { getBeanstalk, getBean } = require("../utils/contracts.js");
const {
  WSTETH_ETH_UNIV3_01_POOL,
  STETH_ETH_CHAINLINK_PRICE_AGGREGATOR,
  WSTETH
} = require("./utils/constants.js");
const { to6, to18 } = require("./utils/helpers.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { toBN } = require("../utils/helpers.js");
const {
  setOracleFailure,
  setStethEthChainlinkPrice,
  setWstethEthUniswapPrice,
  setWstethStethRedemptionPrice,
  setEthUsdChainlinkPrice
} = require("../utils/oracle.js");
const { testIfRpcSet } = require("./utils/test.js");

let user, user2, owner;

async function setToSecondsAfterHour(seconds = 0) {
  const lastTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
  const hourTimestamp = parseInt(lastTimestamp / 3600 + 1) * 3600 + seconds;
  await network.provider.send("evm_setNextBlockTimestamp", [hourTimestamp]);
}

async function checkPriceWithError(price, lookback = "0", error = "100") {
  const oraclePrice =
    lookback == "0" ? await season.getWstethEthPrice() : await season.getWstethEthTwap(lookback);
  expect(oraclePrice).to.be.within(
    price.sub(toBN(error).div("2")),
    price.add(toBN(error).div("2"))
  ); // Expected Rounding error
}

describe("wStEth Oracle", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();
    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    season = await ethers.getContractAt("MockSeasonFacet", contracts.beanstalkDiamond.address);
    beanstalk = await getBeanstalk(contracts.beanstalkDiamond.address);
    bean = await getBean();
    await setToSecondsAfterHour(0);
    await owner.sendTransaction({ to: user.address, value: 0 });
    chainlinkAggregator = await ethers.getContractAt(
      "MockChainlinkAggregator",
      STETH_ETH_CHAINLINK_PRICE_AGGREGATOR
    );

    // Eth:Usd Oracle
    await setEthUsdChainlinkPrice("10000");

    // Wsteth:Usd Oracle
    await setStethEthChainlinkPrice("1");
    await setWstethEthUniswapPrice("1");
    // await setWstethStethRedemptionPrice('1')
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("wStEth:Eth Oracle", function () {
    describe("When chainlinkPrice = uniswapPrice", async function () {
      it("All prices 1", async function () {
        await checkPriceWithError(to6("1"));
        await checkPriceWithError(to6("1"), (lookback = 900));
      });

      it("When redemption rate > 1", async function () {
        await setWstethStethRedemptionPrice("2");
        await setStethEthChainlinkPrice("1.000327"); // The Uniswap Oracle cannot be exactly 2
        await setWstethEthUniswapPrice("2");
        await checkPriceWithError(to6("2"));
        await checkPriceWithError(to6("2"), (lookback = 900));
      });
    });

    describe("When chainlinkPrice >= uniswapPrice", async function () {
      it("chainlinkPrice ~= uniswapPrice", async function () {
        await setWstethStethRedemptionPrice("1.005");
        await setStethEthChainlinkPrice("0.995088"); // The Uniswap Oracle cannot be exactly 2
        await setWstethEthUniswapPrice("1.005");
        await checkPriceWithError(to6("1.0025"));
        await checkPriceWithError(to6("1.0025"), (lookback = 900));
      });

      it("chainlinkPrice >> uniswapPrice", async function () {
        await setWstethStethRedemptionPrice("1.01");
        await setStethEthChainlinkPrice("1.02"); // The Uniswap Oracle cannot be exactly 2
        await setWstethEthUniswapPrice("1.005");
        expect(await season.getWstethEthPrice()).to.be.equal("0");
        expect(await season.getWstethEthTwap("900")).to.be.equal("0");
      });
    });

    describe("When chainlinkPrice <= uniswapPrice", async function () {
      it("chainlinkPrice ~= uniswapPrice", async function () {
        await setWstethStethRedemptionPrice("1.005");
        await setStethEthChainlinkPrice("1"); // The Uniswap Oracle cannot be exactly 2
        await setWstethEthUniswapPrice("1");
        await checkPriceWithError(to6("1.0025"), (lookback = 900));
      });

      it("chainlinkPrice << uniswapPrice", async function () {
        await setWstethStethRedemptionPrice("1");
        await setStethEthChainlinkPrice("1.02"); // The Uniswap Oracle cannot be exactly 2
        await setWstethEthUniswapPrice("1");
        expect(await season.getWstethEthPrice()).to.be.equal("0");
        expect(await season.getWstethEthTwap("900")).to.be.equal("0");
      });
    });

    it("Average Steth Price > 1", async function () {
      await setStethEthChainlinkPrice("2"); // The Uniswap Oracle cannot be exactly 2
      await setWstethEthUniswapPrice("2");
      expect(await season.getWstethEthPrice()).to.be.equal(to6("1"));
      expect(await season.getWstethEthTwap("900")).to.be.equal(to6("1"));
    });

    describe("Handles Oracle Failure", async function () {
      it("Fails on Uniswap Oracle Failure", async function () {
        await setOracleFailure(true, WSTETH_ETH_UNIV3_01_POOL);
        expect(await season.getWstethEthPrice()).to.be.equal("0");
        expect(await season.getWstethEthTwap("900")).to.be.equal("0");
      });

      it("Fails on Chainlink Oracle Failure", async function () {
        await chainlinkAggregator.setRound("1", "0", to18("1"), "0", "0");
        expect(await season.getWstethEthPrice()).to.be.equal("0");
        expect(await season.getWstethEthTwap("900")).to.be.equal("0");
      });
    });
  });

  describe("wStEth:Usd Oracle", function () {
    it("returns the wStEth:Usd price", async function () {
      expect(await season.getWstethUsdPrice()).to.be.equal(to6("10000"));
      expect(await season.getWstethUsdTwap("900")).to.be.equal(to6("10000"));
    });
  });
});

testIfRpcSet("wStEth Oracle with Forking", function () {
  it("Returns correct value when forking", async function () {
    try {
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: process.env.FORKING_RPC,
              blockNumber: 19080000 //a random semi-recent block close to Grown Stalk Per Bdv pre-deployment
            }
          }
        ]
      });
    } catch (error) {
      console.log("forking error in WstethOracle");
      console.log(error);
      return;
    }

    // const MockSeasonFacet = await ethers.getContractFactory('MockSeasonFacet');
    // const season = await MockSeasonFacet.deploy({

    // });
    // await season.deployed();

    const UsdOracle = await ethers.getContractFactory("UsdOracle");
    const usdOracle = await UsdOracle.deploy();
    await usdOracle.deployed();

    expect(await usdOracle.getWstethEthPrice()).to.be.equal(to6("1.154105"));
    expect(await usdOracle.getWstethEthTwap("500000")).to.be.equal(to6("1.154095"));
    expect(await usdOracle.getWstethUsdPrice()).to.be.equal(to6("2580.422122"));
    expect(await usdOracle.getWstethUsdTwap("500000")).to.be.within(to6("2744"), to6("2745"));
    expect(await usdOracle.getUsdTokenPrice(WSTETH)).to.be.equal(to18("0.000387533493638216"));
  });
});
