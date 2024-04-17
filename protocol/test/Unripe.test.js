const { expect } = require('chai')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { deploy } = require('../scripts/deploy.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot")
const { BEAN, UNRIPE_BEAN, UNRIPE_LP, USDT } = require('./utils/constants')
const { to6, to18, toStalk } = require('./utils/helpers.js')
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
    this.fertilizer = await ethers.getContractAt('MockFertilizerFacet', this.diamond.address)
    this.token = await ethers.getContractAt('TokenFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('MockToken', BEAN)
    await this.bean.connect(owner).approve(this.diamond.address, to6('100000000'))
    this.unripeBean = await ethers.getContractAt('MockToken', UNRIPE_BEAN)
    this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP)
    // await this.unripeLP.mint(userAddress, to6('1000'))
    await this.unripeLP.connect(user).approve(this.diamond.address, to6('100000000'))
    // await this.unripeBean.mint(userAddress, to6('1000'))
    await this.unripeBean.connect(user).approve(this.diamond.address, to6('100000000'))
    await this.fertilizer.setFertilizerE(true, to6('10000'))
    await this.unripe.addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES)
    await this.unripe.addUnripeToken(UNRIPE_LP, BEAN, ZERO_BYTES)
    await this.bean.mint(ownerAddress, to6('200'))

    await this.season.siloSunrise(0)
  })

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  })

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  })

  it('reverts on non-unripe address', async function () {
    await expect(this.unripe.getPenalty(this.bean.address)).to.be.reverted;
    await expect(this.unripe.getRecapFundedPercent(this.bean.address)).to.be.reverted;
  })

  it('getters', async function () {
    expect(await this.unripe.getRecapPaidPercent()).to.be.equal('0')
    expect(await this.unripe.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal('0')
    expect(await this.unripe.getPenalty(UNRIPE_BEAN)).to.be.equal(to6('0'))
    expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal('0')
    expect(await this.unripe.isUnripe(UNRIPE_BEAN)).to.be.equal(true)
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
      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_LP,
        to6('100')
      )
      await this.fertilizer.connect(owner).setPenaltyParams(to6('100'), to6('0'))
    })

    it('getters', async function () {
      expect(await this.unripe.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal(to6('0.1'))
      expect(await this.unripe.getPenalty(UNRIPE_BEAN)).to.be.equal(to6('0.01'))
      expect(await this.unripe.getPenalizedUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal(to6('0.01'));
      expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('100'))
      expect(await this.unripe.isUnripe(UNRIPE_BEAN)).to.be.equal(true)
      expect(await this.unripe.getUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal(to6('0.1'))
      expect(await this.unripe.balanceOfUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('100'))
      expect(await this.unripe.balanceOfPenalizedUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('10'))
    })

    it('gets percents', async function () {
      expect(await this.unripe.getRecapPaidPercent()).to.be.equal('0')
      expect(await this.unripe.getRecapFundedPercent(UNRIPE_BEAN)).to.be.equal(to6('0.1'))
      expect(await this.unripe.getRecapFundedPercent(UNRIPE_LP)).to.be.equal(to6('0.188459'))
      expect(await this.unripe.getPercentPenalty(UNRIPE_BEAN)).to.be.equal(to6('0.01'))
      expect(await this.unripe.getPercentPenalty(UNRIPE_LP)).to.be.equal(to6('0.01'))
    })
  })

  describe('change penalty params but penalty affected only by recapitalization ', async function () {
    beforeEach(async function () {
      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6('100')
      )
      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_LP,
        to6('100')
      )
      await this.fertilizer.connect(owner).setPenaltyParams(to6('100'), to6('100'))
    })

    it('getters', async function () {
      expect(await this.unripe.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal(to6('0.1'))
      expect(await this.unripe.getPenalty(UNRIPE_BEAN)).to.be.equal(to6('0.01'))
      expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('100'))
      expect(await this.unripe.isUnripe(UNRIPE_BEAN)).to.be.equal(true)
      expect(await this.unripe.getPenalizedUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal(to6('0.01'));
      expect(await this.unripe.getUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal(to6('0.1'))
      expect(await this.unripe.balanceOfUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('100'))
      expect(await this.unripe.balanceOfPenalizedUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('10'))
    })

    it('gets percents', async function () {
      expect(await this.unripe.getRecapPaidPercent()).to.be.equal(to6('0.01'))
      expect(await this.unripe.getRecapFundedPercent(UNRIPE_BEAN)).to.be.equal(to6('0.1'))
      expect(await this.unripe.getRecapFundedPercent(UNRIPE_LP)).to.be.equal(to6('0.188459'))
      expect(await this.unripe.getPercentPenalty(UNRIPE_BEAN)).to.be.equal(to6('0.01'))
      expect(await this.unripe.getPercentPenalty(UNRIPE_LP)).to.be.equal(to6('0.01'))
    })
  })

  //////////////////////////////////////////////////////////////
  // Example 2: balanceOfUnderlying Max ≠ Unripe Total Supply, balanceOfUnderlying < 100 

  // When all fertilizer is sold, balanceOfUnderlying is 50 tokens (totalusdneeded = 50)
  // Total Supply of unripe is 100. Assume 1 Fertilizer increases balanceOfUnderlying by 1 token.
  // If 50% of Fertilizer is sold, balanceOfUnderlying should be 25.
  // We want the user to redeem 50%^2 = 25% of their total amount.
  // If the entire supply was chopped. They should get 12.5 tokens.

  describe('chop balanceOfUnderlying Max ≠ Unripe Total Supply, balanceOfUnderlying < 100', async function () {
    beforeEach(async function () {
      // we need total dollars needed to be 50 * 1e6
      // but totalDollarsneeded = dollarPerUnripeLP * C.unripeLP().totalSupply() / DECIMALS
      // 50 * 1e6 = 530618 * supply / 1e6
      // solve for supply --> we get 94229747,200434211 --> round to 94229747 / 1e6 = to6(94.229747) --> round to nearest usdc = 94.23
      await this.unripeLP.mint(userAddress, to6('95'))
      // unripe bean supply == 100
      await this.unripeBean.mint(userAddress, to6('100'))
      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6('25') // balanceOfUnderlying is 25
      )
     //(50% of Fertilizer is sold, balanceOfUnderlying=25.) s.recapitalized, s.fertilized
      await this.fertilizer.connect(owner).setPenaltyParams(to6('25'), to6('100'))
      // user chops the whole unripe bean supply
      this.result = await this.unripe.connect(user).chop(UNRIPE_BEAN, to6('100'), EXTERNAL, EXTERNAL)
    })

    // it('getters', async function () {
    //   // s.fertilizedIndex.mul(amount).div(s.unfertilizedIndex);
    //   expect(await this.unripe.getRecapPaidPercent()).to.be.equal(to6('0.01'))
    //   // this divides by total supply so ---> "SafeMath: division by zero" when chop amount == total supply
    //   expect(await this.unripe.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal('100090')
    //   expect(await this.unripe.getPenalty(UNRIPE_BEAN)).to.be.equal(to6('0.010018'))
    //   expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('99.99'))
    //   expect(await this.unripe.isUnripe(UNRIPE_BEAN)).to.be.equal(true)
    //   expect(await this.unripe.getPenalizedUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal(to6('0.010018'))
    //   expect(await this.unripe.getUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal(to6('0.10009'))
    //   expect(await this.unripe.balanceOfUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('99.99'))
    //   expect(await this.unripe.balanceOfPenalizedUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('10.008008'))
    // })

    it('changes balaces', async function () {
      // expect(await this.unripeBean.balanceOf(userAddress)).to.be.equal(to6('900'))
      expect(await this.bean.balanceOf(userAddress)).to.be.equal(to6('12.5'));
      // expect(await this.unripeBean.totalSupply()).to.be.equal(to6('999'));
      // expect(await this.bean.balanceOf(this.unripe.address)).to.be.equal(to6('99.99'))
    })

    it('emits an event', async function () {
      await expect(this.result).to.emit(this.unripe, 'Chop').withArgs(
        user.address,
        UNRIPE_BEAN,
        to6('100'),
        to6('12.5')
      )
    })
  })


  // ### Example 3: balanceOfUnderlying Max ≠ Unripe Total Supply, TotalSupply > 100
  // When all fertilizer is sold, balanceOfUnderlying is 100 tokens.
  // Total Supply of unripe is 200. Assume 1 Fertilizer increases balanceOfUnderlying by 1 token.
  // If 50% of Fertilizer is sold, balanceOfUnderlying should be 50. 
  // We want the user to redeem 50%^2 = 25% of their total amount.
  //  If the entire supply was chopped. They should get 12.5 tokens.

  describe.only('chop balanceOfUnderlying Max ≠ Unripe Total Supply, TotalSupply > 100', async function () {
    beforeEach(async function () {
      // we need total dollars needed to be 50 * 1e6
      // but totalDollarsneeded = dollarPerUnripeLP * C.unripeLP().totalSupply() / DECIMALS
      // we need total dollars needed to be 100 * 1e6
      // solve for supply --> we get 188459494,4 --> round to nearest usdc = 189
      await this.unripeLP.mint(userAddress, to6('189'))
      // unripe bean supply == 200
      await this.unripeBean.mint(userAddress, to6('200'))
      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6('50') // balanceOfUnderlying is 50
      )                         
                                    // s.recapitalized=50, getTotalDollarsNeeded = 100
     // we want the user to redeem 50% = totalusdraised/totalusdneeded = 50/100 = 0.5
     //(50% of Fertilizer is sold, balanceOfUnderlying=25.) s.recapitalized, s.fertilized
      await this.fertilizer.connect(owner).setPenaltyParams(to6('50'), to6('100'))
      // user chops the whole unripe bean supply
      this.result = await this.unripe.connect(user).chop(UNRIPE_BEAN, to6('200'), EXTERNAL, EXTERNAL)
    })

    it('getters', async function () {
      // these divide by total supply so ---> "SafeMath: division by zero" when chop amount == total supply
      // expect(await this.unripe.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal(to6('0.1'))
      // expect(await this.unripe.getPenalty(UNRIPE_BEAN)).to.be.equal(to6('0.0625'))
      // expect(await this.unripe.getPenalizedUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal(to6('0.0625'))
      // expect(await this.unripe.getUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal(to6('0.0625'))
      // expect(await this.unripe.balanceOfUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('0'))
      // expect(await this.unripe.balanceOfPenalizedUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('0'))
      
      // s.fertilizedIndex.mul(amount).div(s.unfertilizedIndex);
      expect(await this.unripe.getRecapPaidPercent()).to.be.equal(to6('0.01'))
      expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('37.5'))
      expect(await this.unripe.isUnripe(UNRIPE_BEAN)).to.be.equal(true)
    })

    it('changes balaces', async function () {
      expect(await this.unripeBean.balanceOf(userAddress)).to.be.equal(to6('0'))
      expect(await this.bean.balanceOf(userAddress)).to.be.equal(to6('12.5'));
      expect(await this.unripeBean.totalSupply()).to.be.equal(to6('0'));
      // 50 underlying at the start - 12.5 redeemed = 37.5
      expect(await this.bean.balanceOf(this.unripe.address)).to.be.equal(to6('37.5'))
    })

    it('emits an event', async function () {
      await expect(this.result).to.emit(this.unripe, 'Chop').withArgs(
        user.address,
        UNRIPE_BEAN,
        to6('200'),
        to6('12.5')
      )
    })
  })

  //////////////////////////////////////////


  describe('chop', async function () {
    beforeEach(async function () {
      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6('100')
      )
      await this.fertilizer.connect(owner).setPenaltyParams(to6('100'), to6('100'))
      await this.token.connect(user).transferToken(
        UNRIPE_BEAN,
        user.address,
        to6('1'),
        EXTERNAL,
        INTERNAL
    )
    this.result = await this.unripe.connect(user).chop(UNRIPE_BEAN, to6('10'), INTERNAL_TOLERANT, EXTERNAL)
    })

    it('getters', async function () {
      expect(await this.unripe.getRecapPaidPercent()).to.be.equal(to6('0.01'))
      expect(await this.unripe.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal('100090')
      expect(await this.unripe.getPenalty(UNRIPE_BEAN)).to.be.equal(to6('0.010018'))
      expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('99.99'))
      expect(await this.unripe.isUnripe(UNRIPE_BEAN)).to.be.equal(true)
      expect(await this.unripe.getPenalizedUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal(to6('0.010018'))
      expect(await this.unripe.getUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal(to6('0.10009'))
      expect(await this.unripe.balanceOfUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('99.99'))
      expect(await this.unripe.balanceOfPenalizedUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('10.008008'))
    })

    it('changes balaces', async function () {
      expect(await this.unripeBean.balanceOf(userAddress)).to.be.equal(to6('999'))
      expect(await this.bean.balanceOf(userAddress)).to.be.equal(to6('0.01'))
      expect(await this.unripeBean.totalSupply()).to.be.equal(to6('999'))
      expect(await this.bean.balanceOf(this.unripe.address)).to.be.equal(to6('99.99'))
    })

    it('emits an event', async function () {
      await expect(this.result).to.emit(this.unripe, 'Chop').withArgs(
        user.address,
        UNRIPE_BEAN,
        to6('1'),
        to6('0.01')
      )
    })
  })

  describe('change underlying', async function () {
    it('changes underlying token', async function () {
      this.result = await this.unripe.connect(owner).switchUnderlyingToken(UNRIPE_BEAN, USDT)
      expect(await this.unripe.getUnderlyingToken(UNRIPE_BEAN)).to.be.equal(USDT)
      await expect(this.result).to.emit(this.unripe, 'SwitchUnderlyingToken').withArgs(
        UNRIPE_BEAN,
        USDT
      )
    })

    it('reverts if underlying balance > 0', async function () {
      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6('100')
      )
      await expect(this.unripe.connect(owner).switchUnderlyingToken(UNRIPE_BEAN, USDT)).to.be.revertedWith('Unripe: Underlying balance > 0')
    })

    it('reverts if not owner', async function () {
      await expect(this.unripe.connect(user).switchUnderlyingToken(UNRIPE_BEAN, USDT)).to.be.revertedWith('LibDiamond: Must be contract owner')
    })
  })
})