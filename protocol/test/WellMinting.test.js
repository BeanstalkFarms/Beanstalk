const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { to18, to6 } = require('./utils/helpers.js');
const { getBeanstalk, getBean } = require('../utils/contracts.js');
const { whitelistWell, deployMockWell } = require('../utils/well.js');
const { setEthUsdPrice, setEthUsdcPrice, setEthUsdtPrice } = require('../scripts/usdOracle.js');
const { advanceTime } = require('../utils/helpers.js');
const { ETH_USD_CHAINLINK_AGGREGATOR } = require('./utils/constants.js');
let user,user2,owner;
let userAddress, ownerAddress, user2Address;

let snapshotId;

describe('Well Minting', function () {
  before(async function () {
    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.beanstalk = await getBeanstalk(this.diamond.address)
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.bean = await getBean()
    ethUsdChainlinkAggregator = await ethers.getContractAt('MockChainlinkAggregator', ETH_USD_CHAINLINK_AGGREGATOR)
    await this.bean.mint(userAddress, to18('1'));

    [this.well, this.wellFunction, this.pump] = await deployMockWell()

    await setEthUsdPrice('999.998018')
    await setEthUsdcPrice('1000')
    await setEthUsdtPrice('1000')

    await whitelistWell(this.well.address, '10000', to6('4'))

    await this.season.captureWellE(this.well.address)
  
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  it("Initializes the Well Oracle", async function () {
    const snapshot = await this.beanstalk.wellOracleSnapshot(this.well.address)
  })

  describe("Delta B = 0", async function () {
    beforeEach(async function () {
      await advanceTime(3600)
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      })
    })

    it("Captures", async function () {
      expect(await this.season.callStatic.captureWellE(this.well.address)).to.be.equal('0')
    })
  
    it("Checks", async function () {
      expect(await this.season.poolDeltaB(this.well.address)).to.be.equal('0')
    })

  })

  describe("Delta B > 0", async function () {
    beforeEach(async function () {
      await advanceTime(1800)
      await this.well.setReserves([to6('500000'), to18('1000')])
      await advanceTime(1800)
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      })
    })

    it("Captures a delta B > 0", async function () {
      expect(await this.season.callStatic.captureWellE(this.well.address)).to.be.equal('133789634067')
    })
  
    it("Checks a delta B > 0", async function () {
      expect(await this.season.poolDeltaB(this.well.address)).to.be.equal('133789634067')
    })
  })

  describe("Delta B < 0", async function () {
    beforeEach(async function () {
      await advanceTime(1800)
      await this.well.setReserves([to6('2000000'), to18('1000')])
      await advanceTime(1800)
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      })
    })

    it("Captures a delta B < 0", async function () {
      expect(await this.season.callStatic.captureWellE(this.well.address)).to.be.equal('-225006447371')
    })

    it("Checks a delta B < 0", async function () {
      expect(await this.season.poolDeltaB(this.well.address)).to.be.equal('-225006447371')
    })
  })

  describe("Beans below min", async function () {
    beforeEach(async function () {
      await this.well.setReserves([to6('1'), to18('1000')])
      await this.well.setReserves([to6('1'), to18('1000')])
      await advanceTime(3600)
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      })
    })

    it("Captures a Beans below min", async function () {
      expect(await this.season.callStatic.captureWellE(this.well.address)).to.be.equal('0')
    })

    it("Checks a Beans below min", async function () {
      expect(await this.season.poolDeltaB(this.well.address)).to.be.equal('0')
    })

  })

  describe('it reverts on broken USD Oracle', async function () {
    it("Broken Chainlink Oracle", async function () {
      await setEthUsdPrice('0')
      await advanceTime(3600)
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      })
      expect(await this.season.callStatic.captureWellE(this.well.address)).to.be.equal('0')
    })

    it("Not Enough Chainlink Oracle Rounds", async function () {
      await advanceTime(3600)
      await user.sendTransaction({
        to: beanstalk.address,
        value: 0
      })
      const block = await ethers.provider.getBlock("latest");
      await ethUsdChainlinkAggregator.setRound('1', to6('10000'), block.timestamp, block.timestamp, '1')
      expect(await this.season.callStatic.captureWellE(this.well.address)).to.be.equal('0')
    })
  })
  
})