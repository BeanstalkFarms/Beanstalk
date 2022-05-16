const { expect } = require('chai')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { deploy } = require('../scripts/deploy.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot")
const { BEAN, UNRIPE_BEAN } = require('./utils/constants')
const { to18, to6, toStalk } = require('./utils/helpers.js')
const ZERO_BYTES = ethers.utils.formatBytes32String('0x0')

let user, user2, owner;
let userAddress, ownerAddress, user2Address;

describe('Unripe', function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners()
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true)
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.unripe = await ethers.getContractAt('MockUnripeFacet', this.diamond.address)
    this.barnRaise = await ethers.getContractAt('MockBarnRaiseFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('MockToken', BEAN)
    await this.bean.connect(owner).approve(this.diamond.address, to18('100000000'))

    this.unripeBean = await ethers.getContractAt('MockToken', UNRIPE_BEAN)
    await this.unripeBean.mint(userAddress, to18('1000'))
    await this.unripeBean.connect(user).approve(this.diamond.address, to18('100000000'))
    await this.barnRaise.setBarnRaiseE(true, to6('10000'))
    await this.unripe.addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES)
    await this.bean.mint(ownerAddress, to6('100'))

    await this.season.siloSunrise(0)
  })

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  })

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  })

  it('getters', async function () {
    expect(await this.unripe.getRipenPenalty()).to.be.equal('0')
    expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal('0')
    expect(await this.unripe.isUnripe(UNRIPE_BEAN)).to.be.equal(true)
    expect(await this.unripe.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal('0')
    expect(await this.unripe.getPenalizedUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal('0')
    expect(await this.unripe.getUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal('0')
    expect(await this.unripe.balanceOfUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal('0')
  })

  describe('deposit underlying', async function () {
    beforeEach(async function () {
      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6('100')
      )
    })

    it('getters', async function () {
      expect(await this.unripe.getRipenPenalty()).to.be.equal('0')
      expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('100'))
      expect(await this.unripe.isUnripe(UNRIPE_BEAN)).to.be.equal(true)
      expect(await this.unripe.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal(to6('0.1'))
      expect(await this.unripe.getPenalizedUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal('0')
      expect(await this.unripe.getUnderlying(UNRIPE_BEAN, to18('1'))).to.be.equal(to6('0.1'))
      expect(await this.unripe.balanceOfUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('100'))
      expect(await this.unripe.balanceOfPenalizedUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal('0')
    })
  })

  describe('penalty go down', async function () {
    beforeEach(async function () {
      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6('100')
      )
      await this.barnRaise.connect(owner).setBarnRaisePaidE(to6('100'))
    })

    it('getters', async function () {
      expect(await this.unripe.getRipenPenalty()).to.be.equal(ethers.utils.parseEther('0.01'))
      expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('100'))
      expect(await this.unripe.isUnripe(UNRIPE_BEAN)).to.be.equal(true)
      expect(await this.unripe.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal(to6('0.1'))
      expect(await this.unripe.getPenalizedUnderlying(UNRIPE_BEAN, to18('1'))).to.be.equal(to6('0.001'));
      expect(await this.unripe.getUnderlying(UNRIPE_BEAN, to18('1'))).to.be.equal(to6('0.1'))
      expect(await this.unripe.balanceOfUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('100'))
      expect(await this.unripe.balanceOfPenalizedUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('1'))
    })
  })

  describe('ripen', async function () {
    beforeEach(async function () {
      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6('100')
      )

      await this.barnRaise.connect(owner).setBarnRaisePaidE(to6('100'))
      await this.unripe.connect(user).ripen(UNRIPE_BEAN, to18('1'), EXTERNAL)
    })

    it('getters', async function () {
      expect(await this.unripe.getRipenPenalty()).to.be.equal(ethers.utils.parseEther('0.01'))
      expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('99.999'))
      expect(await this.unripe.isUnripe(UNRIPE_BEAN)).to.be.equal(true)
      expect(await this.unripe.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal(to6('0.100099'))
      expect(await this.unripe.getPenalizedUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal('0')
      expect(await this.unripe.getUnderlying(UNRIPE_BEAN, to18('1'))).to.be.equal(to6('0.100099'))
      expect(await this.unripe.balanceOfUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('99.999'))
      expect(await this.unripe.balanceOfPenalizedUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('0.99999'))
    })

    it('changes balaces', async function () {
      expect(await this.unripeBean.balanceOf(userAddress)).to.be.equal(to18('999'))
      expect(await this.bean.balanceOf(userAddress)).to.be.equal(to6('0.001'))
      expect(await this.unripeBean.totalSupply()).to.be.equal(to18('999'))
      expect(await this.bean.balanceOf(this.unripe.address)).to.be.equal(to6('99.999'))
    })
  })
})