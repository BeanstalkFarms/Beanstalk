const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { BEAN, BEANSTALK_PUMP, WETH } = require('./utils/constants');
const { to18, to6 } = require('./utils/helpers.js');
const { getBeanstalk, getBean } = require('../utils/contracts.js');
const { getWellContractFactory, whitelistWell, getWellContractAt } = require('../utils/well.js');
let user,user2,owner;
let userAddress, ownerAddress, user2Address;
const ZERO_BYTES = ethers.utils.formatBytes32String('0x0')

let snapshotId;

async function advanceTime(time) {
  let timestamp = (await ethers.provider.getBlock('latest')).timestamp;
  timestamp += time
  await hre.network.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [timestamp],
  });
}

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
    await this.bean.mint(userAddress, to18('1'))

    /////////////////////////////////////////////////////////////////////////////////

    // this.pump = await (await getWellContractFactory('GeoEmaAndCumSmaPump')).deploy(
    //   '0x3ffe0000000000000000000000000000', // 0.5
    //   '0x3ffd555555555555553cbcd83d925070', // 0.333333333333333333
    //   12,
    //   '0x3ffecccccccccccccccccccccccccccc' // 0.9
    // )
    // await this.pump.deployed()

    // await network.provider.send("hardhat_setCode", [
    //   BEANSTALK_PUMP,
    //   await ethers.provider.getCode(this.pump.address),
    // ]);
    // this.pump = await getWellContractAt('GeoEmaAndCumSmaPump', BEANSTALK_PUMP)

    /////////////////////////////////////////////////////////////////////////////////

    this.pump = await (await ethers.getContractFactory('MockGeoEmaAndCumSmaPump')).deploy(
      '0x3ffe0000000000000000000000000000', // 0.5
      '0x3ffd555555555555553cbcd83d925070', // 0.333333333333333333
      12,
      '0x3ffecccccccccccccccccccccccccccc' // 0.9
    )
    await this.pump.deployed()

    await network.provider.send("hardhat_setCode", [
      BEANSTALK_PUMP,
      await ethers.provider.getCode(this.pump.address),
    ]);
    this.pump = await ethers.getContractAt('MockGeoEmaAndCumSmaPump', BEANSTALK_PUMP)


    /////////////////////////////////////////////////////////////////////////////////

    this.wellFunction = await (await getWellContractFactory('ConstantProduct2')).deploy()
    await this.wellFunction.deployed()

    this.well = await (await ethers.getContractFactory('MockSetComponentsWell')).deploy()
    await this.well.deployed()

    await this.well.setPumps([[this.pump.address, '0x']])
    await this.well.setWellFunction([this.wellFunction.address, '0x'])
    await this.well.setTokens([BEAN, WETH])
    await whitelistWell(this.well.address, '10000', to6('4'))

    await this.well.setReserves([to6('1000000'), to18('1000')])

    await this.well.setReserves([to6('1000000'), to18('1000')])

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

  it("Tracks a delta B = 0", async function () {
    await advanceTime(3600)
    const result = await this.season.captureWellE(this.well.address)
    await expect(result).to.emit(this.season, 'DeltaB').withArgs('0');
  })

  it ("Tracks a delta B > 0", async function () {
    await advanceTime(1800)
    await this.well.setReserves([to6('500000'), to18('1000')])
    await advanceTime(1800)
    const result = await this.season.captureWellE(this.well.address)
    await expect(result).to.emit(this.season, 'DeltaB').withArgs('133789634067');
  })

  it ("Tracks a delta B < 0", async function () {    
    await advanceTime(1800)
    await this.well.setReserves([to6('2000000'), to18('1000')])
    await advanceTime(1800)
    const result = await this.season.captureWellE(this.well.address)
    await expect(result).to.emit(this.season, 'DeltaB').withArgs('-225006447371');
  })
  
})