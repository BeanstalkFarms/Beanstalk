const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js');
const { readPrune, toBN, signSiloDepositTokenPermit, signSiloDepositTokensPermit } = require('../utils/index.js');
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { BEAN, THREE_POOL, BEAN_3_CURVE, UNRIPE_LP, UNRIPE_BEAN, THREE_CURVE } = require('./utils/constants.js');
const { to18, to6, toStalk, toBean } = require('./utils/helpers.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { time, mineUpTo, mine } = require("@nomicfoundation/hardhat-network-helpers");
const ZERO_BYTES = ethers.utils.formatBytes32String('0x0')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

let pru;

function pruneToStalk(value) {
  return prune(value).mul(toBN('10000'))
}

function prune(value) {
  return toBN(value).mul(toBN(pru)).div(to18('1'))
}

describe('Whitelist', function () {
  before(async function () {
    pru = await readPrune();
    [owner,user,user2,flashLoanExploiter] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    flashLoanExploiterAddress = flashLoanExploiter.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
    this.whitelist = await ethers.getContractAt('WhitelistFacet', this.diamond.address);
    this.bdv = await ethers.getContractAt('BDVFacet', this.diamond.address);

    const SiloToken = await ethers.getContractFactory("MockToken");
    this.siloToken = await SiloToken.deploy("Silo", "SILO")
    await this.siloToken.deployed()
  })


  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  it('reverts if not owner', async function () {
    await expect(this.whitelist.connect(user).whitelistTokenWithEncodeType(
      this.siloToken.address,
      this.bdv.interface.getSighash('wellBdv'),
      1,
      1,
      0
    )).to.revertedWith('LibDiamond: Must be contract or owner');
  });

  it('reverts if invalid selector', async function () {
    await expect(this.whitelist.connect(owner).whitelistTokenWithEncodeType(
      this.siloToken.address,
      '0x12345678',
      1,
      1,
      1
    )).to.revertedWith('Whitelist: Invalid selector');
  });

  it('reverts if already whitelisted', async function () {
    this.whitelist.connect(owner).whitelistTokenWithEncodeType(
      this.siloToken.address,
      this.bdv.interface.getSighash('beanToBDV'),
      1,
      1,
      1
    )


    await expect(this.whitelist.connect(owner).whitelistTokenWithEncodeType(
      this.siloToken.address,
      this.bdv.interface.getSighash('beanToBDV'),
      1,
      1,
      1
    )).to.revertedWith('Whitelist: Token already whitelisted');
  });

  it('reverts if wrong encode type', async function () {
    await expect(this.whitelist.connect(owner).whitelistTokenWithEncodeType(
      this.siloToken.address,
      this.bdv.interface.getSighash('wellBdv'),
      1,
      1,
      2
    )).to.revertedWith('Silo: Invalid encodeType');
  });

});