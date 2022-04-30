const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { BigNumber } = require('bignumber.js')
const { print } = require('./utils/print.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

let user, user2, owner;
let userAddress, ownerAddress, user2Address, fundraiserAddress;

describe('Fundraiser', function () {
  before(async function () {
    [owner,user,user2, fundraiser] = await ethers.getSigners()
    userAddress = user.address
    user2Address = user2.address
    fundraiserAddress = fundraiser.address
    const contracts = await deploy("Test", false, true)
    ownerAddress = contracts.account
    this.diamond = contracts.beanstalkDiamond
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('MockToken', contracts.bean)
    this.fundraiser = await ethers.getContractAt('MockFundraiserFacet', this.diamond.address)

    let tokenFacet = await ethers.getContractFactory('MockToken')
    this.token = await tokenFacet.deploy('MockToken', 'TOKEN')
    await this.token.deployed()
    await this.season.setYieldE('0')

    await this.season.siloSunrise(0)
    await this.bean.mint(userAddress, '1000000000')
    await this.bean.mint(user2Address, '1000000000')
    await this.token.mint(userAddress, '1000000000')
    await this.token.mint(user2Address, '1000000000')
    await this.token.connect(user).approve(this.diamond.address, '1000000000')
    await this.token.connect(user2).approve(this.diamond.address, '1000000000')
  })

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe('create fundraiser', function () {
    describe('reverts if not owner', async function () {
      it('reverts ', async function () {
        await expect(this.fundraiser.createFundraiser(fundraiserAddress, this.token.address, '1000')).to.be.revertedWith('Fundraiser: sender must be Beanstalk.')
      })
    })

    describe('create a fundraiser', async function () {
      beforeEach(async function () {
        this.result = await this.fundraiser.createFundraiserE(fundraiserAddress, this.token.address, '1000')
      })

      it('gets listed as a fundraiser', async function () {
        expect(await this.fundraiser.remainingFunding(0)).to.be.equal('1000')
        expect(await this.fundraiser.totalFunding(0)).to.be.equal('1000')
        expect(await this.fundraiser.fundingToken(0)).to.be.equal(this.token.address)
        expect(await this.fundraiser.numberOfFundraisers()).to.be.equal(1)
      })

      it('emits a CreateFundraiser event', async function () {
        await expect(this.result).to.emit(this.fundraiser, 'CreateFundraiser').withArgs(0, fundraiserAddress, this.token.address, '1000')
      })

      it('mints beans to protocol', async function () {
        await expect(await this.bean.balanceOf(this.fundraiser.address)).to.be.equal('1000')
      })
    })

    describe('create 2 fundraisers', async function () {
      beforeEach(async function () {
        await this.fundraiser.createFundraiserE(fundraiserAddress, this.token.address, '1000')
        this.result = await this.fundraiser.createFundraiserE(fundraiserAddress, this.token.address, '1000')
      })

      it('gets listed as a fundraiser', async function () {
        expect(await this.fundraiser.remainingFunding(1)).to.be.equal('1000')
        expect(await this.fundraiser.totalFunding(1)).to.be.equal('1000')
        expect(await this.fundraiser.fundingToken(1)).to.be.equal(this.token.address)
        expect(await this.fundraiser.numberOfFundraisers()).to.be.equal(2)
      })

      it('emits a CreateFundraiser event', async function () {
        await expect(this.result).to.emit(this.fundraiser, 'CreateFundraiser').withArgs(1, fundraiserAddress, this.token.address, '1000')
      })

      it('mints beans to protocol', async function () {
        await expect(await this.bean.balanceOf(this.fundraiser.address)).to.be.equal('2000')
      })
    })
  })

  describe('fund fundraiser', async function () {
    beforeEach(async function () {
      await this.fundraiser.createFundraiserE(fundraiserAddress, this.token.address, '1000')
    })

    describe('over fund', async function () {
      beforeEach(async function () {
        this.result = await this.fundraiser.connect(user).fund(0, '1001', EXTERNAL)
      })

      it('reverts on over fund', async function () {
        await expect(this.fundraiser.connect(user).fund(0, '0', EXTERNAL)).to.be.revertedWith('Fundraiser: already completed.')
      })

      it('burns beans from protocol', async function () {
        await expect(await this.bean.balanceOf(this.fundraiser.address)).to.be.equal('0')
      })
    })

    describe('fund completed fundraiser', async function () {
      beforeEach(async function () {
        this.result = await this.fundraiser.connect(user).fund(0, '1000', EXTERNAL)
      })

      it('reverts on over fund', async function () {
        await expect(this.fundraiser.connect(user).fund(0, '0', EXTERNAL)).to.be.revertedWith('Fundraiser: already completed.')
      })

      it('burns beans from protocol', async function () {
        await expect(await this.bean.balanceOf(this.fundraiser.address)).to.be.equal('0')
      })
    })

    describe('partial fund', async function () {
      beforeEach(async function () {
        this.result = await this.fundraiser.connect(user).fund(0, '500', EXTERNAL)
      })

      it('subtracts from totals', async function () {
        expect(await this.fundraiser.remainingFunding(0)).to.be.equal('500')
        expect(await this.fundraiser.totalFunding(0)).to.be.equal('1000')
        expect(await this.fundraiser.fundingToken(0)).to.be.equal(this.token.address)
        expect(await this.token.balanceOf(this.fundraiser.address)).to.be.equal('500')
      })

      it('emits a FundFundraiser event', async function () {
        await expect(this.result).to.emit(this.fundraiser, 'FundFundraiser').withArgs(userAddress, 0, '500')
      })

      it('updates user balances', async function () {
        expect(await this.field.plot(userAddress, 0)).to.be.equal('500')
      })

      it('emits a Sow event', async function () {
        await expect(this.result).to.emit(this.fundraiser, 'Sow').withArgs(userAddress, 0, '500', '500')
      })

      it('burns beans from protocol', async function () {
        await expect(await this.bean.balanceOf(this.fundraiser.address)).to.be.equal('500')
      })
    })

    describe('fully fund', async function () {
      beforeEach(async function () {
        this.result = await this.fundraiser.connect(user).fund(0, '1000', EXTERNAL)
      })

      it('subtracts from totals', async function () {
        expect(await this.fundraiser.remainingFunding(0)).to.be.equal('0')
        expect(await this.fundraiser.totalFunding(0)).to.be.equal('1000')
        expect(await this.fundraiser.fundingToken(0)).to.be.equal(this.token.address)
      })

      it('emits a FundFundraiser event', async function () {
        await expect(this.result).to.emit(this.fundraiser, 'FundFundraiser').withArgs(userAddress, 0, '1000')
      })

      it('sows a plot', async function () {
        expect(await this.field.plot(userAddress, 0)).to.be.equal('1000')
      })

      it('emits a Sow event', async function () {
        await expect(this.result).to.emit(this.fundraiser, 'Sow').withArgs(userAddress, 0, '1000', '1000')
      })

      it('pays fundraiser address', async function () {
        expect(await this.token.balanceOf(fundraiserAddress)).to.be.equal('1000')
        expect(await this.token.balanceOf(this.fundraiser.address)).to.be.equal('0')
      })

      it('emits a FundFundraiser event', async function () {
        await expect(this.result).to.emit(this.fundraiser, 'CompleteFundraiser').withArgs(0)
      })

      it('burns beans from protocol', async function () {
        await expect(await this.bean.balanceOf(this.fundraiser.address)).to.be.equal('0')
      })
    })
  })
})
