const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL } = require('./utils/balances.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { BEAN, BARN_RAISE } = require('./utils/constants')
let user,user2,owner
let userAddress, ownerAddress, user2Address

let snapshotId

describe('Barn Raise', function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners()
    userAddress = user.address
    user2Address = user2.address
    const contracts = await deploy("Test", false, true)
    ownerAddress = contracts.account
    this.diamond = contracts.beanstalkDiamond
    this.barnRaise = await ethers.getContractAt('MockBarnRaiseFacet', this.diamond.address)
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('Bean', BEAN)
    this.brToken = await ethers.getContractAt('MockToken', BARN_RAISE)
    await this.brToken.mint(userAddress, '100')
    await this.barnRaise.setBarnRaiseE(true, '10000')
    await this.barnRaise.setBRTokens('1000')
    await this.season.rewardToBarnRaiseE('100')
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  });

  it('Verifies totals', async function () {
    expect(await this.barnRaise.totalOwedBR()).to.equal('10000')
    expect(await this.barnRaise.totalPaidBR()).to.equal('100')
    expect(await this.barnRaise.totalBrTokens()).to.equal('1000')
    expect(await this.barnRaise.barnRaising()).to.equal(true)
  })

  it('calculates earnable', async function () {
    expect(await this.barnRaise.claimableBR(userAddress)).to.equal('10');
  })

  describe("Barn Raise", async function () {
    beforeEach(async function () {
      this.result = await this.barnRaise.connect(user).claimBR(EXTERNAL);
    })

    it('updates balance', async function () {
      expect(await this.barnRaise.claimableBR(userAddress)).to.equal('0')
      expect(await this.bean.balanceOf(userAddress)).to.equal('10')
      expect(await this.bean.balanceOf(this.barnRaise.address)).to.equal('90')
      expect(await this.barnRaise.beansPerBRToken(userAddress)).to.equal(ethers.utils.parseEther('0.1'))
    })

    it('emits a ClambBarnRaise event', async function () {
      await expect(this.result).to.emit(this.barnRaise, 'ClaimBarnRaise')
          .withArgs(userAddress, '10');
    })
  })

  describe("Claim mint Claim", async function () {
    beforeEach(async function () {
      await this.barnRaise.connect(user).claimBR(EXTERNAL);
      await this.season.rewardToBarnRaiseE('99')
      await this.barnRaise.connect(user).claimBR(EXTERNAL);
    })

    it('updates balance', async function () {
      expect(await this.barnRaise.claimableBR(userAddress)).to.equal('0')
      expect(await this.bean.balanceOf(userAddress)).to.equal('19')
      expect(await this.bean.balanceOf(this.barnRaise.address)).to.equal('180')
      expect(await this.barnRaise.beansPerBRToken(userAddress)).to.equal(ethers.utils.parseEther('0.199'))
    })
  })
});