const { expect } = require('chai')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { deploy } = require('../scripts/deploy.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot")
const { BEAN, UNRIPE_BEAN, UNRIPE_LP, USDT } = require('./utils/constants')
const { to6, to18, toStalk } = require('./utils/helpers.js')
const ZERO_BYTES = ethers.utils.formatBytes32String('0x0')

let user, user2, owner;
let userAddress, ownerAddress, user2Address;

describe.only('Unripe', function () {
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
    await this.unripeBean.mint(userAddress, to6('1000'))
    await this.unripeLP.mint(userAddress, to6('1000'))
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
      // but totalDollarsneeded = dollarPerUnripeLP * C.unripeLP().totalSupply() / DECIMALS
      // we need total dollars needed to be 100 * 1e6
      // solve for supply --> we get 188459494,4 --> round to nearest usdc = 189
      await this.unripeLP.mint(userAddress, to6('189'))
      // total supply of unripe bean == 100
      await this.unripeBean.mint(userAddress, to6('100'))

      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6('100')
      )
      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_LP,
        to6('100')
      )
      //                                                   s.recapitalized, s.feritilized
      await this.fertilizer.connect(owner).setPenaltyParams(to6('50'), to6('0'))
    })

    it('getters', async function () {
      // 100 urBeans | 100 underlying beans --> 1 urBean per 1 underlying bean ratio
      expect(await this.unripe.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal(to6('1'))
      // getPenalty calls getPenalizedUnderlying with amount = 1
      // formula: redeem = currentRipeUnderlying *  (usdValueRaised/totalUsdNeeded) * UnripeAmountIn/UnripeSupply;
      // redeem = 100 * 50 / 100 *  1 / 100 = 0.5
      expect(await this.unripe.getPenalty(UNRIPE_BEAN)).to.be.equal(to6('0.5'))
      expect(await this.unripe.getPenalizedUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal(to6('0.5'));
      expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('100'))
      expect(await this.unripe.isUnripe(UNRIPE_BEAN)).to.be.equal(true)
      expect(await this.unripe.getUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal(to6('1'))
      expect(await this.unripe.balanceOfUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('100'))
      expect(await this.unripe.balanceOfPenalizedUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('50'))
    })

    it('gets percents', async function () {
      expect(await this.unripe.getRecapPaidPercent()).to.be.equal('0')
      // 100 underlying to 100 unripe bean --> 100% funded
      expect(await this.unripe.getRecapFundedPercent(UNRIPE_BEAN)).to.be.equal(to6('1'))
      expect(await this.unripe.getRecapFundedPercent(UNRIPE_LP)).to.be.equal(to6('0.498569'))
      expect(await this.unripe.getPercentPenalty(UNRIPE_BEAN)).to.be.equal(to6('0.5'))
      expect(await this.unripe.getPercentPenalty(UNRIPE_LP)).to.be.equal(to6('0.264550'))
    })
  })


  describe('deposit underlying, change fertilizer penalty params and urBean supply', async function () {
    beforeEach(async function () {
      // but totalDollarsneeded = dollarPerUnripeLP * C.unripeLP().totalSupply() / DECIMALS
      // we need total dollars needed to be 100 * 1e6
      // solve for supply --> we get 188459494,4 --> round to nearest usdc = 189
      await this.unripeLP.mint(userAddress, to6('189'))
      // total supply of unripe bean == 1000
      await this.unripeBean.mint(userAddress, to6('1000'))

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
      // 1000 urBeans | 100 underlying beans --> 0.1 urBean per 1 underlying bean ratio
      expect(await this.unripe.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal(to6('0.1'))
      expect(await this.unripe.getPenalty(UNRIPE_BEAN)).to.be.equal(to6('0.1'))
      expect(await this.unripe.getPenalizedUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal(to6('0.1'));
      expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('100'))
      expect(await this.unripe.isUnripe(UNRIPE_BEAN)).to.be.equal(true)
      expect(await this.unripe.getUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal(to6('0.1'))
      expect(await this.unripe.balanceOfUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('100'))
      expect(await this.unripe.balanceOfPenalizedUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('100'))
    })

    it('gets percents', async function () {
      expect(await this.unripe.getRecapPaidPercent()).to.be.equal(to6('0.01'))
      expect(await this.unripe.getRecapFundedPercent(UNRIPE_BEAN)).to.be.equal(to6('0.1'))
      expect(await this.unripe.getRecapFundedPercent(UNRIPE_LP)).to.be.equal(to6('0.997138'))
      expect(await this.unripe.getPercentPenalty(UNRIPE_BEAN)).to.be.equal(to6('0.1'))
      expect(await this.unripe.getPercentPenalty(UNRIPE_LP)).to.be.equal(to6('0.529100'))
    })
  })

  //////////////////////////////////// CHOPS //////////////////////////////////////////////

  // Example 2: balanceOfUnderlying Max ≠ Unripe Total Supply, balanceOfUnderlying < 100 

  // When all fertilizer is sold, balanceOfUnderlying is 50 tokens (totalusdneeded = 50)
  // Total Supply of unripe is 100. Assume 1 Fertilizer increases balanceOfUnderlying by 1 token.
  // If 50% of Fertilizer is sold, balanceOfUnderlying should be 25.
  // We want the user to redeem 50%^2 = 25% of their total amount
  // If the entire supply was chopped. They should get 12.5 tokens.

  // formula: redeem = currentRipeUnderlying *  (usdValueRaised/totalUsdNeeded) * UnripeAmountIn/UnripeSupply;
  // redeem = 25 * 0.5 * 100/100 = 12.5
  describe('chop whole supply with balanceOfUnderlying Max ≠ Unripe Total Supply, balanceOfUnderlying < 100, fert 50% sold', async function () {
    beforeEach(async function () {
      // we need total dollars needed to be 50 * 1e6
      // but totalDollarsneeded = dollarPerUnripeLP * C.unripeLP().totalSupply() / DECIMALS
      // 50 * 1e6 = 530618 * supply / 1e6
      // solve for supply --> we get 94229747,2 --> round to nearest usdc = 95
      // (contract rounds down, thus we round up when issuing unripeLP tokens).
      await this.unripeLP.mint(userAddress, to6('95'))
      // unripe bean supply == 100
      await this.unripeBean.mint(userAddress, to6('100'))
      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6('25') // balanceOfUnderlying is 25
      )

                                        // s.recapitalized=25, getTotalDollarsNeeded = 50
      //(50% of Fertilizer is sold, balanceOfUnderlying=25.) s.recapitalized, s.fertilized
      await this.fertilizer.connect(owner).setPenaltyParams(to6('25'), to6('100'))
      // user chops the whole unripe bean supply
      this.result = await this.unripe.connect(user).chop(UNRIPE_BEAN, to6('100'), EXTERNAL, EXTERNAL)
    })

    it('getters', async function () {
      // fertilizer recapitalization is independent of the recapitalization of unripe.
      expect(await this.unripe.getRecapPaidPercent()).to.be.equal(to6('0.01'))
      
      expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('12.5'))
      expect(await this.unripe.isUnripe(UNRIPE_BEAN)).to.be.equal(true)
    })

    it('changes balances', async function () {
      expect(await this.unripeBean.balanceOf(userAddress)).to.be.equal(to6('0'))
      expect(await this.bean.balanceOf(userAddress)).to.be.equal(to6('12.5'));
      expect(await this.unripeBean.totalSupply()).to.be.equal(to6('0'));
      expect(await this.bean.balanceOf(this.unripe.address)).to.be.equal(to6('12.5'))
    })

    it('urBean chop does not affect recapitalization', async function () {
      expect(await this.unripe.getRecapitalized()).to.be.equal(to6('25'))
      expect(await this.fertilizer.remainingRecapitalization()).to.be.equal(to6('25'))
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

  // Still Example 2:

  // When all fertilizer is sold, balanceOfUnderlying is 50 tokens.
  // Total Supply of unripe is 100.
  // Assume 1 Fertilizer increases balanceOfUnderlying by 1 token.
  // If 25% of Fertilizer is sold, balanceOfUnderlying should be 12.5.
  // We want the user to redeem 25%^2 = 6.25% of their total amount
  // If the entire supply was chopped, they should get 3.125  tokens.

  // formula: redeem = currentRipeUnderlying *  (usdValueRaised/totalUsdNeeded) * UnripeAmountIn/UnripeSupply;
  // redeem = 12.5 * 0.25 * 100/100 = 3.125
  describe('chop whole supply with balanceOfUnderlying Max ≠ Unripe Total Supply, balanceOfUnderlying < 100, fert 25% sold', async function () {
    beforeEach(async function () {
      // we need total dollars needed to be 50 * 1e6
      // but totalDollarsneeded = dollarPerUnripeLP * C.unripeLP().totalSupply() / DECIMALS
      // 50 * 1e6 = 530618 * supply / 1e6
      // solve for supply --> we get 94229747,2 --> round to nearest usdc = 95
      await this.unripeLP.mint(userAddress, to6('95'))
      // unripe bean supply == 100
      await this.unripeBean.mint(userAddress, to6('100'))
      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6('12.5') // balanceOfUnderlying is 12.5
      )

                                        // s.recapitalized=12.5, getTotalDollarsNeeded = 50
     //(25% of all Fertilizer is sold, balanceOfUnderlying=12.5.) s.recapitalized, s.fertilized
      await this.fertilizer.connect(owner).setPenaltyParams(to6('12.5'), to6('100'))
      // user chops the whole unripe bean supply
      this.result = await this.unripe.connect(user).chop(UNRIPE_BEAN, to6('100'), EXTERNAL, EXTERNAL)
    })

    it('getters', async function () {
      expect(await this.unripe.getRecapPaidPercent()).to.be.equal(to6('0.01'))
      // 12.5 - 3.125 = 9.375
      expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('9.375'))
      expect(await this.unripe.isUnripe(UNRIPE_BEAN)).to.be.equal(true)
    })

    it('changes balances', async function () {
      expect(await this.unripeBean.balanceOf(userAddress)).to.be.equal(to6('0'));
      expect(await this.bean.balanceOf(userAddress)).to.be.equal(to6('3.125'));
      expect(await this.unripeBean.totalSupply()).to.be.equal(to6('0'));
      expect(await this.bean.balanceOf(this.unripe.address)).to.be.equal(to6('9.375'))
    })

    it('urBean chop does not affect recapitalization', async function () {
      expect(await this.unripe.getRecapitalized()).to.be.equal(to6('12.5'))
      expect(await this.fertilizer.remainingRecapitalization()).to.be.equal(to6('37.5'))
    })

    it('emits an event', async function () {
      await expect(this.result).to.emit(this.unripe, 'Chop').withArgs(
        user.address,
        UNRIPE_BEAN,
        to6('100'),
        to6('3.125')
      )
    })
  })

  // ### Example 3: balanceOfUnderlying Max ≠ Unripe Total Supply, TotalSupply > 100
  // When all fertilizer is sold, balanceOfUnderlying is 100 tokens.
  // Total Supply of unripe is 200. Assume 1 Fertilizer increases balanceOfUnderlying by 1 token.
  // If 25% of Fertilizer is sold, balanceOfUnderlying should be 25. 
  // We want the user to redeem 25%^2 = 6.25% of the underlying.
  // If half the supply was chopped, they should get 3.125 tokens.

  // formula: redeem = currentRipeUnderlying * (usdValueRaised/totalUsdNeeded) * UnripeAmountIn/UnripeSupply;
  // redeem = 25 * 0.25 * 100/200 = 3.125
  describe('chop half the supply balanceOfUnderlying Max ≠ Unripe Total Supply, TotalSupply > 100, fert 25% sold', async function () {
    beforeEach(async function () {
      // but totalDollarsneeded = dollarPerUnripeLP * C.unripeLP().totalSupply() / DECIMALS
      // we need total dollars needed to be 100 * 1e6
      // solve for supply --> we get 188459494,4 --> round to nearest usdc = 189
      await this.unripeLP.mint(userAddress, to6('189'))
      // unripe bean supply == 200
      await this.unripeBean.mint(userAddress, to6('200'))
      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6('25') // balanceOfUnderlying is 25
      )                         
                                                    // s.recapitalized=25
      await this.fertilizer.connect(owner).setPenaltyParams(to6('25'), to6('100'))
      // user chops half the unripe bean supply
      this.result = await this.unripe.connect(user).chop(UNRIPE_BEAN, to6('100'), EXTERNAL, EXTERNAL)
    })

    it('getters', async function () {
      // new rate for underlying per unripe token
      // redeem = currentRipeUnderlying * (usdValueRaised/totalUsdNeeded) * UnripeAmountIn/UnripeSupply;
      // redeem = 21.875 * 0.25 * 1/100 = 0.054687
      expect(await this.unripe.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal(to6('0.21875'))
      expect(await this.unripe.getPenalty(UNRIPE_BEAN)).to.be.equal(to6('0.054687'))
      expect(await this.unripe.getPenalizedUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal(to6('0.054687'))
      expect(await this.unripe.getUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal(to6('0.21875'))
      expect(await this.unripe.balanceOfUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('21.875'))
      // 100urBeans balance * 0.054687 = 5.46875
      expect(await this.unripe.balanceOfPenalizedUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('5.46875'))      
      expect(await this.unripe.getRecapPaidPercent()).to.be.equal(to6('0.01'))
      expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('21.875'))
      expect(await this.unripe.isUnripe(UNRIPE_BEAN)).to.be.equal(true)
    })

    it('changes balances', async function () {
      expect(await this.unripeBean.balanceOf(userAddress)).to.be.equal(to6('100'))
      expect(await this.bean.balanceOf(userAddress)).to.be.equal(to6('3.125'));
      expect(await this.unripeBean.totalSupply()).to.be.equal(to6('100'));
      // 25 underlying at the start - 3.125 redeemed = 21.875
      expect(await this.bean.balanceOf(this.unripe.address)).to.be.equal(to6('21.875'))
    })

    it('urBean chop does not affect recapitalization', async function () {
      expect(await this.unripe.getRecapitalized()).to.be.equal(to6('25'))
      expect(await this.fertilizer.remainingRecapitalization()).to.be.equal(to6('75'))
    })

    it('emits an event', async function () {
      await expect(this.result).to.emit(this.unripe, 'Chop').withArgs(
        user.address,
        UNRIPE_BEAN,
        to6('100'),
        to6('3.125')
      )
    })
  })


  // ### Example 3: balanceOfUnderlying Max ≠ Unripe Total Supply, TotalSupply > 100
  // When all fertilizer is sold, balanceOfUnderlying is 189 tokens.
  // Total Supply of unripeLP is 189. Assume 1 Fertilizer increases balanceOfUnderlying by 1 token.
  // If 25% of Fertilizer is sold, balanceOfUnderlying should be 25. 
  // We want the user to redeem 25%^2 = 6.25% of the underlying.
  // If ~half the supply was chopped, they should get 3.125 tokens.
  // formula: redeem = currentRipeUnderlying * (usdValueRaised/totalUsdNeeded) * UnripeAmountIn/UnripeSupply;
  // redeem = 25 * 0.25 * 1/2 ~= 3.125 --> slightly more than with urBean due to small supply discrepancy
  // since supply is smaller the user is entitled to more underlying per UnripeLP
  describe('LP chop half the supply, balanceOfUnderlying Max ≠ Unripe Total Supply, TotalSupply > 100, fert 25% sold', async function () {
    beforeEach(async function () {
      // totalDollarsneeded = 47
      await this.unripeLP.mint(userAddress, to6('189'))
      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_LP,
        to6('25') // balanceOfUnderlying is 25
      )            
                                                      // s.recapitalized=25
      await this.fertilizer.connect(user).setPenaltyParams(to6('25'), to6('100'))

      // remaining recapitalization = totalDollarsNeeded - s.recapitalized = 100 - 25 = 75
      expect(await this.fertilizer.remainingRecapitalization()).to.be.equal(to6('75'))
      // s.recapitalized = 25
      expect(await this.unripe.getRecapitalized()).to.be.equal(to6('25'))
      
      // 25 * 0.25 * 1/189 ~= 0.03306878307
      expect(await this.unripe.getPenalty(UNRIPE_LP)).to.be.equal(to6('0.033068'))
      // user chops ~ half the unripe LP supply
      this.result = await this.unripe.connect(user).chop(UNRIPE_LP, to6('94.5'), EXTERNAL, EXTERNAL)

    })

    it('getters', async function () {
      // 21.875 / 94.5
      expect(await this.unripe.getUnderlyingPerUnripeToken(UNRIPE_LP)).to.be.equal(to6('0.231481'))
      // 21.876 * 0.43752 * 1/94.5 ~= 0.03306878307
      expect(await this.unripe.getPenalty(UNRIPE_LP)).to.be.equal(to6('0.101273'))

      expect(await this.unripe.getPenalizedUnderlying(UNRIPE_LP, to6('1'))).to.be.equal(to6('0.101273'))
      expect(await this.unripe.getUnderlying(UNRIPE_LP, to6('1'))).to.be.equal(to6('0.231481'))
      expect(await this.unripe.balanceOfUnderlying(UNRIPE_LP, userAddress)).to.be.equal(to6('21.875000'))
      // 94.5 * 0.101273 = 9.5702985
      expect(await this.unripe.balanceOfPenalizedUnderlying(UNRIPE_LP, userAddress)).to.be.equal(to6('9.570312')) 
      expect(await this.unripe.getRecapPaidPercent()).to.be.equal(to6('0.01'))
      expect(await this.unripe.getTotalUnderlying(UNRIPE_LP)).to.be.equal(to6('21.875000'))
      expect(await this.unripe.isUnripe(UNRIPE_LP)).to.be.equal(true)
    })

    it('reduces s.recapitalized proportionally to the amount LP chopped', async function () {
      // recapitalization has reduced proportionally to the dollar amount of unripe LP chopped
      // 21.875000/25 = 0.87500000
      // 12.5% or 3.125
      expect(await this.unripe.getRecapitalized()).to.be.equal(to6('21.875000'))
      // 50 - 21.875 = 28.125
      expect(await this.fertilizer.remainingRecapitalization()).to.be.equal(to6('28.125000'))
    })

    it('changes balances', async function () {
      expect(await this.unripeLP.balanceOf(userAddress)).to.be.equal(to6('94.5'))
      expect(await this.bean.balanceOf(userAddress)).to.be.equal(to6('3.125'));
      expect(await this.unripeLP.totalSupply()).to.be.equal(to6('94.5'));
      // 25 underlying at the start - 3.125 redeemed = 21.875000
      expect(await this.bean.balanceOf(this.unripe.address)).to.be.equal(to6('21.875000'))
    })

    it('emits an event', async function () {
      await expect(this.result).to.emit(this.unripe, 'Chop').withArgs(
        user.address,
        UNRIPE_LP,
        to6('94.5'),
        to6('3.125')
      )
    })
  })
  
  // Same as above but with different transfer modes used
  describe('chop, different transfer modes, half the supply, balanceOfUnderlying Max ≠ Unripe Total Supply, TotalSupply > 100, fert 25% sold', async function () {
    beforeEach(async function () {
      // but totalDollarsneeded = dollarPerUnripeLP * C.unripeLP().totalSupply() / DECIMALS
      // we need total dollars needed to be 100 * 1e6
      // solve for supply --> we get 188459494,4 --> round to nearest usdc = 189
      await this.unripeLP.mint(userAddress, to6('189'))
      // unripe bean supply == 200
      await this.unripeBean.mint(userAddress, to6('200'))
      await this.unripe.connect(owner).addUnderlying(
        UNRIPE_BEAN,
        to6('25') // balanceOfUnderlying is 25
      )                         
                                                  // s.recapitalized=25
      await this.fertilizer.connect(owner).setPenaltyParams(to6('25'), to6('100'))
      await this.token.connect(user).transferToken(
        UNRIPE_BEAN,
        user.address,
        to6('100'),
        EXTERNAL,
        INTERNAL
      )
      this.result = await this.unripe.connect(user).chop(UNRIPE_BEAN, to6('100'), INTERNAL_TOLERANT, EXTERNAL)
    })

    it('getters', async function () {
      // new rate for underlying per unripe token
      // redeem = currentRipeUnderlying * (usdValueRaised/totalUsdNeeded) * UnripeAmountIn/UnripeSupply;
      // redeem = 21.875 * 0.25 * 1/100 = 0.054687
      expect(await this.unripe.getUnderlyingPerUnripeToken(UNRIPE_BEAN)).to.be.equal(to6('0.21875'))
      expect(await this.unripe.getPenalty(UNRIPE_BEAN)).to.be.equal(to6('0.054687'))
      expect(await this.unripe.getPenalizedUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal(to6('0.054687'))
      expect(await this.unripe.getUnderlying(UNRIPE_BEAN, to6('1'))).to.be.equal(to6('0.21875'))
      expect(await this.unripe.balanceOfUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('21.875'))
      // 100urBeans balance * 0.054687 = 5.46875
      expect(await this.unripe.balanceOfPenalizedUnderlying(UNRIPE_BEAN, userAddress)).to.be.equal(to6('5.46875'))      
      expect(await this.unripe.getRecapPaidPercent()).to.be.equal(to6('0.01'))
      expect(await this.unripe.getTotalUnderlying(UNRIPE_BEAN)).to.be.equal(to6('21.875'))
      expect(await this.unripe.isUnripe(UNRIPE_BEAN)).to.be.equal(true)
    })

    it('changes balaces', async function () {
      expect(await this.unripeBean.balanceOf(userAddress)).to.be.equal(to6('100'))
      expect(await this.bean.balanceOf(userAddress)).to.be.equal(to6('3.125'));
      expect(await this.unripeBean.totalSupply()).to.be.equal(to6('100'));
      // 25 underlying at the start - 3.125 redeemed = 21.875
      expect(await this.bean.balanceOf(this.unripe.address)).to.be.equal(to6('21.875'))
    })

    it('emits an event', async function () {
      await expect(this.result).to.emit(this.unripe, 'Chop').withArgs(
        user.address,
        UNRIPE_BEAN,
        to6('100'),
        to6('3.125')
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