const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { BEAN, THREE_POOL, BEAN_3_CURVE, UNRIPE_LP, UNRIPE_BEAN, ZERO_ADDRESS, WETH, BEANSTALK_PUMP } = require('./utils/constants');
const { to18, to6 } = require('./utils/helpers.js');
const { getBeanstalk } = require('../utils/contracts.js');
const { whitelistWell, deployMockWellWithMockPump } = require('../utils/well.js');
let user,user2,owner;
let userAddress, ownerAddress, user2Address;
const ZERO_BYTES = ethers.utils.formatBytes32String('0x0')

let snapshotId;

describe('Well BDV', function () {
  before(async function () {
    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.beanstalk = await getBeanstalk(this.diamond.address);
    this.bdv = await ethers.getContractAt('BDVFacet', this.diamond.address);

    [this.well, this.wellFunction, this.pump] = await deployMockWellWithMockPump();
    this.pump.setInstantaneousReserves([to18('1'), to18('1')])
    await whitelistWell(this.well.address, '10000', to6('4'))
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  it("get BDV at 1:1", async function () {
    expect(await this.beanstalk.wellBdv(this.well.address, to6('1000000'))).to.be.within('1999999', '2000001')
    expect(await this.bdv.wellBdv(this.well.address, to6('1000000'))).to.be.within('1999999', '2000001')
    expect(await this.beanstalk.bdv(this.well.address, to6('1000000'))).to.be.within('1999999', '2000001')
  })

  it("Gets BDV at 4:1", async function () {
    this.pump.setInstantaneousReserves([to18('4'), to18('1')])
    expect(await this.beanstalk.bdv(this.well.address, to6('1000000'))).to.be.within('3999999', '4000001')
  })

  it("Gets BDV at 1:4", async function () {
    this.pump.setInstantaneousReserves([to18('1'), to18('4')])
    expect(await this.beanstalk.bdv(this.well.address, to6('1000000'))).to.be.within('999999', '1000001')
  })

  it("Fails if balance too low", async function () {
    this.pump.setInstantaneousReserves([to6('1'), to18('1')])
    await expect(this.beanstalk.bdv(this.well.address, to6('1000000'))).to.be.revertedWith('Silo: Well Bean balance below min')
  })
})